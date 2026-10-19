import {readFileSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {setTimeout as sleep} from 'node:timers/promises';
import {MongoClient} from 'mongodb';
import {loadLocalEnv,validateConfig} from '../src/config/config';
import {demoReading} from '../src/observability/demo-scenario';

/** Resume only the already-created Phase D incident. No global reset or direct incident mutations. */
async function main():Promise<void> {
  loadLocalEnv();const cfg=validateConfig(process.env);
  const action=process.argv[2]??'audit';
  const incidentId='demo-58a1983cae09';const run=incidentId.slice(5);
  const path=resolve(__dirname,'../../../docs/evidence/phase-d-e2e.json');
  const evidence=JSON.parse(readFileSync(path,'utf8'));
  evidence.liveVerification??={incidentId,demoRunId:run,startedAt:new Date().toISOString(),steps:[]};
  function save(){writeFileSync(path,JSON.stringify(evidence,null,2)+'\n');}
  const base=`http://127.0.0.1:${cfg.port}/api/v1`;
  async function api(path:string,body?:unknown){
    const res=await fetch(base+path,{method:body===undefined?'GET':'POST',headers:{'content-type':'application/json','x-api-key':cfg.ingestApiKey!},...(body===undefined?{}:{body:JSON.stringify(body)}),signal:AbortSignal.timeout(15000)});
    if(!res.ok)throw new Error('HTTP step rejected');return res.json() as Promise<any>;
  }
  const incident=await api(`/incidents/${incidentId}`);
  if(incident._id!==incidentId || incident.synthetic!==true || incident.stationId!=='demo-station-01' || incident.chargerId!=='demo-charger-01' || incident.scenario!=='SIM_OVERHEAT')throw new Error('Incident scope mismatch');
  if(['audit','audit-final'].includes(action)) {
    const client=new MongoClient(cfg.mongoUri,{serverSelectionTimeoutMS:10000});
    try {
      await client.connect();const db=client.db(cfg.mongoDatabase);
      const originalTime=new Date(evidence.atlas.telemetry.eventTime);
      const original=await db.collection('telemetry').find({ts:originalTime,'meta.stationId':incident.stationId,eventId:{$regex:`^b2-${run}-1-`}},{projection:{_id:0,eventId:1,ts:1,meta:1,currentA:1,temperatureC:1,chargingState:1,faultCode:1,provenance:1}}).toArray();
      const actions=await db.collection('incident_actions').find({incidentId},{sort:{at:1},projection:{_id:0}}).toArray();
      const latest=await db.collection('telemetry').findOne({'meta.chargerId':incident.chargerId,ts:{$gte:originalTime}},{sort:{ts:-1},projection:{_id:0,eventId:1,ts:1,currentA:1,temperatureC:1,chargingState:1,faultCode:1,provenance:1}});
      const untouched=await db.collection('telemetry').countDocuments({'meta.stationId':incident.stationId,'meta.chargerId':{$in:['demo-charger-02','demo-charger-03','demo-charger-04','demo-charger-05']},ts:{$gte:new Date(evidence.liveVerification.startedAt)}});
      const snapshot={observedAt:new Date().toISOString(),incident:{id:incidentId,stationId:incident.stationId,chargerId:incident.chargerId,status:incident.status,detectedAt:incident.detectedAt,acknowledgedAt:incident.acknowledgedAt,recoveryRequestedAt:incident.recoveryRequestedAt,recoveryTelemetryAt:incident.recoveryTelemetryAt,resolvedAt:incident.resolvedAt,synthetic:incident.synthetic},originalTelemetry:original,actions,latest,otherChargerWritesDuringResumption:untouched};
      evidence.liveVerification.auditHistory??=[];
      evidence.liveVerification.auditHistory.push({kind:action,...snapshot});
      if(action==='audit') evidence.liveVerification.initialAudit??=snapshot;
      else evidence.liveVerification.finalAudit=snapshot;
      save();
      console.log(JSON.stringify({step:action,status:incident.status,originalEvents:original.length,actions:actions.length,otherChargerWrites:untouched}));
    } finally {await client.close();}
    return;
  }
  if(!process.argv.includes('--execute'))throw new Error('Mutations require explicit --execute');
  if(action==='pulse') {
    if(!['OPEN','ACKNOWLEDGED'].includes(incident.status))throw new Error('Fault re-emission requires active pre-recovery incident');
    const requested=process.argv.indexOf('--count');const count=requested<0?1:Number(process.argv[requested+1]);
    if(!Number.isInteger(count)||count<1||count>30)throw new Error('Pulse count must be bounded');
    evidence.liveVerification.reemissionRequestedAt=new Date().toISOString();save();
    for(let i=0;i<count;i++) {
      const current=await api(`/incidents/${incidentId}`);
      if(!['OPEN','ACKNOWLEDGED'].includes(current.status))break;
      const now=new Date();const event=demoReading(run,Math.floor(now.getTime()/1000),1,true,now,'SIM_OVERHEAT');
      await api('/telemetry',event);
      evidence.liveVerification.firstReemittedEventAt??=now.toISOString();
      evidence.liveVerification.lastReemittedEventAt=now.toISOString();
      evidence.liveVerification.reemittedCount=(evidence.liveVerification.reemittedCount??0)+1;save();
      console.log(JSON.stringify({step:'fault-reemitted',incidentId,eventId:event.eventId,at:event.ts,synthetic:true}));
      if(i<count-1)await sleep(10000);
    }
    return;
  }
  const startedAt=new Date().toISOString();let result;
  if(action==='acknowledge')result=await api(`/incidents/${incidentId}/acknowledge`,{actor:'phase-d-operator'});
  else if(action==='recover')result=await api('/demo/recover',{incidentId});
  else if(action==='resolve')result=await api(`/incidents/${incidentId}/resolve`,{actor:'phase-d-operator'});
  else throw new Error('Unsupported workflow action');
  evidence.liveVerification.steps.push({action,requestedAt:startedAt,completedAt:new Date().toISOString(),status:result.status,incidentId});
  save();console.log(JSON.stringify({step:action,status:result.status,incidentId}));
}
void main().catch(()=>{console.error('PHASE_D_STEP FAIL (details withheld; verify readiness, scope and state)');process.exitCode=1;});
