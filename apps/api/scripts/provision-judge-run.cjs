/**
 * Explicit owner-only Atlas provisioning. From the repo root:
 *   node apps/api/scripts/provision-judge-run.cjs --audit
 *   node apps/api/scripts/provision-judge-run.cjs --provision --owner-id=<numeric GitHub ID>
 * A repeated provision deliberately fails before writing any documents.
 */
const fs = require('node:fs');
const path = require('node:path');
const { createHash, randomBytes } = require('node:crypto');
const dotenv = require('dotenv');
const { MongoClient, BSON } = require('mongodb');
const { EJSON } = BSON;

const args = process.argv.slice(2);
const provision = args.includes('--provision');
const audit = args.length === 1 && args[0] === '--audit';
const ownerArgument = args.find((arg) => arg.startsWith('--owner-id='));
const id = ownerArgument?.slice('--owner-id='.length);
if (!(audit || (provision && args.length === 2 && /^\d+$/.test(id || '')))) {
  console.error('Usage: --audit OR --provision --owner-id=<numeric GitHub ID>');
  process.exit(2);
}

const env = dotenv.parse(fs.readFileSync(path.join(__dirname, '../../../.env')));
if (!env.MONGODB_URI?.startsWith('mongodb+srv://') || env.MONGODB_DATABASE !== 'chargeguard') {
  throw new Error('Expected restricted Atlas SRV configuration for database chargeguard');
}

const protectedCollections = ['chargers', 'stations', 'incidents', 'incident_actions', 'telemetry', 'ingestion_receipts'];
let stage = 'connection';

async function fingerprint(db, name) {
  const hash = createHash('sha256');
  let count = 0;
  const cursor = db.collection(name).find({}).sort({ _id: 1 });
  for await (const doc of cursor) {
    hash.update(EJSON.stringify(doc, { relaxed: false }));
    hash.update('\n');
    count++;
  }
  return { count, digest: hash.digest('hex') };
}

async function main() {
  const client = new MongoClient(env.MONGODB_URI, { serverSelectionTimeoutMS: 15000 });
  try {
    await client.connect();
    const db = client.db('chargeguard');
    stage = 'ping';
    await db.command({ ping: 1 });
    stage = 'collection audit';
    const existingNames = new Set((await db.listCollections({}, { nameOnly: true }).toArray()).map((c) => c.name));
    const pre = {};
    for (const name of protectedCollections) {
      if (!existingNames.has(name)) throw new Error(`Expected original collection missing: ${name}`);
      stage = `fingerprint ${name}`;
      pre[name] = await fingerprint(db, name);
    }
    stage = 'protected document audit';
    const pinned = await db.collection('incidents').findOne({ _id: 'demo-58a1983cae09' });
    if (!pinned) throw new Error('Pinned Phase D incident missing; no writes performed');
    if (!await db.collection('chargers').findOne({ _id: 'demo-charger-01', stationId: 'demo-station-01' }) ||
        !await db.collection('stations').findOne({ _id: 'demo-station-01' })) {
      throw new Error('Expected virtual charger/station missing; no writes performed');
    }
    const existingRuns = existingNames.has('judge_runs') ? await db.collection('judge_runs').find({}).limit(2).toArray() : [];
    console.log('Atlas ping: PASS; original collections:', protectedCollections.length);
    console.log('Pinned Phase D incident: PRESENT');
    console.log('Existing judge run count:', existingRuns.length === 2 ? '2 or more' : existingRuns.length);
    if (audit) return;
    if (existingRuns.length) throw new Error('Judge run already exists; provisioning refused safely');
    stage = 'single run insertion';
    const owner = `github:${id}`;
    const runId = `judge-${randomBytes(12).toString('hex')}`;
    const doc = {
      _id: runId,
      owner,
      stationId: 'demo-station-01',
      chargerId: 'demo-charger-01',
      synthetic: true,
      status: 'BASELINE',
      revision: 0,
      actions: [],
    };
    // First insert implicitly creates judge_runs with its built-in unique _id index.
    await db.collection('judge_runs').insertOne(doc);
    const stored = await db.collection('judge_runs').findOne({ _id: runId, owner, synthetic: true });
    if (!stored || stored.status !== 'BASELINE' || stored.revision !== 0 || stored.actions.length !== 0) {
      throw new Error('Provisioned run verification failed; inspect the single new run before retrying');
    }
    const postNames = new Set((await db.listCollections({}, { nameOnly: true }).toArray()).map((c) => c.name));
    const added = [...postNames].filter((name) => !existingNames.has(name));
    if (added.length !== (existingNames.has('judge_runs') ? 0 : 1) ||
      added.some((name) => name !== 'judge_runs')) throw new Error('Unexpected collection change');
    const unchanged = [];
    for (const name of protectedCollections) {
      stage = `post-provision fingerprint ${name}`;
      const after = await fingerprint(db, name);
      unchanged.push(after.count === pre[name].count && after.digest === pre[name].digest);
    }
    if (unchanged.some((same) => !same)) throw new Error('Original records changed during provisioning; investigate');
    console.log('PROVISIONED_RUN_ID:', runId);
    console.log('Owner verified:', true, 'Synthetic:', true);
    console.log('Created collections:', added.length ? added.join(',') : 'none (pre-existing judge_runs)');
    console.log('Indexes:', (await db.collection('judge_runs').listIndexes().toArray()).map((idx) => idx.name).join(','));
    console.log('Original six collection fingerprints unchanged: PASS');
    console.log('Phase D incident preserved: PASS');
  } finally {
    await client.close();
  }
}

main().catch((err) => {
  // Never print native driver errors: they can contain private hostnames/URLs.
  console.error('PROVISIONING_STOPPED:', err.message.startsWith('Judge run already exists') ?
    'Judge run already exists; provisioning refused safely' : `${stage}: ${err.name}`);
  process.exitCode = 1;
});
