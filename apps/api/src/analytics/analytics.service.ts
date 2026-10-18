import { BadRequestException, Inject, Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { z } from 'zod';
import { DatabaseService } from '../database/database.service';

const id=z.string().regex(/^[A-Za-z0-9][A-Za-z0-9_.:-]{0,63}$/);
const querySchema=z.object({
  stationId:id.optional(),chargerId:id.optional(),
  from:z.string().datetime({offset:true}).optional(),to:z.string().datetime({offset:true}).optional(),
  limit:z.coerce.number().int().min(1).max(500).default(200),
  bucketMinutes:z.coerce.number().int().min(1).max(60).default(5),
  windowMinutes:z.coerce.number().int().min(1).max(1440).default(15)
}).strip();
type Query=Record<string, string|undefined>;
type Range={from:Date;to:Date;match:Record<string,unknown>;limit:number;bucketMinutes:number;windowMinutes:number;stationId?:string;chargerId?:string};

function parseQuery(raw:Query,requireCharger=false,requireDates=false):Range {
  const parsed=querySchema.safeParse(raw);
  if (!parsed.success) throw new BadRequestException({message:'Invalid query',fields:[...new Set(parsed.error.issues.map(i=>i.path.join('.')))]});
  const q=parsed.data;
  if (requireCharger && !q.chargerId) throw new BadRequestException('chargerId is required');
  if (requireDates && (!q.from || !q.to)) throw new BadRequestException('from and to are required');
  const to=q.to?new Date(q.to):new Date(Date.now()+60_000);
  const from=q.from?new Date(q.from):new Date(to.getTime()-24*3600_000);
  if (from>=to || to.getTime()-from.getTime()>31*24*3600_000) throw new BadRequestException('Window must be positive and at most 31 days');
  const match:Record<string,unknown>={ts:{$gte:from,$lt:to}};
  if (q.stationId) match['meta.stationId']=q.stationId;
  if (q.chargerId) match['meta.chargerId']=q.chargerId;
  return {from,to,match,limit:q.limit,bucketMinutes:q.bucketMinutes,windowMinutes:q.windowMinutes,stationId:q.stationId,chargerId:q.chargerId};
}

@Injectable()
export class AnalyticsService {
  constructor(@Inject(DatabaseService) private readonly database:DatabaseService) {}
  private async safe<T>(work:()=>Promise<T>):Promise<T>{
    try{return await work();}catch(error){if(error instanceof BadRequestException || error instanceof NotFoundException) throw error; throw new ServiceUnavailableException('Telemetry query unavailable');}
  }

  history(q:Query){
    const r=parseQuery(q,true,true);
    return this.safe(async()=>this.database.collection('telemetry')
      .find(r.match,{projection:{_id:0,eventKey:0},sort:{ts:1},limit:r.limit}).toArray());
  }

  latest(q:Query){
    const r=parseQuery(q);
    return this.safe(async()=>this.database.collection('telemetry').aggregate([
      {$match:r.match},{$sort:{ts:-1}},{$group:{_id:'$meta.chargerId',reading:{$first:'$$ROOT'}}},
      {$replaceRoot:{newRoot:'$reading'}},{$project:{_id:0,eventKey:0}},{$limit:r.limit}
    ]).toArray());
  }

  currentAverages(q:Query){
    const r=parseQuery(q,true);
    return this.safe(async()=>this.database.collection('telemetry').aggregate([
      {$match:{...r.match,currentA:{$type:'number'}}},
      {$group:{_id:{$dateTrunc:{date:'$ts',unit:'minute',binSize:r.bucketMinutes}},averageCurrentA:{$avg:'$currentA'},samples:{$sum:1}}},
      {$sort:{_id:1}},{$limit:r.limit},{$project:{_id:0,bucket:'$_id',averageCurrentA:1,samples:1}}
    ]).toArray());
  }

  states(q:Query){
    const r=parseQuery(q);
    return this.safe(async()=>this.database.collection('telemetry').aggregate([
      {$match:{...r.match,chargingState:{$exists:true}}},
      {$group:{_id:'$chargingState',count:{$sum:1}}},{$sort:{count:-1}},{$project:{_id:0,state:'$_id',count:1}}
    ]).toArray());
  }

  async activity(q:Query){
    const r=parseQuery(q);
    const activeFrom=new Date(r.to.getTime()-r.windowMinutes*60_000);
    const since=activeFrom>r.from?activeFrom:r.from;
    return this.safe(async()=>{
      const chargers=await this.database.collection('chargers')
        .find(r.stationId?{stationId:r.stationId}:{},{projection:{_id:1,stationId:1,connectorId:1,status:1},limit:500}).toArray();
      const found=await this.database.collection('telemetry').aggregate([
        {$match:{...r.match,ts:{$gte:since,$lt:r.to}}},
        {$group:{_id:'$meta.chargerId',lastSeenAt:{$max:'$ts'}}}
      ]).toArray();
      const seen=new Map(found.map(e=>[e._id,e.lastSeenAt]));
      const items=chargers.map(charger=>({
        chargerId:charger._id,stationId:charger.stationId,connectorId:charger.connectorId,configuredStatus:charger.status,
        telemetryActive:seen.has(charger._id),lastSeenAt:seen.get(charger._id)??null
      }));
      return {windowMinutes:r.windowMinutes,active:items.filter(c=>c.telemetryActive).length,inactive:items.filter(c=>!c.telemetryActive).length,items};
    });
  }

  async stationSummary(stationId:string,q:Query){
    const r=parseQuery({...q,stationId});
    return this.safe(async()=>{
      const station=await this.database.collection('stations').findOne({_id:stationId});
      if(!station) throw new NotFoundException('Station not found');
      const stats=await this.database.collection('telemetry').aggregate([
        {$match:r.match},
        {$group:{_id:'$meta.chargerId',sampleCount:{$sum:1},averageCurrentA:{$avg:'$currentA'},lastSeenAt:{$max:'$ts'}}},
        {$sort:{_id:1}},{$limit:500}
      ]).toArray();
      const assets=await this.database.collection('chargers').find({stationId},{projection:{_id:1,status:1,connectorId:1},limit:500}).toArray();
      const byId=new Map(stats.map(s=>[s._id,s]));
      return {station:{id:station._id,name:station.name},window:{from:r.from,to:r.to},chargers:assets.map(a=>({chargerId:a._id,connectorId:a.connectorId,configuredStatus:a.status,telemetry:byId.get(a._id)??null})),sampleCount:stats.reduce((n,s)=>n+s.sampleCount,0)};
    });
  }
}
