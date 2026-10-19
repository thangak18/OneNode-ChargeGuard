import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createSocket} from 'node:dgram';
import {AddressInfo} from 'node:net';
import {once} from 'node:events';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {ObservabilityService,JsonFrameworkLogger,observabilityConfig} from '../src/observability/observability.service';
import type {TelemetryInput} from '../src/telemetry/telemetry.schema';

const event:TelemetryInput={eventId:'fixture',ts:new Date().toISOString(),meta:{stationId:'demo-station-01',chargerId:'demo-charger-01'},currentA:8.25,chargingState:'FAULT',faultCode:'OVERHEAT',provenance:{sourceType:'SYNTHETIC',fields:{currentA:'SYNTHETIC',chargingState:'SYNTHETIC',faultCode:'SYNTHETIC'}}};

test('DogStatsD UDP payloads cover ingestion, latency, current, one-hot status and one synthetic fault',async()=>{
  const server=createSocket('udp4');const packets:string[]=[];
  server.on('message',message=>packets.push(message.toString()));
  server.bind(0,'127.0.0.1');await once(server,'listening');
  const obs=new ObservabilityService({enabled:true,port:(server.address() as AddressInfo).port,env:'test',stdout:false});
  try {
    obs.ingestionRequest(201,12.5,false);obs.ingestionRequest(401,0.5,false);obs.accepted(event,false);obs.accepted(event,true);
    await obs.flush();
    // Yield to UDP receiver, bounded without relying on backend availability.
    for(let i=0;i<20 && packets.length<14;i++) await new Promise(resolve=>setTimeout(resolve,5));
    assert.ok(packets.some(p=>p.startsWith('chargeguard.ingestion.success:1|c|#service:chargeguard-api,env:test')));
    assert.ok(packets.some(p=>p.startsWith('chargeguard.ingestion.failure:1|c')));
    assert.ok(packets.some(p=>p.startsWith('chargeguard.ingestion.processing_ms:12.5|ms')));
    assert.ok(packets.some(p=>p.startsWith('chargeguard.charger.current_a:8.25|g')));
    const states=packets.filter(p=>p.startsWith('chargeguard.charger.operational_status:'));
    assert.equal(states.length,6);assert.equal(states.filter(p=>p.includes(':1|g')).length,1);
    assert.ok(states.find(p=>p.includes(':1|g'))?.includes('status:fault'));
    assert.equal(packets.filter(p=>p.startsWith('chargeguard.fault.simulated:')).length,1);
    assert.equal(packets.filter(p=>p.startsWith('chargeguard.telemetry.duplicate:')).length,1);
    assert.ok(packets.every(p=>!p.includes('event_id:') && !p.includes('fault_code:')));
  } finally {await obs.onModuleDestroy();server.close();}
});

test('unbounded asset IDs collapse to other and raw fields/errors never reach JSON logs',async()=>{
  const folder=await mkdtemp(join(tmpdir(),'chargeguard-obs-'));
  const path=join(folder,'api.jsonl');
  const obs=new ObservabilityService({enabled:false,port:8125,env:'test',stdout:false,logFile:path});
  try {
    obs.accepted({...event,meta:{stationId:'private-station',chargerId:'private-charger'}},false);
    obs.record('info','untrusted mongodb+srv://secret:secret@example', {password:'secret',url:'private',source:'private',status_code:201});
    new JsonFrameworkLogger(obs).error(new Error('mongodb+srv://secret:secret@example'),{headers:{authorization:'secret'}});
    const raw=await readFile(path,'utf8');
    assert.equal(/secret|private|password|authorization|mongodb/.test(raw),false);
    const rows=raw.trim().split('\n').map(line=>JSON.parse(line));
    assert.ok(rows.some(r=>r.asset_scope==='other'));
    assert.ok(rows.every(r=>r.service==='chargeguard-api' && r.env==='test' && r.timestamp));
  } finally {await obs.onModuleDestroy();await rm(folder,{recursive:true,force:true});}
});

test('observability config is opt-in, local-only, bounded, and rejects injected tag values',()=>{
  assert.equal(observabilityConfig({}).enabled,false);
  for(const input of [{DD_AGENT_HOST:'remote.example'}, {DD_ENV:'dev,secret:value'}, {DD_DOGSTATSD_PORT:'99999'}, {DD_METRICS_ENABLED:'maybe'}, {CHARGEGUARD_LOG_FILE:'relative.log'}]) assert.throws(()=>observabilityConfig(input));
});

test('unknown assets never become metric tag values and reported faults are not simulated faults',async()=>{
  const server=createSocket('udp4');const packets:string[]=[];
  server.on('message',message=>packets.push(message.toString()));server.bind(0,'127.0.0.1');await once(server,'listening');
  const obs=new ObservabilityService({enabled:true,port:(server.address() as AddressInfo).port,env:'test',stdout:false});
  try {
    obs.accepted({...event,meta:{stationId:'unbounded-private-station',chargerId:'unbounded-private-charger'},provenance:{sourceType:'DERIVED',fields:{currentA:'SOURCE_REPORTED',chargingState:'SOURCE_REPORTED',faultCode:'SOURCE_REPORTED'}}},false);
    await obs.flush();
    for(let i=0;i<20 && packets.length<8;i++) await new Promise(resolve=>setTimeout(resolve,5));
    assert.equal(packets.length,8);
    assert.ok(packets.every(p=>!p.includes('unbounded-private')));
    assert.ok(packets.some(p=>p.includes('asset_scope:other')));
    assert.ok(!packets.some(p=>p.startsWith('chargeguard.fault.simulated:')));
  } finally {await obs.onModuleDestroy();server.close();}
});

test('shutdown is safe when enabled without any datagrams and when called again',async()=>{
  const obs=new ObservabilityService({enabled:true,port:8125,env:'test',stdout:false});
  await obs.onModuleDestroy();
  await obs.onModuleDestroy();
});

test('incident correlation accepts generated demo context but rejects arbitrary identifiers',async()=>{
  const folder=await mkdtemp(join(tmpdir(),'chargeguard-correlation-'));const path=join(folder,'api.jsonl');
  const obs=new ObservabilityService({enabled:false,port:8125,env:'test',stdout:false,logFile:path});
  try {
    obs.accepted({...event,eventId:'b2-58a1983cae09-100-1'},false);
    obs.record('info','demo.action',{incident_id:'private-secret',demo_id:'private-secret',charger_id:'private-secret',station_id:'private-secret'});
    const raw=await readFile(path,'utf8');assert.equal(raw.includes('private-secret'),false);
    const records=raw.trim().split('\n').map(line=>JSON.parse(line));
    const fault=records.find(record=>record.message==='fault.simulated');
    assert.equal(fault.incident_id,'demo-58a1983cae09');assert.equal(fault.demo_id,'58a1983cae09');assert.equal(fault.charger_id,'demo-charger-01');
  } finally {await obs.onModuleDestroy();await rm(folder,{recursive:true,force:true});}
});
