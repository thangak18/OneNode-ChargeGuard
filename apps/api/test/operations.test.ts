import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {demoReading} from '../src/observability/demo-scenario';
import {telemetrySchema} from '../src/telemetry/telemetry.schema';
const config=resolve(__dirname,'../../../config/datadog');
test('incident fixture produces five valid virtual readings and explicit synthetic fault/recovery',()=>{
  for(let charger=1;charger<=5;charger++) {
    const normal=demoReading('123456abcdef',0,charger,false);
    assert.ok(telemetrySchema.safeParse(normal).success);assert.equal(normal.currentA,8.25);
    const fault=demoReading('123456abcdef',1,charger,true);
    assert.ok(telemetrySchema.safeParse(fault).success);assert.equal(fault.currentA,0);assert.equal(fault.provenance.fields.faultCode,'SYNTHETIC');
    assert.notEqual(normal.eventId,fault.eventId);assert.equal(normal.faultCode,undefined);
  }
  assert.throws(()=>demoReading('private',1,1,false));assert.throws(()=>demoReading('123456abcdef',1,6,false));
});
test('dashboard uses implemented names, five bounded chargers, and no notification recipients',()=>{
  const dashboard=JSON.parse(readFileSync(resolve(config,'chargeguard-operations.dashboard.json'),'utf8'));
  assert.equal(dashboard.title,'ChargeGuard Operations Dashboard');assert.deepEqual(dashboard.notify_list,[]);
  const allowed=new Set(['ingestion.success','ingestion.failure','ingestion.processing_ms.avg','ingestion.processing_ms.95percentile','charger.current_a','charger.operational_status','fault.simulated']);
  const queries=dashboard.widgets.flatMap((w:any)=>w.definition.requests??[]).flatMap((r:any)=>r.queries??[]).map((q:any)=>q.query) as string[];
  for(const query of queries){for(const name of query.matchAll(/chargeguard\.([a-z0-9_.]+)/g))assert.ok(allowed.has(name[1]));assert.ok(query.includes('service:chargeguard-api,env:dev'));}
  for(let i=1;i<=5;i++)assert.ok(queries.some(q=>q.includes(`charger_id:demo-charger-${String(i).padStart(2,'0')}`)));
});
test('demo count monitors have explicit one-minute thresholds and no recipients or no-data claims',()=>{
  for(const name of ['ingestion-errors','synthetic-faults']) {
    const monitor=JSON.parse(readFileSync(resolve(config,'monitors',name+'.json'),'utf8'));
    assert.ok(monitor.query.startsWith('sum(last_1m):'));assert.ok(monitor.query.endsWith('.as_count() >= 1'));
    assert.equal(monitor.options.thresholds.critical,1);assert.equal(monitor.options.require_full_window,false);
    assert.equal(monitor.options.on_missing_data,'default');assert.ok(!monitor.message.includes('@'));
    assert.ok(monitor.message.includes('DEMONSTRATION ONLY'));
  }
});
