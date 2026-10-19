import {randomBytes} from 'node:crypto';
import {AddressInfo} from 'node:net';
import {createApplication,configureApplication} from '../src/bootstrap';
import {Test} from '@nestjs/testing';
import {MongoMemoryServer} from 'mongodb-memory-server';
import {MongoClient} from 'mongodb';
import {AppModule} from '../src/app.module';
import {DatabaseService} from '../src/database/database.service';
import {APP_CONFIG} from '../src/config/tokens';
import {initializeCollections} from '../src/database/initialize';
import {JsonFrameworkLogger,observabilityConfig} from '../src/observability/observability.service';
import {loadLocalEnv} from '../src/config/config';
import {ObservabilityService} from '../src/observability/observability.service';

/** Explicitly opt-in: three clearly synthetic Atlas readings; no real ACN source data. */
async function main():Promise<void> {
  if(!process.argv.includes('--execute')) throw new Error('Explicit --execute required');
  loadLocalEnv();
  if(process.env.DD_METRICS_ENABLED!=='true') throw new Error('Enable local DogStatsD configuration first');
  process.env.INGEST_API_KEY=randomBytes(32).toString('hex');
  const local=process.argv.includes('--local-db');
  let mongod:MongoMemoryServer|undefined;
  let client:MongoClient|undefined;
  let app;
  if(local) {
    mongod=await MongoMemoryServer.create({binary:{version:'8.0.16'}});
    client=new MongoClient(mongod.getUri());await client.connect();
    const db=client.db('chargeguard');await initializeCollections(db);
    await db.collection<{_id:string}>('stations').insertOne({_id:'demo-station-01'});
    await db.collection<{_id:string;stationId:string;connectorId:string}>('chargers').insertOne({_id:'demo-charger-01',stationId:'demo-station-01',connectorId:'1'});
    const module=await Test.createTestingModule({imports:[AppModule]})
      .overrideProvider(DatabaseService).useValue({collection:(name:string)=>db.collection(name),ping:async()=>(await db.admin().ping()).ok===1})
      .overrideProvider(APP_CONFIG).useValue({nodeEnv:'test',mongoUri:'unused',mongoDatabase:'chargeguard',port:3001,ingestApiKey:process.env.INGEST_API_KEY}).compile();
    app=configureApplication(module.createNestApplication({logger:new JsonFrameworkLogger(new ObservabilityService({...observabilityConfig(process.env),enabled:false}))}));
  } else {app=await createApplication();}
  const run=randomBytes(6).toString('hex');
  try {
    await app.listen(0,'127.0.0.1');
    const base=`http://127.0.0.1:${(app.getHttpServer().address() as AddressInfo).port}`;
    const ts=new Date().toISOString();
    function event(label:string,fault=false) {
      return {eventId:`obs-smoke-${run}-${label}`,ts,meta:{stationId:'demo-station-01',chargerId:'demo-charger-01'},
        currentA:fault?0:8.25,chargingState:fault?'FAULT':'CHARGING',...(fault?{faultCode:'SIMULATED_TEST_FAULT'}:{}),
        provenance:{sourceType:'SYNTHETIC',fields:{currentA:'SYNTHETIC',chargingState:'SYNTHETIC',...(fault?{faultCode:'SYNTHETIC'}:{})},assumptions:'Datadog integration smoke fixture; entirely synthetic, not physical charger measurements.'}};
    }
    async function post(path:string,payload:unknown,key=true) {
      const res=await fetch(base+path,{method:'POST',headers:{'content-type':'application/json',...(key?{'x-api-key':process.env.INGEST_API_KEY!}:{})},body:JSON.stringify(payload)});
      return {status:res.status,body:await res.json() as any};
    }
    const ready=await fetch(base+'/api/v1/health/ready');
    if(ready.status!==200) throw new Error('Readiness failed');
    const reading=event('current');
    const first=await post('/api/v1/telemetry',reading);
    const retry=await post('/api/v1/telemetry',reading);
    const noKey=await post('/api/v1/telemetry',reading,false);
    const bad=await post('/api/v1/telemetry',{...reading,currentA:-1});
    const batch=await post('/api/v1/telemetry/batch',{events:[event('fault',true),event('recovery')]});
    if(first.status!==201 || retry.status!==201 || !retry.body.duplicate || noKey.status!==401 || bad.status!==400 || batch.status!==201) throw new Error('Unexpected ingestion outcomes');
    await app.get(ObservabilityService).flush();
    console.log(`OBSERVABILITY_HTTP_SMOKE PASS (${local?'LOCAL DISPOSABLE MONGODB':'ATLAS'}; 3 synthetic readings, 1 retry, 2 intentional rejections)`);
    console.log('DOGSTATSD_SOCKET_SEND_COMPLETE (UDP delivery and US1 visibility require independent verification)');
  } finally {await app.close();if(client)await client.close();if(mongod)await mongod.stop();}
}
void main().catch(()=>{console.error('OBSERVABILITY_HTTP_SMOKE FAIL (sensitive details withheld)');process.exitCode=1;});
