import { z } from 'zod';

const id = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9_.:-]{0,63}$/);
const isoWithZone = z.string().datetime({offset:true}).refine(value => !Number.isNaN(Date.parse(value)), 'Invalid timestamp');
const numeric = (min: number, max: number) => z.number().finite().min(min).max(max);
export const fieldNames = ['currentA','pilotA','voltageV','powerKW','temperatureC','chargingState','sourceChargingState','sourceEnergyKWh','faultCode'] as const;
const fieldOrigin = z.enum(['MEASURED','SOURCE_REPORTED','DERIVED','SYNTHETIC']);
const provenance = z.object({
  sourceType: z.enum(['ACN_REPLAY','DERIVED','SYNTHETIC']),
  sourceUrl: z.string().url().optional(),
  datasetVersion: z.string().max(128).optional(),
  transformVersion: z.string().max(128).optional(),
  sessionId: id.optional(),
  assumptions: z.string().min(1).max(512).optional(),
  fields: z.record(z.enum(fieldNames), fieldOrigin)
}).strict();
export const telemetrySchema = z.object({
  eventId: id,
  ts: isoWithZone,
  sourceEventAt: isoWithZone.optional(),
  meta: z.object({stationId:id, chargerId:id}).strict(),
  currentA: numeric(0, 1000).optional(),
  pilotA: numeric(0, 1000).optional(),
  voltageV: numeric(0, 1500).optional(),
  powerKW: numeric(0, 1000).optional(),
  temperatureC: numeric(-60, 200).optional(),
  chargingState: z.enum(['AVAILABLE','CHARGING','NOT_CHARGING','IDLE','FAULT','OFFLINE']).optional(),
  sourceChargingState: z.string().min(1).max(64).optional(),
  sourceEnergyKWh: numeric(0, 1000000).optional(),
  faultCode: z.string().min(1).max(64).optional(),
  qualityFlags: z.array(z.enum(['ENERGY_COUNTER_DECREASE'])).max(4).optional(),
  provenance
}).strict().superRefine((item, ctx) => {
  const present = fieldNames.filter(field => item[field] !== undefined);
  if (!present.length) ctx.addIssue({code:'custom',path:['currentA'],message:'At least one telemetry field is required'});
  for (const field of present) {
    const origin = item.provenance.fields[field];
    if (!origin) ctx.addIssue({code:'custom',path:['provenance','fields',field],message:'Missing field provenance'});
    if (origin === 'DERIVED' && !item.provenance.assumptions) ctx.addIssue({code:'custom',path:['provenance','assumptions'],message:'Derived values require assumptions'});
    if (['chargingState','temperatureC','faultCode'].includes(field) && origin === 'MEASURED' && item.provenance.sourceType === 'ACN_REPLAY') {
      ctx.addIssue({code:'custom',path:['provenance','fields',field],message:'ACN samples do not provide this measurement'});
    }
    if (['voltageV','powerKW','pilotA'].includes(field) && origin === 'MEASURED' && item.provenance.sourceType === 'ACN_REPLAY') {
      ctx.addIssue({code:'custom',path:['provenance','fields',field],message:'Not measured in inspected ACN subset'});
    }
  }
  for (const key of Object.keys(item.provenance.fields)) {
    if (!present.includes(key as typeof fieldNames[number])) ctx.addIssue({code:'custom',path:['provenance','fields',key],message:'Field provenance without a value'});
  }
  const futureLimit = Date.now() + 5*60*1000;
  if (Date.parse(item.ts) > futureLimit) ctx.addIssue({code:'custom',path:['ts'],message:'Event time too far in the future'});
});
export type TelemetryInput = z.infer<typeof telemetrySchema>;
export const telemetryBatchSchema = z.object({events:z.array(telemetrySchema).min(1).max(100)}).strict();
export type TelemetryDocument = Omit<TelemetryInput,'ts'|'sourceEventAt'|'eventId'> & {ts:Date;sourceEventAt?:Date; eventId:string;eventKey:string;ingestedAt:Date};
