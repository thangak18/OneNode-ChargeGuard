import 'server-only';
import { getToken } from 'next-auth/jwt';
import type { NextRequest } from 'next/server';
import { createHash, createHmac, randomBytes } from 'node:crypto';
import { isOperatorId } from './operator-policy.mts';
/** Preparation only: not called by the production BFF, whose write denial is unchanged. */
export async function mintOperatorAssertion(request:NextRequest, action:{operation:string;runId:string;chargerId:string;body:string}) {
  const origin=process.env.NEXTAUTH_URL;
  const secret=process.env.OPERATOR_ASSERTION_SECRET;
  if(!process.env.NEXTAUTH_SECRET||!origin||new URL(origin).origin!==origin||!origin.startsWith('https://')||!secret||secret.length<32||
    request.method!=='POST'||request.headers.get('origin')!==origin||request.headers.get('sec-fetch-site')!=='same-origin'||
    request.headers.get('content-type')?.split(';')[0]!=='application/json')throw new Error('Operator origin denied');
  const token=await getToken({req:request,secret:process.env.NEXTAUTH_SECRET,secureCookie:true});
  if(!token||!isOperatorId(token.operatorId,process.env.OPERATOR_GITHUB_IDS))throw new Error('Operator session denied');
  if(!['fault','acknowledge','recover','resolve','reset'].includes(action.operation)||!/^judge-[a-f0-9]{24}$/.test(action.runId)||!/^demo-charger-0[1-5]$/.test(action.chargerId)||Buffer.byteLength(action.body)>8192)throw new Error('Operator action denied');
  const now=Math.floor(Date.now()/1000);
  const payload={iss:origin,aud:'chargeguard-api',sub:`github:${token.operatorId}`,iat:now,exp:now+30,jti:randomBytes(16).toString('hex'),operation:action.operation,method:'POST',path:`/api/v1/judge/runs/${action.runId}/${action.operation}`,runId:action.runId,stationId:'demo-station-01',chargerId:action.chargerId,bodySha256:createHash('sha256').update(action.body).digest('hex')};
  const input=Buffer.from(JSON.stringify({alg:'HS256',typ:'JWT'})).toString('base64url')+'.'+Buffer.from(JSON.stringify(payload)).toString('base64url');
  return input+'.'+createHmac('sha256',secret).update(input).digest('base64url');
}
