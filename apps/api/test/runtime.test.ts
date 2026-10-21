import test from 'node:test';
import assert from 'node:assert/strict';
import { isHostedRuntime, listenHost } from '../src/config/runtime';
import { DatabaseService } from '../src/database/database.service';
import { observabilityConfig } from '../src/observability/observability.service';

test('only explicit platform flags permit external binding; local remains loopback',()=>{
  assert.equal(listenHost({}),'127.0.0.1');
  assert.equal(listenHost({NODE_ENV:'production'}),'127.0.0.1');
  assert.equal(listenHost({RENDER:'true'}),'0.0.0.0');
  assert.equal(listenHost({VERCEL:'1'}),'0.0.0.0');
  assert.equal(isHostedRuntime({RENDER:'false'}),false);
});
test('Render startup binds without waiting on Atlas; readiness remains false until successful connection',async()=>{
  const previous=process.env.RENDER;process.env.RENDER='true';
  try {
    const service=new DatabaseService({mongoUri:'unused',mongoDatabase:'chargeguard',nodeEnv:'production',port:10000});
    let calls=0;
    (service as unknown as {open:()=>Promise<void>}).open=async()=>{calls++;throw new Error('unavailable');};
    await service.onModuleInit();assert.equal(calls,0);
    assert.equal(await service.ping(),false);assert.equal(calls,1);
    await service.onModuleDestroy();
  } finally {if(previous===undefined)delete process.env.RENDER;else process.env.RENDER=previous;}
});
test('Render rejects loopback Agent and ephemeral file log configuration',()=>{
  assert.throws(()=>observabilityConfig({RENDER:'true',DD_METRICS_ENABLED:'true'}),/Local Agent/);
  assert.throws(()=>observabilityConfig({RENDER:'true',CHARGEGUARD_LOG_FILE:'/tmp/log'}),/Local Agent/);
  assert.equal(observabilityConfig({RENDER:'true',DD_ENV:'prod'}).enabled,false);
});
