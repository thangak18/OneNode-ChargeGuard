import {configureApplication} from '../src/bootstrap';
import {ObservabilityService} from '../src/observability/observability.service';
import 'reflect-metadata';
import {before, after, test} from 'node:test';
import assert from 'node:assert/strict';
import {MongoMemoryServer} from 'mongodb-memory-server';
import {MongoClient, Db} from 'mongodb';
import {Test} from '@nestjs/testing';
import {INestApplication} from '@nestjs/common';
import request from 'supertest';
import {AppModule} from '../src/app.module';
import {DatabaseService} from '../src/database/database.service';
import {APP_CONFIG} from '../src/config/tokens';
import {initializeCollections} from '../src/database/initialize';

let mongod:MongoMemoryServer;let client:MongoClient;let db:Db;let app:INestApplication;let ready=true;let failAssetLookup=false;
const observedRequests:Array<{status:number;duration:number;batch:boolean}>=[];
const observedEvents:Array<{duplicate:boolean}>=[];
const stationId='test-station';const chargerId='test-charger';
const ts=new Date(Date.now()-120000).toISOString();
const from=new Date(Date.now()-3600000).toISOString();
const to=new Date(Date.now()+60000).toISOString();
function event(eventId:string,currentA=10){return {eventId,ts,meta:{stationId,chargerId},currentA,chargingState:'CHARGING',provenance:{sourceType:'SYNTHETIC',fields:{currentA:'SYNTHETIC',chargingState:'SYNTHETIC'}}};}

before(async()=>{
  mongod=await MongoMemoryServer.create({binary:{version:'8.0.16'}});
  client=new MongoClient(mongod.getUri());await client.connect();db=client.db('chargeguard');
  await initializeCollections(db);
  await db.collection<{_id:string;name:string}>('stations').insertOne({_id:stationId,name:'Unit test station'});
  await db.collection<{_id:string;stationId:string;connectorId:string;status:string}>('chargers').insertOne({_id:chargerId,stationId,connectorId:'1',status:'AVAILABLE'});
  const fakeDb={db:()=>db,collection:(name:string)=>{if(failAssetLookup && name==='stations') throw new Error('Sensitive database implementation details');return db.collection(name);},ping:async()=>ready};
  const module=await Test.createTestingModule({imports:[AppModule]}).overrideProvider(ObservabilityService).useValue({record:()=>{},ingestionRequest:(status:number,duration:number,batch:boolean)=>observedRequests.push({status,duration,batch}),accepted:(_input:unknown,duplicate:boolean)=>observedEvents.push({duplicate})}).overrideProvider(DatabaseService).useValue(fakeDb).overrideProvider(APP_CONFIG).useValue({mongoUri:'ignored',mongoDatabase:'chargeguard',nodeEnv:'test',port:3001,ingestApiKey:'local-test-ingest-key-abcdefghijkl'}).compile();
  app=configureApplication(module.createNestApplication());await app.init();
});
after(async()=>{if(app)await app.close();if(client)await client.close();if(mongod)await mongod.stop();});

test('initialization creates six collections including timeseries and is repeatable',async()=>{
  assert.equal((await db.listCollections({name:'telemetry'}).next())?.type,'timeseries');
  assert.deepEqual(await initializeCollections(db),[]);
  const indexNames=(await db.collection('telemetry').listIndexes().toArray()).map(i=>i.name);
  assert.ok(indexNames.includes('charger_time'));
});
test('health live and database readiness endpoints',async()=>{
  const s=app.getHttpServer();
  const firstHealth=await request(s).get('/api/v1/health/live');
  assert.equal(firstHealth.status,200);
  assert.equal(firstHealth.body.status,'ok');
  await request(s).get('/api/v1/health/ready').expect(200);
  ready=false;
  await request(s).get('/api/v1/health/ready').expect(503).expect(r=>assert.equal(r.body.message,'Database unavailable'));
  ready=true;
});
test('POST validation and API key requirements',async()=>{
  const s=app.getHttpServer();
  await request(s).post('/api/v1/telemetry').send(event('auth')).expect(401);
  const before=observedRequests.length;
  await request(s).post('/api/v1/telemetry').set('Content-Type','application/json').send('{').expect(400);
  assert.equal(observedRequests.length,before+1);
  assert.equal(observedRequests.at(-1)?.status,400);
  await request(s).post('/api/v1/telemetry').set('x-api-key','local-test-ingest-key-abcdefghijkl').send({...event('bad'),currentA:-5}).expect(400);
  await request(s).post('/api/v1/telemetry').set('x-api-key','local-test-ingest-key-abcdefghijkl').send({...event('no-charger'),meta:{stationId,chargerId:'absent'}}).expect(404);
});
test('single ingestion, missing optional values, retry and fingerprint conflict',async()=>{
  const s=app.getHttpServer();const key='local-test-ingest-key-abcdefghijkl';
  const first=await request(s).post('/api/v1/telemetry').set('x-api-key',key).send(event('evt-1')).expect(201);
  assert.equal(first.body.duplicate,false);
  const duplicate=await request(s).post('/api/v1/telemetry').set('x-api-key',key).send(event('evt-1')).expect(201);
  assert.equal(duplicate.body.duplicate,true);
  await request(s).post('/api/v1/telemetry').set('x-api-key',key).send(event('evt-1',99)).expect(409);
  assert.equal(await db.collection('telemetry').countDocuments({'meta.chargerId':chargerId}),1);
  const onlyCurrent=event('only-current');delete (onlyCurrent as any).chargingState;delete (onlyCurrent.provenance.fields as any).chargingState;
  await request(s).post('/api/v1/telemetry').set('x-api-key',key).send(onlyCurrent).expect(201);
  assert.equal(await db.collection('telemetry').countDocuments({'meta.chargerId':chargerId}),2);
});
test('batch validation rejects entire malformed payload then ingests/retries valid events',async()=>{
  const s=app.getHttpServer();const key='local-test-ingest-key-abcdefghijkl';
  await request(s).post('/api/v1/telemetry/batch').set('x-api-key',key).send({events:[event('batch-good'),{...event('batch-bad'),currentA:-1}]}).expect(400);
  assert.equal(await db.collection('telemetry').countDocuments({eventId:'batch-good'}),0);
  const first=await request(s).post('/api/v1/telemetry/batch').set('x-api-key',key).send({events:[event('batch-a',10),event('batch-b',20)]}).expect(201);
  assert.equal(first.body.items.length,2);
  const duplicate=await request(s).post('/api/v1/telemetry/batch').set('x-api-key',key).send({events:[event('batch-a',10),event('batch-b',20)]}).expect(201);
  assert.ok(duplicate.body.items.every((i:{duplicate:boolean})=>i.duplicate));
});
test('reconcile a previously inserted reading whose receipt remained pending',async()=>{
  const receipt=await db.collection('ingestion_receipts').findOne({eventId:'evt-1'});
  assert.ok(receipt);
  await db.collection('ingestion_receipts').updateOne({_id:receipt._id},{$set:{status:'PENDING'}});
  const result=await request(app.getHttpServer()).post('/api/v1/telemetry')
    .set('x-api-key','local-test-ingest-key-abcdefghijkl').send(event('evt-1')).expect(201);
  assert.equal(result.body.duplicate,true);
  assert.equal((await db.collection('ingestion_receipts').findOne({_id:receipt._id}))?.status,'COMMITTED');
});
test('history, latest, averages, state distribution and station summary return correct data',async()=>{
  const s=app.getHttpServer();const params=`from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`;
  const history=await request(s).get(`/api/v1/telemetry/history?chargerId=${chargerId}&${params}`).expect(200);
  assert.equal(history.body.length,4);
  assert.equal(history.body[0].eventKey,undefined);
  const latest=await request(s).get(`/api/v1/analytics/latest?chargerId=${chargerId}&${params}`).expect(200);
  assert.equal(latest.body.length,1);
  const averages=await request(s).get(`/api/v1/analytics/current-averages?chargerId=${chargerId}&${params}&bucketMinutes=60`).expect(200);
  assert.equal(averages.body.reduce((n:number,b:{samples:number})=>n+b.samples,0),4);
  const states=await request(s).get(`/api/v1/analytics/states?stationId=${stationId}&${params}`).expect(200);
  assert.equal(states.body.find((s:{state:string})=>s.state==='CHARGING').count,3);
  const activity=await request(s).get(`/api/v1/analytics/activity?stationId=${stationId}&${params}&windowMinutes=30`).expect(200);
  assert.equal(activity.body.active,1);
  const summary=await request(s).get(`/api/v1/analytics/stations/${stationId}/summary?${params}`).expect(200);
  assert.equal(summary.body.sampleCount,4);
  await request(s).get(`/api/v1/telemetry/history?chargerId=${chargerId}`).expect(400);
  await request(s).get(`/api/v1/analytics/latest?from=2025-01-01T00:00:00Z&to=2026-01-01T00:00:00Z`).expect(400);
});
test('database failures return sanitized service errors',async()=>{
  failAssetLookup=true;
  try {
    const res=await request(app.getHttpServer()).post('/api/v1/telemetry')
      .set('x-api-key','local-test-ingest-key-abcdefghijkl').send(event('unavailable')).expect(503);
    assert.equal(res.body.message,'Asset lookup unavailable');
    assert.equal(JSON.stringify(res.body).includes('Sensitive database implementation details'),false);
  } finally {failAssetLookup=false;}
});

test('observability covers authentication/validation/database failures and deduplicated/batch ingestion',()=>{
  assert.ok(observedRequests.some(r=>r.status===401));
  assert.ok(observedRequests.some(r=>r.status===400 && r.batch));
  assert.ok(observedRequests.some(r=>r.status===503));
  assert.ok(observedRequests.some(r=>r.status===201 && r.batch));
  assert.ok(observedRequests.every(r=>r.duration>=0));
  assert.ok(observedEvents.some(r=>r.duplicate));
  assert.ok(observedEvents.some(r=>!r.duplicate));
});
