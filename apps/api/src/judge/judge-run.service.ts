import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import type { Db } from 'mongodb';
import { DurableOperatorBudget, verifyOperatorAssertion, type BoundAction, type OperatorPolicy } from '../common/operator-preflight';

type Run = {_id:string;owner:string;stationId:string;chargerId:string;synthetic:true;status:string;revision:number;actions:{actor:string;action:string;at:Date}[]};
/** Isolated state: never updates chargers, telemetry, incidents or original Phase D evidence. */
export class JudgeRunService {
  constructor(private readonly db:Db,private readonly policy:OperatorPolicy,private readonly writeKey:string) {}
  async execute(token:string,key:string,action:BoundAction) {
    const hash=(v:string)=>createHash('sha256').update(v).digest();
    if(this.writeKey.length<32 || !timingSafeEqual(hash(key),hash(this.writeKey)))throw new Error('Write authentication denied');
    const identity=await verifyOperatorAssertion(token,action,this.policy);
    const runs=this.db.collection<Run>('judge_runs');
    const run=await runs.findOne({_id:action.runId,owner:identity.subject,synthetic:true,stationId:action.stationId,chargerId:action.chargerId});
    if(!run)throw new Error('Run ownership denied');
    const transitions:Record<string,[string[],string]>={fault:[['BASELINE','RESOLVED'],'OPEN'],acknowledge:[['OPEN'],'ACKNOWLEDGED'],recover:[['ACKNOWLEDGED'],'RESOLVING'],resolve:[['RESOLVING'],'RESOLVED'],reset:[['BASELINE','RESOLVED'],'BASELINE']};
    const [allowed,status]=transitions[action.operation];
    if(!allowed.includes(run.status))throw new Error('Invalid run transition');
    await new DurableOperatorBudget(this.db.collection('judge_policy')).consume(identity,3);
    const result=await runs.updateOne({_id:run._id,owner:identity.subject,revision:run.revision,status:run.status},{$set:{status},$inc:{revision:1},$push:{actions:{actor:identity.subject,action:action.operation,at:new Date()}}});
    if(result.modifiedCount!==1)throw new Error('Run conflict');
    return {runId:run._id,status,synthetic:true};
  }
  /** Provisioning is an explicit owner-controlled step, not a browser endpoint. */
  async provision(owner:string,chargerId:string){
    if(!/^github:[1-9][0-9]*$/.test(owner)||!this.policy.githubIds.has(owner.slice(7))||!/^demo-charger-0[1-5]$/.test(chargerId))throw new Error('Run provisioning denied');
    const run:Run={_id:'judge-'+randomBytes(12).toString('hex'),owner,chargerId,stationId:'demo-station-01',synthetic:true,status:'BASELINE',revision:0,actions:[]};
    await this.db.collection<Run>('judge_runs').insertOne(run);return run._id;
  }
}
