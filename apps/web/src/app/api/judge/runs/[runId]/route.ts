import {judgeReadResponse} from '@/lib/judge-read';
import type {NextRequest} from 'next/server';
export const dynamic='force-dynamic';
export const maxDuration=120;
export async function GET(req:NextRequest,ctx:{params:Promise<{runId:string}>}){
 return judgeReadResponse(req,(await ctx.params).runId);
}
