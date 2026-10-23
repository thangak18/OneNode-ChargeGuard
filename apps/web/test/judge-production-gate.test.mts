import {test} from 'node:test';
import assert from 'node:assert/strict';
import {canEnableProductionJudgeWrites,mayWriteJudgeAction,JUDGE_PRODUCTION_RUN,JUDGE_PRODUCTION_OWNER} from '../src/lib/judge-production-gate.mts';

const configured={NODE_ENV:'production',NEXTAUTH_URL:'https://chargeguard-web.vercel.app',NEXTAUTH_SECRET:'s'.repeat(64),
 OPERATOR_ASSERTION_SECRET:'a'.repeat(64),JUDGE_WRITE_API_KEY:'w'.repeat(64),NEST_READ_API_KEY:'r'.repeat(64),
 NEST_API_KEY:'i'.repeat(64),JUDGE_PROD_WRITES_ENABLED:'true',JUDGE_REARM_ENABLED:'true',JUDGE_ROUTES_ENABLED:'true'};
test('production judge gate requires explicit dual opt-in, exact owner, and distinct write key',()=>{
 assert.equal(canEnableProductionJudgeWrites({},JUDGE_PRODUCTION_OWNER),false);
 assert.equal(canEnableProductionJudgeWrites(configured,JUDGE_PRODUCTION_OWNER),true);
 for(const [key,value] of Object.entries({JUDGE_PROD_WRITES_ENABLED:'false',JUDGE_ROUTES_ENABLED:'false',
  NEXTAUTH_URL:'https://evil.example.test',NEXTAUTH_SECRET:'short',OPERATOR_ASSERTION_SECRET:'short',
  JUDGE_WRITE_API_KEY:configured.NEST_READ_API_KEY})) {
  assert.equal(canEnableProductionJudgeWrites({...configured,[key]:value},JUDGE_PRODUCTION_OWNER),false,key);
 }
 assert.equal(canEnableProductionJudgeWrites(configured,'999'),false);
});
test('production is restricted to five actions on exactly one run',()=>{
 const off={...configured,JUDGE_PROD_WRITES_ENABLED:'false'};
 for(const op of ['fault','acknowledge','recover','resolve','reset']) {
  assert.equal(mayWriteJudgeAction(configured,JUDGE_PRODUCTION_OWNER,JUDGE_PRODUCTION_RUN,op),true,op);
  assert.equal(mayWriteJudgeAction(off,JUDGE_PRODUCTION_OWNER,JUDGE_PRODUCTION_RUN,op),false,op);
  assert.equal(mayWriteJudgeAction(configured,JUDGE_PRODUCTION_OWNER,'judge-'+'0'.repeat(24),op),false,op);
  assert.equal(mayWriteJudgeAction(configured,'456',JUDGE_PRODUCTION_RUN,op),false,op);
 }
 for(const op of ['create','ingest','trigger-fault','reset/all','FAULT'])assert.equal(mayWriteJudgeAction(configured,JUDGE_PRODUCTION_OWNER,JUDGE_PRODUCTION_RUN,op),false);
});

test('re-arm is an independent permission and write credentials cannot equal signing secrets',()=>{
 assert.equal(mayWriteJudgeAction({...configured,JUDGE_REARM_ENABLED:'false'},JUDGE_PRODUCTION_OWNER,JUDGE_PRODUCTION_RUN,'reset'),false);
 assert.equal(mayWriteJudgeAction({...configured,JUDGE_REARM_ENABLED:'false'},JUDGE_PRODUCTION_OWNER,JUDGE_PRODUCTION_RUN,'fault'),true);
 for(const secret of [configured.OPERATOR_ASSERTION_SECRET,configured.NEXTAUTH_SECRET])assert.equal(canEnableProductionJudgeWrites({...configured,JUDGE_WRITE_API_KEY:secret},JUDGE_PRODUCTION_OWNER),false);
});
