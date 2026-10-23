import 'reflect-metadata';import {before,after,test} from 'node:test';import assert from 'node:assert/strict';import {Test} from '@nestjs/testing';import {VersioningType,INestApplication} from '@nestjs/common';import {MongoMemoryServer} from 'mongodb-memory-server';import {MongoClient} from 'mongodb';import request from 'supertest';import {SignJWT} from 'jose';import {randomBytes,createHash} from 'node:crypto';import {JudgeController} from '../src/judge/judge.controller';import {JudgeRunService} from '../src/judge/judge-run.service';import {DatabaseService} from '../src/database/database.service';import {deploymentPolicy} from '../src/common/deployment-policy';
let mongo:MongoMemoryServer,client:MongoClient,app:INestApplication,id:string;const saved={...process.env};const secret=randomBytes(32).toString('hex'),key=randomBytes(32).toString('hex'),origin='https://web.example.test';
before(async()=>{Object.assign(process.env,{JUDGE_ROUTES_ENABLED:'true',JUDGE_REARM_ENABLED:'true',JUDGE_READS_ENABLED:'true',OPERATOR_ASSERTION_SECRET:secret,JUDGE_WRITE_API_KEY:key,OPERATOR_ORIGIN:origin,OPERATOR_GITHUB_IDS:'123'});mongo=await MongoMemoryServer.create({binary:{version:'8.0.16'}});client=new MongoClient(mongo.getUri());await client.connect();const db=client.db('http_judge');const module=await Test.createTestingModule({controllers:[JudgeController],providers:[{provide:DatabaseService,useValue:{db:()=>db}}]}).compile();app=module.createNestApplication();(app as any).useBodyParser('json',{limit:'8kb',verify:(req:any,_res:any,b:Buffer)=>{req.rawBody=Buffer.from(b)}});app.setGlobalPrefix('api');app.enableVersioning({type:VersioningType.URI,defaultVersion:'1'});await app.init();id=await new JudgeRunService(db,{secret:Buffer.from(secret),issuer:origin,audience:'chargeguard-api',origin,githubIds:new Set(['123'])},key).provision('github:123','demo-charger-01');});
after(async()=>{await app?.close();await client?.close();await mongo?.stop();for(const k of ['JUDGE_REARM_ENABLED','JUDGE_ROUTES_ENABLED','JUDGE_READS_ENABLED','OPERATOR_ASSERTION_SECRET','JUDGE_WRITE_API_KEY','OPERATOR_ORIGIN','OPERATOR_GITHUB_IDS']){if(saved[k]===undefined)delete process.env[k];else process.env[k]=saved[k]}});
async function token(op:string,sub='github:123',body?:string){const state=await client.db('http_judge').collection('judge_runs').findOne({_id:id as any});const expectedRevision=state?.revision??0,expectedCycle=state?.cycle??1;body??=JSON.stringify({expectedRevision,expectedCycle});return new SignJWT({expectedRevision,expectedCycle,operation:op,method:'POST',path:`/api/v1/judge/runs/${id}/${op}`,runId:id,stationId:'demo-station-01',chargerId:'demo-charger-01',bodySha256:createHash('sha256').update(body).digest('hex')}).setProtectedHeader({alg:'HS256'}).setIssuer(origin).setAudience('chargeguard-api').setSubject(sub).setIssuedAt().setExpirationTime('30s').setJti(randomBytes(16).toString('hex')).sign(Buffer.from(secret));}
test('HTTP judge rejects anonymous, wrong owner, origin, body and read credential; accepts isolated lifecycle',async()=>{
 const path=`/api/v1/judge/runs/${id}/fault`;const s=app.getHttpServer();await request(s).post(path).send({expectedRevision:0,expectedCycle:1}).expect(401);
 for(const change of ['owner','origin','body','key']){await request(s).post(path).set('origin',change==='origin'?'https://evil.example.test':origin).set('x-chargeguard-write-key',change==='key'?'read-key':key).set('x-chargeguard-operator',await token('fault',change==='owner'?'github:456':'github:123')).send(change==='body'?{actor:'forged'}:{expectedRevision:0,expectedCycle:1}).expect(change==='body'?400:401);}
 for(const [revision,op] of ['fault','acknowledge','recover','resolve'].entries())await request(s).post(`/api/v1/judge/runs/${id}/${op}`).set('origin',origin).set('x-chargeguard-write-key',key).set('x-chargeguard-operator',await token(op)).send({expectedRevision:revision,expectedCycle:1}).expect(201);
});
test('unconditional production gate denies even valid judge request',()=>{let code=0;deploymentPolicy({NODE_ENV:'production',BFF_READ_API_KEY:'r'.repeat(32)})({method:'POST',path:'/api/v1/judge/runs/test/fault'} as any,{setHeader(){},status(n:number){code=n;return this},json(){}} as any,()=>assert.fail('must deny'));assert.equal(code,403);});
async function readToken(path:string,sub='github:123',changes:Record<string,unknown>={},expiry='30s'){
 return new SignJWT({method:'GET',scope:'judge:read',path,...changes}).setProtectedHeader({alg:'HS256'}).setIssuer(origin).setAudience('chargeguard-api').setSubject(sub).setIssuedAt().setExpirationTime(expiry).setJti(randomBytes(16).toString('hex')).sign(Buffer.from(secret));
}
test('HTTP read assertions require authorized identity, exact method/path, issuer and origin',async()=>{
 const s=app.getHttpServer(),base='/api/v1/judge/runs';
 await request(s).get(base).expect(401);
 const good=await readToken(base);
 const list=await request(s).get(base).set('origin',origin).set('x-chargeguard-operator-read',good).expect(200);
 assert.equal(list.body.length,1);assert.equal(list.body[0]._id,id);assert.equal(list.body[0].owner,undefined);
 const detail=await request(s).get(`${base}/${id}`).set('origin',origin).set('x-chargeguard-operator-read',await readToken(`${base}/${id}`)).expect(200);
 assert.equal(detail.body._id,id);assert.equal(detail.body.owner,undefined);
 process.env.OPERATOR_GITHUB_IDS='123,456';
 try {
  const otherOwner=await readToken(base,'github:456');
  const otherList=await request(s).get(base).set('origin',origin).set('x-chargeguard-operator-read',otherOwner).expect(200);
  assert.deepEqual(otherList.body,[]);
  await request(s).get(`${base}/${id}`).set('origin',origin)
   .set('x-chargeguard-operator-read',await readToken(`${base}/${id}`,'github:456')).expect(404);
 } finally { process.env.OPERATOR_GITHUB_IDS='123'; }
 const wrongOwner=await request(s).get(base).set('origin',origin).set('x-chargeguard-operator-read',await readToken(base,'github:456')).expect(401);
 assert.ok(wrongOwner.body.message);
 for(const [target,tokenValue,requestOrigin] of [
  [base,good,'https://evil.example.test'],
  [`${base}/${id}`,good,origin],
  [base,await readToken(base,'github:123',{method:'POST'}),origin],
  [base,await readToken(base,'github:123',{scope:'judge:write'}),origin],
  [base,await readToken(base,'github:123',{},'-5s'),origin],
 ] as const)await request(s).get(target).set('origin',requestOrigin).set('x-chargeguard-operator-read',tokenValue).expect(401);
 await request(s).get(`${base}/judge-${'0'.repeat(24)}`).set('origin',origin)
  .set('x-chargeguard-operator-read',await readToken(`${base}/judge-${'0'.repeat(24)}`)).expect(404);
 process.env.JUDGE_READS_ENABLED='false';
 try{await request(s).get(base).set('origin',origin).set('x-chargeguard-operator-read',good).expect(503);}
 finally{process.env.JUDGE_READS_ENABLED='true';}
});
test('production policy enforces service read key before the judge assertion and blocks every mutation',()=>{
 const p=deploymentPolicy({NODE_ENV:'production',BFF_READ_API_KEY:'r'.repeat(32)});
 for(const path of ['/api/v1/judge/runs','/api/v1/judge/runs/judge-'+ '0'.repeat(24)]){
  let code=0;p({method:'GET',path,headers:{}} as any,{setHeader(){},status(n:number){code=n;return this},json(){}} as any,()=>assert.fail('missing read key must be denied'));
  assert.equal(code,401);
 }
 for(const path of ['/api/v1/judge/runs','/api/v1/judge/runs/test/fault','/api/v1/demo/reset','/api/v1/telemetry']){
  let code=0;p({method:'POST',path,headers:{}} as any,{setHeader(){},status(n:number){code=n;return this},json(){}} as any,()=>assert.fail('production mutation must be denied'));
  assert.equal(code,403);
 }
});
