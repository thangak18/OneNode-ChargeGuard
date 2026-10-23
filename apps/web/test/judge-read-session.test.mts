import {test} from 'node:test';
import assert from 'node:assert/strict';
import {NextRequest} from 'next/server.js';
import {encode} from 'next-auth/jwt';
import {verifiedJudgeReadSession} from '../src/lib/judge-read-session.mts';

const env={NEXTAUTH_URL:'https://web.example.test',NEXTAUTH_SECRET:'test-session-secret-abcdefghijklmnopqrstuvwxyz',OPERATOR_GITHUB_IDS:'123'};
async function signedRequest(id='123',secret=env.NEXTAUTH_SECRET,maxAge=60){
 const token=await encode({token:{operatorId:id},secret,maxAge});
 const req=new NextRequest(env.NEXTAUTH_URL+'/api/judge/runs');
 req.cookies.set('__Secure-next-auth.session-token',token);
 return req;
}
test('judge read identity is derived from actual signed NextAuth cookie',async()=>{
 assert.equal(await verifiedJudgeReadSession(await signedRequest(),env),'123');
 for(const req of [await signedRequest('456'),await signedRequest('123','wrong-secret'),await signedRequest('123',env.NEXTAUTH_SECRET,-60),new NextRequest(env.NEXTAUTH_URL)]){
  assert.equal(await verifiedJudgeReadSession(req,env),null);
 }
 const bearer=await signedRequest();bearer.headers.set('authorization','Bearer spoofed');
 assert.equal(await verifiedJudgeReadSession(bearer,env),null);
 assert.equal(await verifiedJudgeReadSession(await signedRequest(),{...env,OPERATOR_GITHUB_IDS:'456'}),null);
});
