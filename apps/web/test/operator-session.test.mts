import {NextRequest} from 'next/server.js';
import {test} from 'node:test';import assert from 'node:assert/strict';import {encode} from 'next-auth/jwt';import {verifiedOperatorSession} from '../src/lib/operator-session.mts';
const env={NEXTAUTH_URL:'https://web.example.test',NEXTAUTH_SECRET:'test-session-secret-abcdefghijklmnopqrstuvwxyz',OPERATOR_GITHUB_IDS:'123'};
async function req(id='123',secret=env.NEXTAUTH_SECRET,maxAge=60){const token=await encode({token:{operatorId:id},secret,maxAge});const request=new NextRequest(env.NEXTAUTH_URL+'/api/judge',{method:'POST',headers:{origin:env.NEXTAUTH_URL,'sec-fetch-site':'same-origin','content-type':'application/json'}});request.cookies.set('__Secure-next-auth.session-token',token);return request;}
test('actual NextAuth encrypted secure cookie derives allowed GitHub ID',async()=>{assert.equal(await verifiedOperatorSession(await req(),env),'123');});
test('session policy rejects missing/forged/expired cookies, revoked user, CSRF and bearer substitution',async()=>{
 for(const r of [await req('456'),await req('123','wrong-secret'),await req('123',env.NEXTAUTH_SECRET,-60),new NextRequest(env.NEXTAUTH_URL,{method:'POST',headers:{origin:env.NEXTAUTH_URL,'sec-fetch-site':'same-origin','content-type':'application/json'}})])await assert.rejects(verifiedOperatorSession(r,env));
 for(const [name,value]of [['origin','https://evil.example.test'],['sec-fetch-site','cross-site'],['authorization','Bearer ignored'],['content-type','text/plain']]){const r=await req();r.headers.set(name,value);await assert.rejects(verifiedOperatorSession(r,env));}
 await assert.rejects(verifiedOperatorSession(await req(),{...env,OPERATOR_GITHUB_IDS:'999'}));
});
