import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {gzipSync} from 'node:zlib';
import {LocalAcnCsvAdapter} from '../src/adapters/acn.adapter';
import {telemetrySchema} from '../src/telemetry/telemetry.schema';

const header=',Charging Current (A),Actual Pilot (A),Voltage (V),Charging State,Energy Delivered (kWh),Power (kW)';
const rows=[
  '2026-01-01T00:00:00+00:00,10,,,ADAPTIVE,1,',
  '2026-01-01T00:00:10+00:00,11,,,ADAPTIVE,1.1,',
  '2026-01-01T00:01:10+00:00,0,,,UNPLUGGED,0,',
  '2026-01-01T00:02:10+00:00,4,,,READY,0.3,'
];
test('bounded deterministic ACN replay preserves provenance and energy reset flags',async()=>{
  const folder=await mkdtemp(join(tmpdir(),'chargeguard-acn-fixture-'));
  const localPath=join(folder,'fixture.csv.gz');
  try {
    await writeFile(localPath,gzipSync([header,...rows].join('\n')));
    const adapter=new LocalAcnCsvAdapter();
    const ref={localPath,virtualStationId:'test-station',virtualChargerId:'test-charger'};
    const options={replayStartedAt:new Date('2026-10-18T05:00:00Z'),speed:60,minIntervalSeconds:60,maxEvents:3};
    const run=async()=>{const results=[];for await(const item of adapter.loadSession(ref,options)) results.push(item);return results;};
    const first=await run();
    const second=await run();
    assert.deepEqual(first,second);
    assert.equal(first.length,3);
    assert.deepEqual(first.map(x=>x.currentA),[10,0,4]);
    assert.equal(first[0].ts,'2026-10-18T05:00:00.000Z');
    assert.equal(first[1].ts,'2026-10-18T05:00:01.166Z');
    assert.equal(first[1].sourceEventAt,'2026-01-01T00:01:10.000Z');
    assert.deepEqual(first[1].qualityFlags,['ENERGY_COUNTER_DECREASE']);
    assert.equal(first[0].powerKW,undefined);
    assert.equal(first[0].temperatureC,undefined);
    assert.equal(first[0].voltageV,undefined);
    assert.equal(first[0].provenance.fields.chargingState,'DERIVED');
    assert.ok(first.every(x=>telemetrySchema.safeParse(x).success));
    const limited=[];for await(const item of adapter.loadSession(ref,{...options,maxEvents:1})) limited.push(item);
    assert.equal(limited.length,1);
  } finally {await rm(folder,{recursive:true,force:true});}
});
