import { MongoClient, MongoServerError } from 'mongodb';
import { loadLocalEnv, validateConfig } from '../src/config/config';
import { initializeCollections } from '../src/database/initialize';

async function main() {
  let client: MongoClient | undefined;
  let stage='configuration';
  try {
    loadLocalEnv();
    const cfg = validateConfig(process.env);
    client = new MongoClient(cfg.mongoUri);
    stage='connection';
    await client.connect();
    stage='collection/index initialization';
    const created = await initializeCollections(client.db(cfg.mongoDatabase));
    console.log('COLLECTION_INITIALIZATION PASS');
    console.log('CREATED:', created.length ? created.join(', ') : '(none; already initialized)');
    console.log('INDEXES PASS');
  } catch (error) {
    const kind=error instanceof MongoServerError ? ` MongoDB code=${error.code??'unknown'} codeName=${error.codeName??'unknown'}` : '';
    console.error(`COLLECTION_INITIALIZATION FAIL at ${stage}.${kind}`);
    process.exitCode = 1;
  } finally { if(client) await client.close(); }
}
void main();
