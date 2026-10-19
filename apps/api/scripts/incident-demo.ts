import {randomBytes} from 'node:crypto';
import {createInterface} from 'node:readline';
import {mkdirSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {AddressInfo} from 'node:net';
import {MongoClient,Db} from 'mongodb';
import {MongoMemoryServer} from 'mongodb-memory-server';
import {Test} from '@nestjs/testing';
import {AppModule} from '../src/app.module';
import {APP_CONFIG} from '../src/config/tokens';
import {DatabaseService} from '../src/database/database.service';
import {initializeCollections} from '../src/database/initialize';
import {createApplication,configureApplication} from '../src/bootstrap';
import {loadLocalEnv,validateConfig} from '../src/config/config';
import {ObservabilityService,JsonFrameworkLogger,observabilityConfig} from '../src/observability/observability.service';
import {demoReading} from '../src/observability/demo-scenario';

async function main():Promise<void> {
  if(!process.argv.includes('--execute')) throw new Error('Explicit --execute required');
  loadLocalEnv();
  if(process.env.DD_METRICS_ENABLED!=='true') throw new Error('Enable local metrics first');
  const local=process.argv.includes('--local-db');
  const run=randomBytes(6).toString('hex');
  process.env.INGEST_API_KEY=randomBytes(32).toString('hex');
  const cfg=validateConfig(process.env);
  let mongod:MongoMemoryServer|undefined;
  let client:MongoClient|undefined;
  let db:Db;let app;
  if(local) {
    mongod=await MongoMemoryServer.create({binary:{version:'8.0.16'}});
    client=new MongoClient(mongod.getUri());await client.connect();db=client.db('chargeguard');await initializeCollections(db);
    await db.collection<{_id:string}>('stations').insertOne({_id:'demo-station-01'});
    for(let i=1;i<=5;i++) await db.collection<{_id:string;stationId:string;connectorId:string}>('chargers').insertOne({_id:`demo-charger-${String(i).padStart(2,'0')}`,stationId:'demo-station-01',connectorId:String(i)});
    const module=await Test.createTestingModule({imports:[AppModule]}).overrideProvider(DatabaseService).useValue({collection:(name:string)=>db.collection(name),ping:async()=>(await db.admin().ping()).ok===1}).overrideProvider(APP_CONFIG).useValue({...cfg,nodeEnv:'test'}).compile();
    app=configureApplication(module.createNestApplication({logger:new JsonFrameworkLogger(new ObservabilityService({...observabilityConfig(process.env),enabled:false}))}));
  } else {
    app=await createApplication();await app.init();db=app.get(DatabaseService).db();
  }
  const evidencePath=resolve(__dirname,'../../../docs/evidence/phase-b2-incident.json');
  const evidence:{run:string;database:string;synthetic:boolean;monitorObservations:unknown[];actions:unknown[];[key:string]:unknown}={run,database:local?'disposable-local':'atlas',synthetic:true,startedAt:new Date().toISOString(),monitorObservations:[],actions:[]};
  function save():void {mkdirSync(resolve(evidencePath,'..'),{recursive:true});writeFileSync(evidencePath,JSON.stringify(evidence,null,2)+'\n');}
  function output(event:string,fields:Record<string,unknown>={}):void {console.log(JSON.stringify({event,at:new Date().toISOString(),...fields}));}
  let mode:'baseline'|'fault'|'recovery'='baseline';let sequence=0;let done=false;
  try {
    await app.listen(0,'127.0.0.1');const base=`http://127.0.0.1:${(app.getHttpServer().address() as AddressInfo).port}`;
    const obs=app.get(ObservabilityService);
    async function action(action:string):Promise<void> {
      const at=new Date();evidence.actions.push({action,at:at.toISOString()});save();
      obs.record('info','demo.action',{demo_id:run,action});
      await db.collection('incident_actions').insertOne({incidentId:`demo-${run}`,actor:'synthetic-demo-operator',action,at,synthetic:true});
    }
    async function tick():Promise<void> {
      const fault=mode==='fault';
      const events=Array.from({length:5},(_,i)=>demoReading(run,sequence++,i+1,fault && i===0));
      const response=await fetch(base+'/api/v1/telemetry/batch',{method:'POST',headers:{'content-type':'application/json','x-api-key':process.env.INGEST_API_KEY!},body:JSON.stringify({events})});
      if(response.status!==201) throw new Error('Demo ingestion failed');
      if(fault) {
        const bad=await fetch(base+'/api/v1/telemetry',{method:'POST',headers:{'content-type':'application/json','x-api-key':process.env.INGEST_API_KEY!},body:JSON.stringify({...events[0],currentA:-1})});
        if(bad.status!==400) throw new Error('Expected controlled validation rejection');
      }
      await obs.flush();output('DEMO_TICK',{mode,readings:5,synthetic:true});
    }
    const lineReader=createInterface({input:process.stdin,crlfDelay:Infinity});
    let serial=Promise.resolve();
    lineReader.on('line',line=>{serial=serial.then(async()=>{
      const [command,arg,arg2]=line.trim().split(/\s+/);
      if(command==='fault' && mode==='baseline') {
        mode='fault';evidence.faultStartedAt=new Date().toISOString();
        await db.collection<{_id:string;[key:string]:unknown}>('incidents').insertOne({_id:`demo-${run}`,chargerId:'demo-charger-01',scenario:'SYNTHETIC_MONITOR_DEMO',status:'OPEN',detectedAt:new Date(),synthetic:true});
        await action('fault_injected');await tick();
      } else if(command==='observe' && ['alert','ok'].includes(arg) && /^\d+$/.test(arg2??'')) {
        // Operator records only states actually observed in Datadog; this is not an API assertion.
        evidence.monitorObservations.push({monitorId:arg2,state:arg,observedAt:new Date().toISOString(),method:'authenticated-Datadog-UI'});save();output('MONITOR_OBSERVATION_RECORDED',{state:arg,monitorId:arg2});
      } else if(command==='investigate') {
        const since=new Date(String(evidence.faultStartedAt??evidence.startedAt));
        const counts=await db.collection('telemetry').countDocuments({'meta.chargerId':'demo-charger-01',ts:{$gte:since},'provenance.sourceType':'SYNTHETIC'});
        const latest=await db.collection('telemetry').findOne({'meta.chargerId':'demo-charger-01',ts:{$gte:since}},{sort:{ts:-1},projection:{_id:0,ts:1,currentA:1,chargingState:1,faultCode:1}});
        evidence.telemetryEvidence={count:counts,latest};await action('investigate');output('TELEMETRY_EVIDENCE',{count:counts,latest});
      } else if(command==='recover' && mode==='fault') {
        mode='recovery';evidence.recoveryRequestedAt=new Date().toISOString();await action('recovery_requested');await tick();
        await db.collection<{_id:string;[key:string]:unknown}>('incidents').updateOne({_id:`demo-${run}`},{$set:{status:'RESOLVING',synthetic:true}});
      } else if(command==='resolved' && mode==='recovery') {
        await action('resolved');await db.collection<{_id:string;[key:string]:unknown}>('incidents').updateOne({_id:`demo-${run}`},{$set:{status:'RESOLVED',resolvedAt:new Date()}});evidence.resolvedAt=new Date().toISOString();save();output('INCIDENT_RESOLVED_RECORDED');
      } else if(command==='quit') {done=true;lineReader.close();}
      else output('COMMAND_REJECTED');
    }).catch(()=>{output('DEMO_COMMAND_FAIL (details withheld)');process.exitCode=1;done=true;lineReader.close();});});
    await action('baseline');await tick();output('DEMO_READY',{run,database:evidence.database,commands:'fault | observe alert/ok monitorId | investigate | recover | resolved | quit'});
    while(!done) {await new Promise(resolve=>setTimeout(resolve,5000));await serial;if(!done)await tick();}
    await serial;
  } finally {evidence.stoppedAt=new Date().toISOString();save();await app.close();if(client)await client.close();if(mongod)await mongod.stop();}
}
void main().catch(()=>{console.error('INCIDENT_DEMO FAIL (sensitive details withheld)');process.exitCode=1;});
