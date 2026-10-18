import { MongoClient } from 'mongodb';
import { loadLocalEnv, validateConfig } from '../src/config/config';

const required = ['stations', 'chargers', 'telemetry', 'incidents', 'incident_actions', 'ingestion_receipts'];
const requiredIndexes: Record<string,string[]> = {
  chargers: ['station_connector_unique','station_status'],
  telemetry: ['charger_time','station_time'],
  incidents: ['incident_queue','charger_incidents'],
  incident_actions: ['incident_actions_timeline'],
  ingestion_receipts: ['receipt_retention']
};

async function main(): Promise<void> {
  loadLocalEnv();
  const config=validateConfig(process.env);
  const client=new MongoClient(config.mongoUri,{serverSelectionTimeoutMS:10000});
  try {
    await client.connect();
    const db=client.db(config.mongoDatabase);
    if((await db.admin().ping()).ok!==1) throw new Error('Ping did not succeed');
    console.log('ATLAS_PING PASS');

    const status=await db.admin().command({connectionStatus:1,showPrivileges:true});
    const users=(status.authInfo?.authenticatedUsers??[]) as Array<{user:string}>;
    const roles=(status.authInfo?.authenticatedUserRoles??[]) as Array<{role:string;db:string}>;
    const privileges=(status.authInfo?.authenticatedUserPrivileges??[]) as Array<{resource:{db?:string;anyResource?:boolean;cluster?:boolean}}>;
    if(users.length!==1 || users[0].user!=='chargeguard_dev' ||
       roles.length!==1 || roles[0].role!=='chargeguard_rw' ||
       roles.some(role=>role.role==='atlasAdmin' || role.role==='readWriteAnyDatabase') ||
       !privileges.length || privileges.some(item=>item.resource.db!=='chargeguard' || item.resource.anyResource || item.resource.cluster))
      throw new Error('Unexpected application-user privilege scope');
    console.log('ATLAS_LEAST_PRIVILEGE PASS');

    const present=new Map((await db.listCollections().toArray()).map(c=>[c.name,c]));
    if(required.some(name=>!present.has(name)) || present.get('telemetry')?.type!=='timeseries')
      throw new Error('Missing collection or telemetry is not time-series');
    console.log(`ATLAS_COLLECTIONS PASS (${required.length} required; telemetry time-series)`);

    for(const [collection,expected] of Object.entries(requiredIndexes)) {
      const indexes=(await db.collection(collection).listIndexes().toArray()).map(i=>i.name);
      if(expected.some(name=>!indexes.includes(name))) throw new Error(`Missing expected index on ${collection}`);
    }
    console.log('ATLAS_INDEXES PASS');

    const stations=await db.collection<{_id:string}>('stations').countDocuments({_id:'demo-station-01'});
    const chargers=await db.collection('chargers').countDocuments({stationId:'demo-station-01'});
    if(stations!==1 || chargers<5) throw new Error('Demo virtual assets missing');
    console.log(`ATLAS_VIRTUAL_ASSETS PASS (station=${stations}, chargers=${chargers})`);
  } catch {
    // Never log MongoDB exceptions: some errors include credentials or hostnames.
    console.error('ATLAS_VERIFICATION FAIL; inspect sanitized operational diagnostics');
    process.exitCode=1;
  } finally {
    await client.close();
  }
}
void main();
