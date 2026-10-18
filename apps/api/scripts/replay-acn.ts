import {isAbsolute,resolve} from 'node:path';
import {setTimeout as sleep} from 'node:timers/promises';
import {LocalAcnCsvAdapter, ReplayOptions} from '../src/adapters/acn.adapter';
import {loadLocalEnv} from '../src/config/config';
import {telemetrySchema, TelemetryInput} from '../src/telemetry/telemetry.schema';

type Args={files:string[];station:string;charger:string;execute:boolean;start?:string;speed:number;interval:number;maxEvents:number};
function parseArgs(args:string[]):Args {
  const result:Args={files:[],station:'demo-station-01',charger:'demo-charger-01',execute:false,speed:600,interval:60,maxEvents:120};
  for(let i=0;i<args.length;i++) {
    const name=args[i];
    if(name==='--execute') {result.execute=true;continue;}
    const value=args[++i];
    if(value===undefined) throw new Error('Missing option value');
    switch(name) {
      case '--file':result.files.push(value);break;
      case '--station':result.station=value;break;
      case '--charger':result.charger=value;break;
      case '--start-time':result.start=value;break;
      case '--speed':result.speed=Number(value);break;
      case '--min-interval-seconds':result.interval=Number(value);break;
      case '--max-events':result.maxEvents=Number(value);break;
      default:throw new Error('Unknown replay option');
    }
  }
  if(!result.files.length) result.files.push('data/raw/acn/sample_01.csv.gz');
  if(result.files.length>5) throw new Error('Maximum five local sessions per replay');
  if(result.execute && !result.start) throw new Error('--execute requires a fixed --start-time for reproducible retries');
  if(result.start && (!Number.isFinite(Date.parse(result.start)) || !/[zZ]|[+-]\d\d:\d\d$/.test(result.start)))
    throw new Error('--start-time must contain an explicit timezone');
  if(!/^[A-Za-z0-9][A-Za-z0-9_.:-]{0,63}$/.test(result.station) ||
     !/^[A-Za-z0-9][A-Za-z0-9_.:-]{0,63}$/.test(result.charger)) throw new Error('Invalid virtual asset identifier');
  return result;
}

async function postBatch(events:TelemetryInput[],key:string):Promise<void> {
  const response=await fetch('http://127.0.0.1:3001/api/v1/telemetry/batch',{
    method:'POST',headers:{'content-type':'application/json','x-api-key':key},
    body:JSON.stringify({events}),signal:AbortSignal.timeout(20000)
  });
  if(response.status!==201) throw new Error(`Local ingestion API returned HTTP ${response.status}`);
}

async function main() {
  const args=parseArgs(process.argv.slice(2));
  const options:ReplayOptions={replayStartedAt:new Date(args.start??Date.now()),speed:args.speed,minIntervalSeconds:args.interval,maxEvents:args.maxEvents};
  const adapter=new LocalAcnCsvAdapter();
  let apiKey:string|undefined;
  if(args.execute) {
    loadLocalEnv();
    apiKey=process.env.INGEST_API_KEY;
    if(!apiKey || apiKey.length<24) throw new Error('Set INGEST_API_KEY locally before executing replay');
  }
  let total=0;
  for(const file of args.files) {
    const localPath=isAbsolute(file)?file:resolve(__dirname,'../../..',file);
    let count=0;
    let batch:TelemetryInput[]=[];
    for await (const item of adapter.loadSession({localPath,virtualStationId:args.station,virtualChargerId:args.charger},options)) {
      const parsed=telemetrySchema.safeParse(item);
      if(!parsed.success) throw new Error('Generated replay reading failed validation');
      if(args.execute) {
        batch.push(parsed.data);
        if(batch.length>=10) {
          const delay=new Date(item.ts).getTime()-Date.now();
          if(delay>0) await sleep(delay);
          await postBatch(batch,apiKey!);
          batch=[];
        }
      }
      count++;
    }
    if(args.execute && batch.length) {
      const delay=new Date(batch[batch.length-1].ts).getTime()-Date.now();
      if(delay>0) await sleep(delay);
      await postBatch(batch,apiKey!);
    }
    total+=count;
    console.log(`ACN_SESSION ${count} downsampled readings ${args.execute?'INGESTED':'VALIDATED_DRY_RUN'}`);
  }
  console.log(`REPLAY ${args.execute?'PASS':'DRY_RUN_PASS'}: ${total} readings across ${args.files.length} locally held session(s)`);
}
void main().catch(error=>{
  // Avoid logging local filenames, raw records, connection strings or response bodies.
  console.error(`REPLAY FAIL: ${error instanceof Error ? error.message.replace(/https?:\/\/\S+/g,'[redacted-url]') : 'Unexpected error'}`);
  process.exitCode=1;
});
