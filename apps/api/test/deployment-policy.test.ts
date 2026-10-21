import { test } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import request from 'supertest';
import { deploymentPolicy } from '../src/common/deployment-policy';
const key = 'unit-test-only-service-key-0123456789';
function application() {
  const app=express();
  app.use(deploymentPolicy({NODE_ENV:'production',BFF_READ_API_KEY:key}));
  app.all('/api/v1/chargers', (_req,res)=>res.json({ok:true}));
  return app;
}
test('production requires service configuration and protects reads before controllers', async()=>{
  assert.throws(()=>deploymentPolicy({NODE_ENV:'production'}), /BFF_READ_API_KEY/);
  const app=application();
  await request(app).get('/api/v1/chargers').expect(401);
  await request(app).get('/api/v1/chargers').set('x-chargeguard-read-key','incorrect').expect(401);
  await request(app).get('/api/v1/chargers').set('x-chargeguard-read-key',key).expect(200).expect('Cache-Control','no-store');
});
test('production denies mutations even with valid service key and hides Swagger', async()=>{
  const app=application();
  for (const method of ['post','put','patch','delete'] as const) await request(app)[method]('/api/v1/chargers').set('x-chargeguard-read-key',key).expect(403);
  await request(app).get('/docs').set('x-chargeguard-read-key',key).expect(404);
  await request(app).get('/docs-json').expect(404);
  const res=await request(app).get('/api/v1/chargers').set('Origin','https://untrusted.example');
  assert.equal(res.headers['access-control-allow-origin'],undefined);
});
