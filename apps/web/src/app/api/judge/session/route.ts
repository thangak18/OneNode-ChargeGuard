import type {NextRequest} from 'next/server';
import {currentJudgeOperator} from '@/lib/judge-read';
export const dynamic='force-dynamic';
export async function GET(req:NextRequest){
 const operator=await currentJudgeOperator(req);
 return Response.json({authorized:!!operator,canMutate:!!operator&&process.env.NODE_ENV!=='production'&&process.env.JUDGE_ROUTES_ENABLED==='true',readProvisioned:process.env.JUDGE_READS_ENABLED==='true'&&!!process.env.OPERATOR_ASSERTION_SECRET},
  {headers:{'Cache-Control':'no-store'}});
}
