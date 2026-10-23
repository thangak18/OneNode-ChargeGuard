import 'server-only';
import {isOperatorId} from './operator-policy.mts';
import {verifiedJudgeReadSession} from './judge-read-session.mts';
import {SignJWT} from 'jose';
import {randomBytes} from 'node:crypto';
import type {NextRequest} from 'next/server';

export const currentJudgeOperator=(req:NextRequest)=>verifiedJudgeReadSession(req,process.env);

export async function readAssertion(operatorId:string,path:string):Promise<string> {
  const env=process.env,origin=env.NEXTAUTH_URL,secret=env.OPERATOR_ASSERTION_SECRET;
  if(!origin||new URL(origin).origin!==origin||!secret||secret.length<32||!isOperatorId(operatorId,env.OPERATOR_GITHUB_IDS)||
    !(/^\/api\/v1\/judge\/runs$/.test(path)||/^\/api\/v1\/judge\/runs\/judge-[a-f0-9]{24}$/.test(path)))throw new Error('Judge reads unconfigured');
  return new SignJWT({method:'GET',scope:'judge:read',path}).setProtectedHeader({alg:'HS256'}).setIssuer(origin)
    .setAudience('chargeguard-api').setSubject(`github:${operatorId}`).setIssuedAt().setExpirationTime('30s')
    .setJti(randomBytes(16).toString('hex')).sign(Buffer.from(secret));
}

export async function judgeReadResponse(req:NextRequest,runId?:string):Promise<Response>{
  const operator=await currentJudgeOperator(req);
  if(!operator)return Response.json({message:'Operator sign-in required'},{status:401,headers:{'Cache-Control':'no-store'}});
  const readKey=process.env.NEST_READ_API_KEY,backend=process.env.NEST_API_BASE_URL;
  if(process.env.JUDGE_READS_ENABLED!=='true'||!readKey||readKey.length<32||!backend||!process.env.OPERATOR_ASSERTION_SECRET)
    return Response.json({message:'Isolated judge run reads await owner provisioning'},{status:503,headers:{'Cache-Control':'no-store'}});
  if(runId&&!/^judge-[a-f0-9]{24}$/.test(runId))return Response.json({message:'Invalid run'},{status:400});
  try{
    const base=new URL(backend);
    if(base.protocol!=='https:'||base.pathname!=='/'||base.username||base.password||base.search||base.hash)throw new Error();
    const path=`/api/v1/judge/runs${runId?`/${runId}`:''}`;
    const assertion=await readAssertion(operator,path);
    const upstream=await fetch(new URL(path,base),{headers:{'accept':'application/json','x-chargeguard-read-key':readKey,'x-chargeguard-operator-read':assertion,origin:process.env.NEXTAUTH_URL!},cache:'no-store',redirect:'error',signal:AbortSignal.any([req.signal,AbortSignal.timeout(95000)])});
    if(!upstream.headers.get('content-type')?.startsWith('application/json'))throw new Error();
    const text=await upstream.text();if(text.length>131072)throw new Error();
    const data=JSON.parse(text);
    return Response.json(data,{status:upstream.status,headers:{'Cache-Control':'no-store'}});
  }catch{return Response.json({message:'Judge read temporarily unavailable'},{status:503,headers:{'Cache-Control':'no-store','Retry-After':'15'}});}
}
