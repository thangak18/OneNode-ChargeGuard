import {getToken} from 'next-auth/jwt';
import {isOperatorId} from './operator-policy.mts';
export async function verifiedOperatorSession(req:Parameters<typeof getToken>[0]['req'] & {method?:string},env:Record<string,string|undefined>){
 const h=req.headers instanceof Headers?req.headers:new Headers(req.headers as Record<string,string>);
 const origin=env.NEXTAUTH_URL;
 if(!origin||!env.NEXTAUTH_SECRET||!origin.startsWith('https://')||new URL(origin).origin!==origin||req.method!=='POST'||h.get('origin')!==origin||h.get('sec-fetch-site')!=='same-origin'||h.get('authorization')||h.get('content-type')?.split(';')[0]!=='application/json')throw new Error('Operator origin denied');
 const session=await getToken({req,secret:env.NEXTAUTH_SECRET,secureCookie:true});
 if(!session||!isOperatorId(session.operatorId,env.OPERATOR_GITHUB_IDS))throw new Error('Operator session denied');
 return String(session.operatorId);
}
