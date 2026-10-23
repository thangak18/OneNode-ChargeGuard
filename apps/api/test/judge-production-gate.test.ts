import {test} from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import request from 'supertest';
import {deploymentPolicy} from '../src/common/deployment-policy';
import {isScopedJudgeWrite,PRODUCTION_JUDGE_RUN,PRODUCTION_JUDGE_OWNER,PRODUCTION_JUDGE_ORIGIN} from '../src/common/judge-production-gate';

const config={NODE_ENV:'production',BFF_READ_API_KEY:'r'.repeat(64),INGEST_API_KEY:'i'.repeat(64),
 OPERATOR_ASSERTION_SECRET:'s'.repeat(64),JUDGE_WRITE_API_KEY:'w'.repeat(64),OPERATOR_ORIGIN:PRODUCTION_JUDGE_ORIGIN,
 OPERATOR_GITHUB_IDS:PRODUCTION_JUDGE_OWNER,JUDGE_PROD_WRITES_ENABLED:'true',JUDGE_REARM_ENABLED:'true',JUDGE_ROUTES_ENABLED:'true'};
function app(env:NodeJS.ProcessEnv){const app=express();app.use(deploymentPolicy(env));app.all(/.*/,(_req,res)=>res.status(418).json({reached:true}));return app;}
test('default denies all production writes before application routes',async()=>{
 const p=app({...config,JUDGE_PROD_WRITES_ENABLED:'false'});
 await request(p).post(`/api/v1/judge/runs/${PRODUCTION_JUDGE_RUN}/fault`).send({}).expect(403);
});
test('scoped opt-in passes only reviewed Judge paths; legacy and alternate methods stay 403',async()=>{
 const p=app(config);
 for(const op of ['fault','acknowledge','recover','resolve','reset']) {
  const path=`/api/v1/judge/runs/${PRODUCTION_JUDGE_RUN}/${op}`;
  assert.equal(isScopedJudgeWrite(config,'POST',path),true);
  await request(p).post(path).send({}).expect(418);
  await request(p).post(`${path}?unexpected=1`).send({}).expect(403);
  for(const method of ['put','patch','delete'] as const)await request(p)[method](path).send({}).expect(403);
 }
 for(const path of ['/api/v1/telemetry','/api/v1/demo/reset','/api/v1/incidents/demo-58a1983cae09/resolve',
  '/api/v1/judge/runs','/api/v1/judge/runs/judge-'+'0'.repeat(24)+'/fault',
  `/api/v1/judge/runs/${PRODUCTION_JUDGE_RUN}/create`, `/api/v1/judge/runs/${PRODUCTION_JUDGE_RUN}/fault/other`])
   await request(p).post(path).send({}).expect(403);
 for(const [key,value] of Object.entries({JUDGE_ROUTES_ENABLED:'false',OPERATOR_GITHUB_IDS:'999',
   OPERATOR_ORIGIN:'https://evil.example.test',JUDGE_WRITE_API_KEY:config.BFF_READ_API_KEY}))
  await request(app({...config,[key]:value})).post(`/api/v1/judge/runs/${PRODUCTION_JUDGE_RUN}/fault`).send({}).expect(403);
});

test('re-arm requires its own opt-in even when the four lifecycle actions are enabled',async()=>{
 const env={...config,JUDGE_REARM_ENABLED:'false'};
 await request(app(env)).post(`/api/v1/judge/runs/${PRODUCTION_JUDGE_RUN}/reset`).send({}).expect(403);
 await request(app(env)).post(`/api/v1/judge/runs/${PRODUCTION_JUDGE_RUN}/fault`).send({}).expect(418);
 await request(app({...config,JUDGE_WRITE_API_KEY:config.OPERATOR_ASSERTION_SECRET})).post(`/api/v1/judge/runs/${PRODUCTION_JUDGE_RUN}/fault`).send({}).expect(403);
});
