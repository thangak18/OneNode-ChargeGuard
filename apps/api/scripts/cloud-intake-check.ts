/** One-shot operator-run smoke check; never imported by application startup. No database access. */
import {randomBytes} from 'node:crypto';
import {existsSync} from 'node:fs';
export async function cloudIntakeCheck(env:NodeJS.ProcessEnv,args:string[],send:typeof fetch=fetch){
 const id=randomBytes(8).toString('hex');
 const tags=['service:chargeguard-api','env:prod','purpose:intake_check'];
 const payloads=[
  {url:'https://http-intake.logs.datadoghq.com/api/v2/logs',body:[{service:'chargeguard-api',env:'prod',ddtags:tags.join(','),message:'chargeguard.cloud_intake_check',status:'info',timestamp:new Date().toISOString(),check_id:id,synthetic:true}]},
  {url:'https://api.datadoghq.com/api/v2/series',body:{series:[{metric:'chargeguard.cloud_intake_check',type:3,points:[{timestamp:Math.floor(Date.now()/1000),value:1}],tags}]}}
 ];
 if(!args.includes('--send'))return {mode:'DRY_RUN',logs:1,metricSeries:1,points:1,maxRequests:2,retries:0,databaseWrites:0};
 const until=Date.parse(env.DD_INTAKE_APPROVED_UNTIL??'');
 if(env.DD_TRIAL_SCOPE_CONFIRMED!=='true'||!Number.isFinite(until)||until<=Date.now()||until>Date.now()+600000||env.DD_CLOUD_ENABLED==='true'||!env.DD_API_KEY||env.DD_API_KEY.length<16)throw new Error('Intake approval/configuration gate not satisfied');
 const result=[];
 for(const payload of payloads){
  if(Date.now()>=until||existsSync('/tmp/chargeguard-stop-intake'))throw new Error('Intake stopped');
  const r=await send(payload.url,{method:'POST',headers:{'DD-API-KEY':env.DD_API_KEY,'Content-Type':'application/json'},body:JSON.stringify(payload.body),signal:AbortSignal.timeout(3000),redirect:'error'});
  await r.body?.cancel();result.push({signal:result.length===0?'log':'metric',status:r.status});if(!r.ok)break;
 }
 return {mode:'SENT',checkId:id,results:result,searchableArrivalVerified:false};
}
if(require.main===module)cloudIntakeCheck(process.env,process.argv.slice(2)).then(result=>console.log(JSON.stringify(result))).catch(()=>{console.error('Intake check stopped or failed; sensitive details withheld');process.exitCode=1;});
