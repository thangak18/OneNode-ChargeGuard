import {createHash,timingSafeEqual} from 'node:crypto';
import {jwtVerify} from 'jose';
import {Body,Controller,Param,Post,Get,Req,Inject,Optional,NotFoundException,UnauthorizedException,BadRequestException,ServiceUnavailableException,ConflictException,ForbiddenException,HttpException} from '@nestjs/common';
import type {Request} from 'express';
import {DatabaseService} from '../database/database.service';
import {JudgeRunService} from './judge-run.service';
import {verifyOperatorAssertion,verifyOperatorRead,type BoundAction,type DemoOperation} from '../common/operator-preflight';
import {ObservabilityService} from '../observability/observability.service';
import {isHostedRuntime} from '../config/runtime';
import {isScopedJudgeWrite,PRODUCTION_JUDGE_OWNER} from '../common/judge-production-gate';

@Controller({path:'judge/runs',version:'1'})
export class JudgeController {
 constructor(@Inject(DatabaseService)private readonly database:DatabaseService,@Optional() @Inject(ObservabilityService) private readonly obs?:ObservabilityService){}
 private policy(){const env=process.env;const secret=env.OPERATOR_ASSERTION_SECRET,origin=env.OPERATOR_ORIGIN;
  if(!secret||secret.length<32||!origin)throw new ServiceUnavailableException('Judge reads are not configured');
  return {secret:Buffer.from(secret),issuer:origin,audience:'chargeguard-api',origin,githubIds:new Set((env.OPERATOR_GITHUB_IDS??'').split(',').map(s=>s.trim()))};
 }
 private async readOwner(req:Request) {
  if(process.env.JUDGE_READS_ENABLED!=='true')throw new ServiceUnavailableException('Judge reads not provisioned');
  const assertion=req.headers['x-chargeguard-operator-read'];
  if(typeof assertion!=='string')throw new UnauthorizedException('Operator required');
  try{return await verifyOperatorRead(assertion,req.path,String(req.headers.origin??''),this.policy());}
  catch{throw new UnauthorizedException('Operator required');}
 }
 @Get()
 async list(@Req()req:Request){const owner=await this.readOwner(req);return new JudgeRunService(this.database.db(),this.policy(),'').list(owner);}
 @Get(':runId')
 async detail(@Req()req:Request,@Param('runId')runId:string){
  const owner=await this.readOwner(req);
  const run=await new JudgeRunService(this.database.db(),this.policy(),'').detail(owner,runId);
  if(!run)throw new NotFoundException('Run not found');return run;
 }
 @Post(':runId/:operation')
 async act(@Req() req:Request&{rawBody?:Buffer},@Param('runId')runId:string,@Param('operation')operation:string,@Body() body:unknown){
  const env=process.env;
  if ((env.NODE_ENV==='production'||isHostedRuntime(env)) && !isScopedJudgeWrite(env,req.method,req.path))
   throw new UnauthorizedException('Judge action denied');
  // This additional gate is not a replacement for unconditional production middleware denial.
  if(env.JUDGE_ROUTES_ENABLED!=='true')throw new ServiceUnavailableException('Judge routes disabled');
  const secret=env.OPERATOR_ASSERTION_SECRET,writeKey=env.JUDGE_WRITE_API_KEY,origin=env.OPERATOR_ORIGIN;
  if(!secret||secret.length<32||!writeKey||writeKey.length<32||writeKey===secret||writeKey===env.BFF_READ_API_KEY||writeKey===env.INGEST_API_KEY||!origin)throw new ServiceUnavailableException('Judge configuration unavailable');
  if(!req.rawBody||!body||Array.isArray(body)||typeof body!=='object'||Object.keys(body).length!==2||!Number.isSafeInteger((body as any).expectedRevision)||!Number.isSafeInteger((body as any).expectedCycle)||Object.keys(body).some(k=>!['expectedRevision','expectedCycle'].includes(k))||req.headers['content-type']?.split(';')[0]!=='application/json')throw new BadRequestException('Judge action requires exact revision and cycle preconditions');
  const token=req.headers['x-chargeguard-operator'],key=req.headers['x-chargeguard-write-key'];
  if(typeof token!=='string'||typeof key!=='string')throw new UnauthorizedException('Operator authentication required');
  const policy=this.policy();
  // Assets come from stored run, never a browser-declared station/charger or actor.
  try{if(!timingSafeEqual(createHash('sha256').update(key).digest(),createHash('sha256').update(writeKey).digest()))throw new Error();await jwtVerify(token,Buffer.from(secret),{algorithms:['HS256'],issuer:origin,audience:'chargeguard-api',requiredClaims:['sub','iat','exp','jti']});}catch{throw new UnauthorizedException('Operator authentication required');}
  if(!/^judge-[a-f0-9]{24}$/.test(runId))throw new BadRequestException('Invalid run');
  const run=await this.database.db().collection('judge_runs').findOne({_id:runId as any,synthetic:true});
  const action:BoundAction={expectedRevision:(body as any).expectedRevision,expectedCycle:(body as any).expectedCycle,runId,operation:operation as DemoOperation,method:'POST',path:req.path,body:req.rawBody,origin:String(req.headers.origin??''),stationId:String(run?.stationId??''),chargerId:String(run?.chargerId??'')};
  let result:{runId:string;status:string;synthetic:boolean;cycle:number;revision:number};
  try{
   const identity=await verifyOperatorAssertion(token,action,policy);
   if((env.NODE_ENV==='production'||isHostedRuntime(env)) && identity.subject!==`github:${PRODUCTION_JUDGE_OWNER}`)throw new Error('Wrong operator');
   result=await new JudgeRunService(this.database.db(),policy,writeKey).execute(token,key,action);
  }
  catch(error){
   const reason=error instanceof Error?error.message:'';
   if(['Stale run precondition','Run conflict','Invalid run transition'].includes(reason))throw new ConflictException('Run changed or action unavailable; refresh before acting');
   if(reason==='Operator budget denied')throw new HttpException('Action budget unavailable; inspect state and wait before retrying',429);
   if(['Re-arm not authorized','Run action limit reached'].includes(reason))throw new ForbiddenException('Action is not authorized or run limit reached');
   throw new UnauthorizedException('Judge action denied');
  }
  // Best-effort observability must never turn a committed CAS transition into a retryable denial.
  try{this.obs?.judgeAction(operation,runId,action.chargerId,result.cycle,result.revision);}catch{/* software state and audit already committed */}
  return result;
 }
}
