import {test} from 'node:test';import assert from 'node:assert/strict';import {cloudIntakeCheck} from '../scripts/cloud-intake-check';
test('one-shot intake defaults to dry-run with zero requests',async()=>{let calls=0;const r=await cloudIntakeCheck({},[],async()=>{calls++;throw new Error();});assert.equal(r.mode,'DRY_RUN');assert.equal(calls,0);});
test('one-shot refuses unconfirmed trial, expired approval and continuous sending',async()=>{
 for(const extra of [{},{DD_TRIAL_SCOPE_CONFIRMED:'true',DD_INTAKE_APPROVED_UNTIL:'2000-01-01'},{DD_TRIAL_SCOPE_CONFIRMED:'true',DD_INTAKE_APPROVED_UNTIL:new Date(Date.now()+60000).toISOString(),DD_CLOUD_ENABLED:'true'}])await assert.rejects(cloudIntakeCheck({DD_API_KEY:'test-only-key-abcdefghijkl',...extra},['--send'],async()=>{throw new Error('must not send')}));
});
test('one-shot sends at most one log and one gauge without retries',async()=>{
 const seen:any[]=[];const env={DD_API_KEY:'test-only-key-abcdefghijkl',DD_TRIAL_SCOPE_CONFIRMED:'true',DD_INTAKE_APPROVED_UNTIL:new Date(Date.now()+60000).toISOString()};
 const r=await cloudIntakeCheck(env,['--send'],async(url,init)=>{seen.push({url:String(url),body:JSON.parse(String(init?.body))});return new Response(null,{status:202});});assert.equal(seen.length,2);assert.equal(seen[0].body.length,1);assert.equal(seen[1].body.series.length,1);assert.equal(r.searchableArrivalVerified,false);
 let calls=0;await cloudIntakeCheck(env,['--send'],async()=>{calls++;return new Response(null,{status:429});});assert.equal(calls,1);
});
