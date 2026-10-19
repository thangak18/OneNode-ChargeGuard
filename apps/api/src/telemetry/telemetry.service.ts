import { ObservabilityService } from '../observability/observability.service';
import { BadRequestException, ConflictException, Inject, Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { MongoServerError } from 'mongodb';
import { DatabaseService } from '../database/database.service';
import { telemetryBatchSchema, telemetrySchema, TelemetryInput } from './telemetry.schema';

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  if (value !== null && typeof value === 'object') return `{${Object.entries(value).sort(([a],[b]) => a.localeCompare(b)).map(([key,v]) => `${JSON.stringify(key)}:${stableJson(v)}`).join(',')}}`;
  return JSON.stringify(value);
}
const digest = (value:string) => createHash('sha256').update(value).digest('hex');

@Injectable()
export class TelemetryService {
  constructor(@Inject(DatabaseService) private readonly database:DatabaseService, @Inject(ObservabilityService) private readonly obs:ObservabilityService) {}

  validate(raw:unknown): TelemetryInput {
    const parsed = telemetrySchema.safeParse(raw);
    if (!parsed.success) throw new BadRequestException({message:'Invalid telemetry', fields:[...new Set(parsed.error.issues.map(i => i.path.join('.')))]});
    return parsed.data;
  }

  async ingest(raw:unknown): Promise<{eventId:string;duplicate:boolean}> {
    const input = this.validate(raw);
    const result=await this.persist(input);
    this.obs.accepted(input,result.duplicate);
    return result;
  }

  private async persist(input:TelemetryInput):Promise<{eventId:string;duplicate:boolean}> {
    const {stationId, chargerId} = input.meta;
    try {
      const [station,charger] = await Promise.all([
        this.database.collection('stations').findOne({_id:stationId},{projection:{_id:1}}),
        this.database.collection('chargers').findOne({_id:chargerId,stationId},{projection:{_id:1}})
      ]);
      if (!station || !charger) throw new NotFoundException('Unknown station/charger pairing');
    } catch (error) { if (error instanceof NotFoundException) throw error; throw new ServiceUnavailableException('Asset lookup unavailable'); }
    const eventKey = digest(`${stationId}\0${chargerId}\0${input.eventId}`);
    const fingerprint = digest(stableJson(input));
    const receipts = this.database.collection('ingestion_receipts');
    try {
      await receipts.insertOne({_id:eventKey,status:'PENDING',fingerprint,createdAt:new Date(),stationId,chargerId,eventId:input.eventId});
    } catch (error) {
      if (!(error instanceof MongoServerError && error.code === 11000)) throw new ServiceUnavailableException('Receipt storage unavailable');
      let receipt;
      try {receipt = await receipts.findOne({_id:eventKey});} catch {throw new ServiceUnavailableException('Receipt lookup unavailable');}
      if (!receipt || receipt.fingerprint !== fingerprint) throw new ConflictException('Idempotency key reused with different payload');
      if (receipt.status === 'COMMITTED') return {eventId:input.eventId,duplicate:true};
      // Reconcile crash after time-series insert but before receipt commit.
      try {
        const written = await this.database.collection('telemetry').findOne({eventKey,'meta.chargerId':chargerId,ts:new Date(input.ts)},{projection:{_id:1}});
        if (written) {
          await receipts.updateOne({_id:eventKey,fingerprint},{$set:{status:'COMMITTED',committedAt:new Date()}});
          return {eventId:input.eventId,duplicate:true};
        }
      } catch {throw new ServiceUnavailableException('Pending event reconciliation unavailable');}
      throw new ConflictException('Event is in progress or unresolved; retry later or reconcile the receipt');
    }
    const ts = new Date(input.ts);
    try {
      await this.database.collection('telemetry').insertOne({ ...input,ts,eventKey,ingestedAt:new Date(), ...(input.sourceEventAt ? {sourceEventAt:new Date(input.sourceEventAt)} : {}) });
      await receipts.updateOne({_id:eventKey,fingerprint},{$set:{status:'COMMITTED',committedAt:new Date()}});
      return {eventId:input.eventId,duplicate:false};
    } catch {
      // Leave PENDING: an ambiguous failed write must not be retried as a new time-series insert.
      throw new ServiceUnavailableException('Ingestion outcome uncertain; receipt retained for safe reconciliation');
    }
  }

  async ingestBatch(raw:unknown): Promise<{items: {eventId:string;duplicate:boolean}[]}> {
    const parsed=telemetryBatchSchema.safeParse(raw);
    if (!parsed.success) throw new BadRequestException({message:'Invalid telemetry batch',fields:[...new Set(parsed.error.issues.map(i=>i.path.join('.')))]});
    const items=[];
    // Sequential ingestion protects a Free cluster; retries are keyed independently.
    for(const event of parsed.data.events) items.push(await this.ingest(event));
    return {items};
  }
}
