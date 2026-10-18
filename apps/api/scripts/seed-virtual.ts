import { MongoClient } from 'mongodb';
import { loadLocalEnv, validateConfig } from '../src/config/config';

async function main() {
  loadLocalEnv();
  const {mongoUri, mongoDatabase} = validateConfig(process.env);
  const client = new MongoClient(mongoUri);
  try {
    await client.connect();
    const db = client.db(mongoDatabase);
    const now = new Date();
    await db.collection<{_id:string}>('stations').updateOne({_id: 'demo-station-01'}, {$setOnInsert: { name:'OneNode virtual station', capacityKW: 55, createdAt:now, updatedAt:now, location: {city:'Virtual demo'} }}, {upsert:true});
    for (let i=1;i<=5;i++) {
      const id=`demo-charger-${String(i).padStart(2,'0')}`;
      await db.collection<{_id:string}>('chargers').updateOne({_id:id}, {$setOnInsert: {stationId:'demo-station-01', connectorId:`virtual-${i}`, ratedPowerKW:11, status:'AVAILABLE', statusUpdatedAt:now, createdAt:now, updatedAt:now }}, {upsert:true});
    }
    console.log('VIRTUAL_ASSETS PASS: one virtual station, five virtual charger references (existing documents preserved)');
  } catch {console.error('VIRTUAL_ASSETS FAIL (details withheld)'); process.exitCode=1;}
  finally {await client.close();}
}
void main();
