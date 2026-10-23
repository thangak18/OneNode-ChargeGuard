import {NextRequest,NextResponse} from 'next/server';
import {mintOperatorAssertion} from '@/lib/operator-assertion';
export const dynamic='force-dynamic';
export const runtime='nodejs';
/** Production remains hard-denied until separately reviewed owner authorization changes this code. */
export async function POST(req:NextRequest,ctx:{params:Promise<{runId:string;operation:string}>}){
 if(process.env.NODE_ENV==='production'||process.env.JUDGE_ROUTES_ENABLED!=='true')return NextResponse.json({message:'Judge mutations disabled'},{status:403});
 try{
  const {runId,operation}=await ctx.params;
  const reader=req.body?.getReader();let size=0;const chunks:Uint8Array[]=[];
  if(reader)try{while(true){const part=await reader.read();if(part.done)break;size+=part.value.length;if(size>8192){await reader.cancel();return NextResponse.json({message:'Body too large'},{status:413});}chunks.push(part.value);}}finally{reader.releaseLock();}
  const body=Buffer.concat(chunks).toString('utf8');const parsed=JSON.parse(body);if(!parsed||Array.isArray(parsed)||typeof parsed!=='object'||Object.keys(parsed).length)throw new Error();
  const assertion=await mintOperatorAssertion(req,{runId,operation,chargerId:'demo-charger-01',body});
  const base=new URL(process.env.NEST_API_BASE_URL??'');const key=process.env.JUDGE_WRITE_API_KEY;
  if(base.protocol!=='https:'||base.username||base.password||base.pathname!=='/'||base.search||base.hash||!key||key.length<32||key===process.env.NEST_READ_API_KEY||key===process.env.NEST_API_KEY)throw new Error();
  const upstream=await fetch(new URL(`/api/v1/judge/runs/${runId}/${operation}`,base),{method:'POST',headers:{'content-type':'application/json',origin:process.env.NEXTAUTH_URL!,'x-chargeguard-operator':assertion,'x-chargeguard-write-key':key},body,redirect:'error',cache:'no-store',signal:AbortSignal.any([req.signal,AbortSignal.timeout(10000)])});
  return NextResponse.json(await upstream.json(),{status:upstream.status,headers:{'Cache-Control':'no-store'}});
 }catch{return NextResponse.json({message:'Judge action unavailable or denied'},{status:403});}
}
