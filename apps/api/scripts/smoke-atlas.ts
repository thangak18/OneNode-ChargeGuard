import {randomBytes} from 'node:crypto';
import {AddressInfo} from 'node:net';
import {createApplication} from '../src/bootstrap';
import {loadLocalEnv} from '../src/config/config';

/** Opt-in Atlas smoke: writes one fixed, labeled synthetic reading; retries are idempotent. */
async function main() {
  if(!process.argv.includes('--execute')) throw new Error('Run explicitly with --execute to write one synthetic sample');
  loadLocalEnv();
  process.env.INGEST_API_KEY=randomBytes(32).toString('hex');
  const app=await createApplication();
  try {
    await app.listen(0,'127.0.0.1');
    const port=(app.getHttpServer().address() as AddressInfo).port;
    const base=`http://127.0.0.1:${port}`;
    async function json(path:string,init?:RequestInit) {
      const response=await fetch(base+path,init);
      const body=await response.json() as any;
      return {status:response.status,body};
    }
    const live=await json('/api/v1/health/live');
    const ready=await json('/api/v1/health/ready');
    if(live.status!==200 || ready.status!==200) throw new Error('Health/readiness failed');
    console.log('ATLAS_HEALTH PASS');
    const eventId='phase-a-atlas-smoke-20261018';
    const event={eventId,ts:'2026-10-18T08:30:00.000Z',meta:{stationId:'demo-station-01',chargerId:'demo-charger-01'},currentA:8.25,chargingState:'CHARGING',provenance:{sourceType:'SYNTHETIC',fields:{currentA:'SYNTHETIC',chargingState:'SYNTHETIC'},assumptions:'Small, entirely synthetic Phase A API test reading; not a physical charger observation.'}};
    const post=()=>json('/api/v1/telemetry',{method:'POST',headers:{'content-type':'application/json','x-api-key':process.env.INGEST_API_KEY!},body:JSON.stringify(event)});
    const first=await post();
    const second=await post();
    if(first.status!==201 || second.status!==201 || second.body.duplicate!==true) throw new Error(`Ingestion/idempotency failed; HTTP statuses ${first.status}/${second.status}`);
    console.log('ATLAS_INGEST_AND_IDEMPOTENCY PASS');
    const query='chargerId=demo-charger-01&from=2026-10-18T08%3A29%3A00Z&to=2026-10-18T08%3A31%3A00Z';
    const history=await json(`/api/v1/telemetry/history?${query}`);
    const latest=await json(`/api/v1/analytics/latest?${query}`);
    const current=await json(`/api/v1/analytics/current-averages?${query}`);
    if(history.status!==200 || !Array.isArray(history.body) || !history.body.some((i:any)=>i.eventId===eventId) ||
       latest.status!==200 || !Array.isArray(latest.body) || !latest.body.some((i:any)=>i.eventId===eventId) ||
       current.status!==200 || !Array.isArray(current.body) || !current.body.some((i:any)=>i.samples>=1))
      throw new Error('Atlas history/aggregation verification failed');
    console.log('ATLAS_HISTORY_AND_AGGREGATION PASS');
    const swagger=await fetch(base+'/docs-json');
    if(swagger.status!==200) throw new Error('Swagger JSON endpoint failed');
    console.log('ATLAS_OPENAPI PASS');
    console.log('ATLAS_END_TO_END PASS (one labeled synthetic sample retained for the demo)');
  } finally {await app.close();}
}
void main().catch(error=>{
  // Never log raw MongoDB errors, network URLs, headers or connection strings.
  const expected=error instanceof Error && /^(Run explicitly|Health\/readiness failed|Ingestion\/idempotency failed|Atlas history\/aggregation verification failed|Swagger JSON endpoint failed)/.test(error.message);
  console.error(`ATLAS_END_TO_END FAIL${expected?`: ${error.message}`:''}`);
  process.exitCode=1;
});
