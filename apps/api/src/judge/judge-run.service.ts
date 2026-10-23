import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import type { Db } from 'mongodb';
import { DurableOperatorBudget, verifyOperatorAssertion, type BoundAction, type OperatorPolicy } from '../common/operator-preflight';
import { isHostedRuntime } from '../config/runtime';

type Run = {_id:string;owner:string;stationId:string;chargerId:string;synthetic:true;status:string;revision:number;observations?:{at:Date;currentA:number;chargingState:string;sourceType:string}[];actions:{actor:string;action:string;at:Date}[]};
/** Isolated state: never updates chargers, telemetry, incidents or original Phase D evidence. */
export class JudgeRunService {
  constructor(private readonly db:Db,private readonly policy:OperatorPolicy,private readonly writeKey:string) {}
  /** All reads are owner-filtered and contain only isolated judge documents. */
  async list(owner:string) {
    return this.db.collection<Run>('judge_runs').find({owner,synthetic:true},{projection:{owner:0}}).sort({_id:-1}).limit(10).toArray();
  }
  async detail(owner:string,runId:string) {
    if(!/^judge-[a-f0-9]{24}$/.test(runId))throw new Error('Invalid judge run');
    return this.db.collection<Run>('judge_runs').findOne({_id:runId,owner,synthetic:true},{projection:{owner:0}});
  }
  async execute(token:string,key:string,action:BoundAction) {
    const hash=(v:string)=>createHash('sha256').update(v).digest();
    if(this.writeKey.length<32 || !timingSafeEqual(hash(key),hash(this.writeKey)))throw new Error('Write authentication denied');
    const identity=await verifyOperatorAssertion(token,action,this.policy);
    const runs=this.db.collection<Run>('judge_runs');
    const run=await runs.findOne({_id:action.runId,owner:identity.subject,synthetic:true,stationId:action.stationId,chargerId:action.chargerId});
    if(!run)throw new Error('Run ownership denied');
    if(run.revision>=100)throw new Error('Run action limit reached');
    const transitions:Record<string,[string[],string]>={fault:[['BASELINE','RESOLVED'],'OPEN'],acknowledge:[['OPEN'],'ACKNOWLEDGED'],recover:[['ACKNOWLEDGED'],'RESOLVING'],resolve:[['RESOLVING'],'RESOLVED'],reset:[['BASELINE','RESOLVED'],'BASELINE']};
    const [allowed,status]=transitions[action.operation];
    if(!allowed.includes(run.status))throw new Error('Invalid run transition');
    if(process.env.NODE_ENV==='production'||isHostedRuntime(process.env)) {
      // Refuse all writes until the separately approved policy provisioning
      // has explicitly created the TTL index. Never implicitly create it here.
      const collection=await this.db.listCollections({name:'judge_policy'},{nameOnly:true}).toArray();
      if(collection.length!==1)throw new Error('Judge policy not provisioned');
      const indexes=await this.db.collection('judge_policy').listIndexes().toArray();
      if(!indexes.some(i=>i.name==='expiresAt_ttl'&&i.expireAfterSeconds===0&&i.key?.expiresAt===1))
        throw new Error('Judge policy index not provisioned');
    }
    await new DurableOperatorBudget(this.db.collection('judge_policy')).consume(identity,3);
    const at=new Date();
    const observation=action.operation==='fault'?{at,currentA:0,chargingState:'FAULT',sourceType:'SYNTHETIC'}:action.operation==='recover'?{at,currentA:8.25,chargingState:'CHARGING',sourceType:'SYNTHETIC'}:undefined;
    const result=await runs.updateOne({_id:run._id,owner:identity.subject,revision:run.revision,status:run.status},{$set:{status},$inc:{revision:1},$push:{actions:{actor:identity.subject,action:action.operation,at},...(observation?{observations:observation}:{})}});
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
