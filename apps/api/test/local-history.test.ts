import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {gzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {readLocalHistory,ACN_REVISION} from '../src/adapters/local-history';
import {requireAcnCloudPermission} from '../src/adapters/acn-permission';
import {LocalAcnCsvAdapter} from '../src/adapters/acn.adapter';
const header=',Charging Current (A),Actual Pilot (A),Voltage (V),Charging State,Energy Delivered (kWh),Power (kW)';
async function fixture() {
  const root=await mkdtemp(join(tmpdir(),'chargeguard-local-history-'));const folder=join(root,'data/raw/acn');await mkdir(folder,{recursive:true});
  const files=[];
  for(let i=1;i<=5;i++) {
    const content=gzipSync(`${header}\n2020-01-01T00:00:00Z,${i},,,ADAPTIVE,1,\n2020-01-01T00:01:00Z,0,,,UNPLUGGED,0,\n2020-01-01T00:02:00Z,${i+1},,,READY,0.2,\n`);
    const name=`sample_0${i}.csv.gz`;await writeFile(join(folder,name),content);
    files.push({local_file:name,source_path:`fixture-evse-2020-01-0${i}T00-00-00.csv.gz`,sha256:createHash('sha256').update(content).digest('hex'),bytes:content.length,rows:3});
  }
  await writeFile(join(folder,'manifest.local.json'),JSON.stringify({commit:ACN_REVISION,files}));return{root,folder,files};
}
test('local preview is deterministic, source-clock-preserving and content-addressed without cloud fields',async()=>{
  const f=await fixture();try {
    const first=await readLocalHistory(f.root,'sample_01',600);const again=await readLocalHistory(f.root,'sample_01',600);
    assert.deepEqual(first,again);assert.equal(first.rowsParsed,3);assert.equal(first.pointsEmitted,3);assert.equal(first.uniqueExportedEvseIds,1);
    assert.equal(first.physicalIdentityVerified,false);assert.equal(first.points[1].sourceEventAt,'2020-01-01T00:01:00.000Z');
    assert.equal(first.points[1].replayAt,'2026-10-19T00:00:00.100Z');assert.equal(first.points[1].sourceEnergyKWh,0);
    assert.deepEqual(first.points[1].qualityFlags,['ENERGY_COUNTER_DECREASE']);assert.equal(first.points[0].provenance.fields.chargingState,'DERIVED');
    assert.equal(first.points[0].provenance.fields.currentA,'MEASURED');assert.ok(!/voltageV|temperatureC|powerKW|faultCode|source_path|fixture-evse/.test(JSON.stringify(first)));
    const other=await readLocalHistory(f.root,'sample_02');assert.notEqual(first.points[0].eventId,other.points[0].eventId);
    const faster=await readLocalHistory(f.root,'sample_01',3600);assert.equal(faster.points[0].eventId,first.points[0].eventId);assert.equal(faster.points[1].sourceEventAt,first.points[1].sourceEventAt);
    assert.equal(first.permissions.cloudProcessing,'NOT_AUTHORIZED');
  } finally {await rm(f.root,{recursive:true,force:true});}
});
test('local preview rejects traversal, unbounded speeds and changed source hashes',async()=>{
  const f=await fixture();try {
    await assert.rejects(()=>readLocalHistory(f.root,'../../.env'));await assert.rejects(()=>readLocalHistory(f.root,'sample_01',0));
    await writeFile(join(f.folder,'sample_01.csv.gz'),gzipSync('changed source'));await assert.rejects(()=>readLocalHistory(f.root,'sample_01'),/checksum/);
  } finally {await rm(f.root,{recursive:true,force:true});}
});
test('cloud permission guard fails closed for missing, incomplete or uncovered approvals',async()=>{
  const f=await fixture();const permit=join(f.root,'permission.local.json');const file=join(f.folder,'sample_01.csv.gz');
  try {
    await assert.rejects(()=>requireAcnCloudPermission(permit,[file]),/blocked/);
    await writeFile(permit,JSON.stringify({status:'OWNER_CONFIRMED',revision:ACN_REVISION,evidenceReference:'SYNTHETIC TEST FIXTURE ONLY',allowedUses:['atlas-processing'],sha256:[f.files[0].sha256]}));
    await assert.rejects(()=>requireAcnCloudPermission(permit,[file]),/scope/);
    const approval=JSON.parse(await readFile(permit,'utf8'));approval.allowedUses.push('datadog-processing');await writeFile(permit,JSON.stringify(approval));
    await requireAcnCloudPermission(permit,[file]);
    await assert.rejects(()=>requireAcnCloudPermission(permit,[join(f.folder,'sample_02.csv.gz')]),/outside/);
  } finally {await rm(f.root,{recursive:true,force:true});}
});
test('adapter rejects duplicate headers, corrupt gzip and bad skipped rows without stream leaks',async()=>{
  const f=await fixture();const file=join(f.root,'fixture.csv.gz');const adapter=new LocalAcnCsvAdapter();
  const consume=async()=>{for await(const item of adapter.loadSession({localPath:file,virtualStationId:'test',virtualChargerId:'test'},{replayStartedAt:new Date('2026-01-01T00:00:00Z'),speed:600,minIntervalSeconds:60,maxEvents:100}))void item;};
  try {
    await writeFile(file,gzipSync(header+',Charging Current (A)\n'));await assert.rejects(consume,/Duplicate/);
    await writeFile(file,'invalid gzip bytes');await assert.rejects(consume);
    await writeFile(file,gzipSync(`${header}\n2020-01-01T00:00:00Z,1,,,READY,0,\n2020-01-01T00:00:04Z,-1,,,READY,0,`));await assert.rejects(consume,/current/);
  } finally {await rm(f.root,{recursive:true,force:true});}
});

test('the local historical reader never fetches source or cloud URLs',async()=>{
  const f=await fixture();const originalFetch=globalThis.fetch;let calls=0;
  globalThis.fetch=async()=>{calls++;throw new Error('Network must not be used by local reader');};
  try {const preview=await readLocalHistory(f.root,'sample_01');assert.equal(preview.rowsParsed,3);assert.equal(calls,0);}
  finally {globalThis.fetch=originalFetch;await rm(f.root,{recursive:true,force:true});}
});
