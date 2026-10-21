import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseService } from '../src/database/database.service';
import { observabilityConfig } from '../src/observability/observability.service';

test('readiness coalesces concurrent reconnect attempts and reports failure securely', async()=>{
  const service=new DatabaseService({mongoUri:'unused',mongoDatabase:'chargeguard',nodeEnv:'test',port:3001});
  let calls=0;
  const internals=service as unknown as {open:()=>Promise<void>;connection:unknown};
  internals.open=async()=>{calls++; await new Promise(resolve=>setTimeout(resolve,10)); throw new Error('private driver detail');};
  assert.deepEqual(await Promise.all([service.ping(),service.ping(),service.ping()]),[false,false,false]);
  assert.equal(calls,1);
  assert.throws(()=>service.db(), /Database unavailable/);
  internals.open=async()=>{calls++;internals.connection={admin:()=>({ping:async()=>({ok:1})})};};
  assert.equal(await service.ping(),true);
  assert.equal(calls,2);
  assert.equal(await service.ping(),true);
  assert.equal(calls,2);
  await service.onModuleDestroy();
});
test('Vercel rejects local Agent/file sinks and permits sanitized stdout',()=>{
  assert.throws(()=>observabilityConfig({VERCEL:'1',DD_METRICS_ENABLED:'true'}), /Local Agent/);
  assert.throws(()=>observabilityConfig({VERCEL:'1',CHARGEGUARD_LOG_FILE:'/tmp/log'}), /Local Agent/);
  assert.equal(observabilityConfig({VERCEL:'1',DD_ENV:'prod'}).enabled,false);
});
