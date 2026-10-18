import test from 'node:test';
import assert from 'node:assert/strict';
import {validateConfig} from '../src/config/config';
import {telemetrySchema} from '../src/telemetry/telemetry.schema';

const sampleEnv={MONGODB_URI:'mongodb+srv://fixture-user:fixture-secret@fake.mongodb.net/?retryWrites=true&w=majority', MONGODB_DATABASE:'chargeguard',INGEST_API_KEY:'fixture-ingest-key-with-sufficient-length'};
const fixture={eventId:'unit-1',ts:'2026-10-18T08:00:00Z',meta:{stationId:'station-01',chargerId:'charger-01'},currentA:5,sourceEnergyKWh:0,provenance:{sourceType:'ACN_REPLAY',fields:{currentA:'MEASURED',sourceEnergyKWh:'SOURCE_REPORTED'}}};

test('configuration accepts secure Atlas SRV and canonical database',()=>{
  const result=validateConfig(sampleEnv);
  assert.equal(result.mongoDatabase,'chargeguard');
  assert.equal(result.port,3001);
});
test('rejects wrong database and unresolved placeholders',()=>{
  assert.throws(()=>validateConfig({...sampleEnv,MONGODB_DATABASE:'admin'}),/Invalid environment/);
  assert.throws(()=>validateConfig({...sampleEnv,MONGODB_URI:'mongodb+srv://<db-user>:<pass>@fake.mongodb.net/'}),/MONGODB_URI/);
});
test('rejects disabled TLS verification',()=>{
  assert.throws(()=>validateConfig({...sampleEnv,MONGODB_URI:sampleEnv.MONGODB_URI+'&tlsAllowInvalidCertificates=true'}),/TLS/);
});
test('production requires ingest key',()=>{
  assert.throws(()=>validateConfig({...sampleEnv,NODE_ENV:'production',INGEST_API_KEY:undefined}),/INGEST_API_KEY/);
});
test('telemetry allows omitted optional sensors and zero energy',()=>{
  assert.equal(telemetrySchema.safeParse(fixture).success,true);
});
test('telemetry rejects unzoned time, negative current and unexpected fields',()=>{
  assert.equal(telemetrySchema.safeParse({...fixture,ts:'2026-10-18T08:00:00'}).success,false);
  assert.equal(telemetrySchema.safeParse({...fixture,currentA:-1}).success,false);
  assert.equal(telemetrySchema.safeParse({...fixture,secret:'unsafe'}).success,false);
});
test('provenance requires field attribution and derivation assumptions',()=>{
  assert.equal(telemetrySchema.safeParse({...fixture,provenance:{sourceType:'ACN_REPLAY',fields:{currentA:'MEASURED'}}}).success,false);
  assert.equal(telemetrySchema.safeParse({...fixture,provenance:{sourceType:'DERIVED',fields:{currentA:'DERIVED',sourceEnergyKWh:'SOURCE_REPORTED'}}}).success,false);
});
test('do not label ACN missing power as measured',()=>{
  const item={...fixture,powerKW:5,provenance:{sourceType:'ACN_REPLAY',fields:{currentA:'MEASURED',sourceEnergyKWh:'SOURCE_REPORTED',powerKW:'MEASURED'}}};
  assert.equal(telemetrySchema.safeParse(item).success,false);
});
