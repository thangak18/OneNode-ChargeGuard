import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomBytes,createHash} from 'node:crypto';
import {SignJWT} from 'jose';
import {verifyOperatorAssertion,type BoundAction,type OperatorPolicy} from '../src/common/operator-preflight';
const policy:OperatorPolicy={secret:randomBytes(32),issuer:'https://web.example.test',audience:'chargeguard-api',origin:'https://web.example.test',githubIds:new Set(['123'])};
const action:BoundAction={expectedRevision:0,expectedCycle:1,operation:'fault',method:'POST',path:'/api/v1/judge/runs/judge-'+'a'.repeat(24)+'/fault',body:Buffer.from('{"chargerIndex":1}'),origin:policy.origin,stationId:'demo-station-01',chargerId:'demo-charger-01',runId:'judge-'+'a'.repeat(24)};
async function sign(overrides:Record<string,unknown>={},secret=policy.secret,alg='HS256'){
 const now=Math.floor(Date.now()/1000);
 return new SignJWT({iss:policy.issuer,aud:policy.audience,sub:'github:123',iat:now,exp:now+30,jti:'b'.repeat(32),expectedRevision:action.expectedRevision,expectedCycle:action.expectedCycle,operation:action.operation,method:action.method,path:action.path,bodySha256:createHash('sha256').update(action.body).digest('hex'),stationId:action.stationId,chargerId:action.chargerId,runId:action.runId,...overrides}).setProtectedHeader({alg}).sign(secret);
}
test('operator preflight accepts exact short-lived route/body/resource-bound assertion',async()=>{
 const result=await verifyOperatorAssertion(await sign(),action,policy);assert.equal(result.subject,'github:123');assert.equal(result.operation,'fault');
});
test('operator preflight rejects wrong signer, algorithm, issuer, audience, user and time',async()=>{
 const now=Math.floor(Date.now()/1000);
 for(const overrides of [{iss:'https://other.example.test'},{aud:'other'},{sub:'github:999'},{iat:now+5,exp:now+30},{exp:now-1},{exp:now+61},{jti:'invalid'}]) await assert.rejects(verifyOperatorAssertion(await sign(overrides),action,policy),/assertion rejected/);
 await assert.rejects(verifyOperatorAssertion(await sign({},randomBytes(32)),action,policy));
 await assert.rejects(verifyOperatorAssertion(await sign({},randomBytes(64),'HS384'),action,policy));
});
test('operator preflight denies body, scope, path, method, cross-origin and Phase D tampering',async()=>{
 const token=await sign();
 for(const change of [{body:Buffer.from('{}')},{origin:'https://untrusted.example.test'},{stationId:'other'},{chargerId:'demo-charger-06'},{runId:'old-run'},{path:'/api/v1/telemetry'},{operation:'reset' as const},{method:'DELETE' as never},{incidentId:'demo-58a1983cae09'}]) await assert.rejects(verifyOperatorAssertion(token,{...action,...change},policy));
 for(const overrides of [{expectedRevision:1},{expectedCycle:2},{operation:'reset'},{runId:'judge-'+'c'.repeat(24)},{bodySha256:'0'.repeat(64)},{incidentId:'demo-111111111111'}]) await assert.rejects(verifyOperatorAssertion(await sign(overrides),action,policy));
 await assert.rejects(verifyOperatorAssertion(token,action,{...policy,secret:randomBytes(16)}));
});
