/**
 * Judge policy index preflight. Does not read .env or contact Atlas in --plan.
 * --audit performs read-only inspection. --provision is intentionally blocked
 * without a separate owner-approved invocation and explicit opt-in.
 * Never run --provision during the read-only Judge Demo preparation phase.
 */
const fs = require('node:fs');
const path = require('node:path');
const { MongoClient } = require('mongodb');

const RUN = 'judge-4afc45f4427ab21f48d61c89';
const OWNER = 'github:138879141';
const PINNED = 'demo-58a1983cae09';
const usage = 'Usage: --plan | --audit | --provision --apply-with-separate-owner-approval';
const args = process.argv.slice(2);
const plan = args.length === 1 && args[0] === '--plan';
const audit = args.length === 1 && args[0] === '--audit';
const provision = args.length === 2 && args[0] === '--provision' && args[1] === '--apply-with-separate-owner-approval';
if (!plan && !audit && !provision) { console.error(usage); process.exit(2); }

if (plan) {
  console.log('PLAN ONLY: no environment read, network calls or database writes.');
  console.log('Scope: existing run', RUN, 'owned by', OWNER);
  console.log('Planned changes: create judge_policy if absent; create expiresAt_ttl {expiresAt:1}, expireAfterSeconds=0 if absent.');
  console.log('Nonce/quota records are written only by later authorized judge actions.');
  process.exit(0);
}

if (provision && process.env.JUDGE_POLICY_PROVISION_APPROVED !== 'true') {
  console.error('STOP: distinct owner approval for judge_policy is required. No network call or write performed.');
  process.exit(2);
}

let stage = 'config';
async function main() {
  const env = require('dotenv').parse(fs.readFileSync(path.join(__dirname, '../../../.env')));
  if (!env.MONGODB_URI?.startsWith('mongodb+srv://') || env.MONGODB_DATABASE !== 'chargeguard')
    throw new Error('Configuration rejected');
  const client = new MongoClient(env.MONGODB_URI, { serverSelectionTimeoutMS: 15000 });
  try {
    stage = 'connect';
    await client.connect();
    const db = client.db('chargeguard');
    stage = 'read-only preflight';
    await db.command({ ping: 1 });
    const runs = await db.collection('judge_runs').find({}).limit(2).toArray();
    if (runs.length !== 1 || runs[0]._id !== RUN || runs[0].owner !== OWNER ||
        runs[0].synthetic !== true || runs[0].stationId !== 'demo-station-01' ||
        runs[0].chargerId !== 'demo-charger-01' || runs[0].status !== 'BASELINE' ||
        runs[0].revision !== 0 || (runs[0].actions || []).length !== 0)
      throw new Error('Existing judge run state unexpected');
    if (!await db.collection('incidents').findOne({ _id: PINNED }))
      throw new Error('Pinned Phase D evidence missing');
    const names = new Set((await db.listCollections({}, { nameOnly: true }).toArray()).map(c => c.name));
    const exists = names.has('judge_policy');
    const indexes = exists ? await db.collection('judge_policy').listIndexes().toArray() : [];
    const ttl = indexes.find(i => i.name === 'expiresAt_ttl');
    if (ttl && !(ttl.expireAfterSeconds === 0 && ttl.key?.expiresAt === 1 && Object.keys(ttl.key).length === 1))
      throw new Error('Conflicting TTL index: manual security review required');
    if (exists && await db.collection('judge_policy').countDocuments({}, { limit: 1 }))
      throw new Error('Nonempty policy collection: manual security review required');
    console.log('Atlas ping and pinned run/incident preflight: PASS');
    console.log('Policy collection:', exists ? 'EXISTS' : 'ABSENT');
    console.log('Expected TTL:', ttl ? 'PRESENT' : 'ABSENT');
    if (audit) return;
    stage = 'index provisioning';
    // Creating the index on an absent collection creates that collection too.
    await db.collection('judge_policy').createIndex({ expiresAt: 1 }, { name: 'expiresAt_ttl', expireAfterSeconds: 0 });
    const after = await db.collection('judge_policy').listIndexes().toArray();
    if (!after.some(i => i.name === 'expiresAt_ttl' && i.expireAfterSeconds === 0 && i.key?.expiresAt === 1))
      throw new Error('Index verification failed; keep judge writes disabled');
    console.log('Provisioning verified: judge_policy / _id_ / expiresAt_ttl');
  } finally { await client.close(); }
}
main().catch(e => {
  // Never print the MongoDB driver's original error: it may contain infrastructure identifiers.
  console.error(`STOP at ${stage}: ${e instanceof Error && /^Existing judge|^Pinned Phase|^Conflicting TTL|^Nonempty policy/.test(e.message) ? e.message : 'check configuration, connectivity or privileges privately'}`);
  process.exitCode = 1;
});
