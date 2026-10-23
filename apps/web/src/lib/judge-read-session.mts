import {getToken} from 'next-auth/jwt';
import {isOperatorId} from './operator-policy.mts';
import type {NextRequest} from 'next/server';

/** Trust only NextAuth's verified, encrypted cookie and the current numeric operator allowlist. */
export async function verifiedJudgeReadSession(req:NextRequest,env:Record<string,string|undefined>):Promise<string|null>{
 if(!env.NEXTAUTH_SECRET||env.NEXTAUTH_SECRET.length<32||!env.NEXTAUTH_URL?.startsWith('https://')||
   new URL(env.NEXTAUTH_URL).origin!==env.NEXTAUTH_URL||req.headers.get('authorization'))return null;
 const token=await getToken({req,secret:env.NEXTAUTH_SECRET,secureCookie:true});
 return token&&isOperatorId(token.operatorId,env.OPERATOR_GITHUB_IDS)?String(token.operatorId):null;
}
