import {createHash,timingSafeEqual} from 'node:crypto';
import {jwtVerify} from 'jose';
import {Body,Controller,Param,Post,Req,Inject,UnauthorizedException,BadRequestException,ServiceUnavailableException} from '@nestjs/common';
import type {Request} from 'express';
import {DatabaseService} from '../database/database.service';
import {JudgeRunService} from './judge-run.service';
import {verifyOperatorAssertion,type BoundAction,type DemoOperation} from '../common/operator-preflight';

@Controller({path:'judge/runs',version:'1'})
export class JudgeController {
 constructor(@Inject(DatabaseService)private readonly database:DatabaseService){}
 @Post(':runId/:operation')
 async act(@Req() req:Request&{rawBody?:Buffer},@Param('runId')runId:string,@Param('operation')operation:string,@Body() body:unknown){
  const env=process.env;
  // This additional gate is not a replacement for unconditional production middleware denial.
  if(env.JUDGE_ROUTES_ENABLED!=='true')throw new ServiceUnavailableException('Judge routes disabled');
  const secret=env.OPERATOR_ASSERTION_SECRET,writeKey=env.JUDGE_WRITE_API_KEY,origin=env.OPERATOR_ORIGIN;
  if(!secret||secret.length<32||!writeKey||writeKey.length<32||writeKey===env.BFF_READ_API_KEY||writeKey===env.INGEST_API_KEY||!origin)throw new ServiceUnavailableException('Judge configuration unavailable');
  if(!req.rawBody||!body||Array.isArray(body)||typeof body!=='object'||Object.keys(body).length||req.headers['content-type']?.split(';')[0]!=='application/json')throw new BadRequestException('Judge action accepts an empty JSON object');
  const token=req.headers['x-chargeguard-operator'],key=req.headers['x-chargeguard-write-key'];
  if(typeof token!=='string'||typeof key!=='string')throw new UnauthorizedException('Operator authentication required');
  const policy={secret:Buffer.from(secret),issuer:origin,audience:'chargeguard-api',origin,githubIds:new Set((env.OPERATOR_GITHUB_IDS??'').split(',').map(s=>s.trim()))};
  // Assets come from stored run, never a browser-declared station/charger or actor.
  try{if(!timingSafeEqual(createHash('sha256').update(key).digest(),createHash('sha256').update(writeKey).digest()))throw new Error();await jwtVerify(token,Buffer.from(secret),{algorithms:['HS256'],issuer:origin,audience:'chargeguard-api',requiredClaims:['sub','iat','exp','jti']});}catch{throw new UnauthorizedException('Operator authentication required');}
  if(!/^judge-[a-f0-9]{24}$/.test(runId))throw new BadRequestException('Invalid run');
  const run=await this.database.db().collection('judge_runs').findOne({_id:runId as any,synthetic:true});
  const action:BoundAction={runId,operation:operation as DemoOperation,method:'POST',path:req.path,body:req.rawBody,origin:String(req.headers.origin??''),stationId:String(run?.stationId??''),chargerId:String(run?.chargerId??'')};
  try{await verifyOperatorAssertion(token,action,policy);return await new JudgeRunService(this.database.db(),policy,writeKey).execute(token,key,action);}catch{throw new UnauthorizedException('Judge action denied');}
 }
}
