import {resolve} from 'node:path';
import {canReadHistorical} from '@/lib/historical-policy.mts';
import {readLocalHistory} from '@/lib/local-history';
export const runtime='nodejs';
export const dynamic='force-dynamic';
const headers={'Cache-Control':'no-store, private','Pragma':'no-cache','X-Content-Type-Options':'nosniff'};
export async function GET(request:Request) {
  if(!canReadHistorical(request,process.env.NODE_ENV,process.env.CHARGEGUARD_HISTORICAL_LOCAL))return Response.json({message:'Local historical mode is disabled or unavailable for this request.'},{status:403,headers});
  const query=new URL(request.url).searchParams;
  const session=query.get('session')??'sample_01';const speed=Number(query.get('speed')??600);
  if([...query.keys()].some(k=>!['session','speed'].includes(k) || query.getAll(k).length!==1) || !/^sample_0[1-5]$/.test(session) || !Number.isFinite(speed)||speed<1||speed>86400) return Response.json({message:'Invalid historical selection.'},{status:400,headers});
  try {return Response.json(await readLocalHistory(resolve(process.cwd(),'../..'),session,speed),{headers});}
  catch {return Response.json({message:'Verified local ACN files are unavailable. Check the ignored inventory and hashes locally.'},{status:503,headers});}
}
