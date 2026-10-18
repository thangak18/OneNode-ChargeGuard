import { Db } from 'mongodb';

const domainCollections = ['stations', 'chargers', 'incidents', 'incident_actions', 'ingestion_receipts'] as const;
const telemetryOptions = { timeseries: { timeField: 'ts', metaField: 'meta', granularity: 'seconds' as const }, expireAfterSeconds: 604800 };

export async function initializeCollections(db: Db): Promise<string[]> {
  const existing = new Map((await db.listCollections().toArray()).map(entry => [entry.name, entry]));
  const created: string[] = [];
  for (const name of domainCollections) {
    if (!existing.has(name)) { await db.createCollection(name); created.push(name); }
  }
  const telemetry = existing.get('telemetry');
  if (!telemetry) { await db.createCollection('telemetry', telemetryOptions); created.push('telemetry'); }
  else if (telemetry.type !== 'timeseries' || (telemetry as {options?:{timeseries?:{timeField?:string,metaField?:string}}}).options?.timeseries?.timeField !== 'ts' || (telemetry as {options?:{timeseries?:{timeField?:string,metaField?:string}}}).options?.timeseries?.metaField !== 'meta') {
    throw new Error('Existing telemetry collection has incompatible time-series configuration; manual review required.');
  }
  await db.collection('chargers').createIndex({ stationId: 1, connectorId: 1 }, { unique: true, name: 'station_connector_unique' });
  await db.collection('chargers').createIndex({ stationId: 1, status: 1 }, { name: 'station_status' });
  await db.collection('telemetry').createIndex({ 'meta.chargerId': 1, ts: -1 }, { name: 'charger_time' });
  await db.collection('telemetry').createIndex({ 'meta.stationId': 1, ts: -1 }, { name: 'station_time' });
  await db.collection('incidents').createIndex({ status: 1, detectedAt: -1 }, { name: 'incident_queue' });
  await db.collection('incidents').createIndex({ chargerId: 1, detectedAt: -1 }, { name: 'charger_incidents' });
  await db.collection('incident_actions').createIndex({ incidentId: 1, at: 1 }, { name: 'incident_actions_timeline' });
  await db.collection('ingestion_receipts').createIndex({ createdAt: 1 }, { name: 'receipt_retention', expireAfterSeconds: 604800 });
  return created;
}
