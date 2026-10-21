import 'reflect-metadata';
import test from 'node:test';
import assert from 'node:assert/strict';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { configureApplication } from '../src/bootstrap';
import { HealthController } from '../src/health/health.controller';
import { DatabaseService } from '../src/database/database.service';
import { ObservabilityService } from '../src/observability/observability.service';

test('production Nest bootstrap enforces auth before DB and keeps liveness available during outage', async()=>{
  const previous={NODE_ENV:process.env.NODE_ENV,VERCEL:process.env.VERCEL,BFF_READ_API_KEY:process.env.BFF_READ_API_KEY};
  const key='integration-test-only-read-key-0123456789';
  Object.assign(process.env,{NODE_ENV:'production',VERCEL:'1',BFF_READ_API_KEY:key});
  let calls=0;
  const module=await Test.createTestingModule({controllers:[HealthController],providers:[
    {provide:DatabaseService,useValue:{ping:async()=>{calls++;return false;}}},
    {provide:ObservabilityService,useValue:{record:()=>{},ingestionRequest:()=>{}}},
  ]}).compile();
  const app=configureApplication(module.createNestApplication());
  try {
    await app.init();const server=app.getHttpServer();
    await request(server).get('/api/v1/health/live').expect(401);
    await request(server).get('/api/v1/health/live').set('x-chargeguard-read-key',key).expect(200);
    await request(server).post('/api/v1/demo/trigger-fault').set('x-chargeguard-read-key',key).expect(403);
    await request(server).get('/docs-json').expect(404);
    await request(server).get('/api/v1/health/atlas-diagnostics').expect(401);
    await request(server).get('/api/v1/health/atlas-diagnostics').set('x-chargeguard-read-key',key).expect(404);
    assert.equal(calls,0);
    const response=await request(server).get('/api/v1/health/ready').set('x-chargeguard-read-key',key).set('Origin','https://untrusted.example').expect(503);
    assert.equal(response.body.message,'Database unavailable');
    assert.equal(response.headers['access-control-allow-origin'],undefined);
    assert.equal(calls,1);
  } finally {
    await app.close();
    for(const [key,value] of Object.entries(previous)) if(value===undefined)delete process.env[key];else process.env[key]=value;
  }
});
