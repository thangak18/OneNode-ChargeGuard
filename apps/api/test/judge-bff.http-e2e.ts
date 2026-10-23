import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn, execFileSync, type ChildProcess } from 'node:child_process';
import { mkdtemp, mkdir, cp, writeFile, readFile, symlink, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import { createRequire } from 'node:module';
import { randomBytes } from 'node:crypto';
import https from 'node:https';
import net from 'node:net';
import { once } from 'node:events';
import { MongoMemoryServer, DryMongoBinary } from 'mongodb-memory-server';
import { MongoClient } from 'mongodb';
import { decodeJwt } from 'jose';

const api = resolve(__dirname, '..');
const web = resolve(api, '../web');
const fixtures = resolve(__dirname, 'fixtures');
const requireWeb = createRequire(join(web, 'package.json'));
const { encode } = requireWeb('next-auth/jwt');
const runId = 'judge-4afc45f4427ab21f48d61c89';
const owner = 'github:138879141';
const otherId = 'judge-000000000000000000000001';

test('real HTTPS Next BFF → Nest → disposable Mongo: two cycles, auth, CSRF, stale and replay', { timeout: 180_000 }, async t => {
  assert.equal(process.versions.node.split('.')[0], '24', 'Run this harness with Node 24');
  const dir = await mkdtemp(join(tmpdir(), 'chargeguard-bff-http-'));
  const children: ChildProcess[] = [];
  let mongo: MongoMemoryServer | undefined;
  let client: MongoClient | undefined;
  const logs: string[] = [];
  t.after(async () => {
    for (const child of children.reverse()) {
      if (child.exitCode !== null || child.signalCode) continue;
      child.kill('SIGTERM');
      await Promise.race([once(child, 'exit'), new Promise<void>(resolve => {
        const timer = setTimeout(() => { child.kill('SIGKILL'); resolve(); }, 5000); timer.unref();
      })]);
    }
    await client?.close(); await mongo?.stop(); await rm(dir, { recursive: true, force: true });
  });
  // Whitelist only basic runtime locations; never inherit credentials or deployment flags.
  const env: NodeJS.ProcessEnv = {
    PATH: `${resolve(process.execPath, '..')}:${process.env.PATH ?? ''}`, HOME: process.env.HOME,
    TMPDIR: tmpdir(), NODE_ENV: 'development', NEXT_TELEMETRY_DISABLED: '1',
    NEXTAUTH_SECRET: randomBytes(32).toString('hex'), OPERATOR_ASSERTION_SECRET: randomBytes(32).toString('hex'),
    JUDGE_WRITE_API_KEY: randomBytes(32).toString('hex'), NEST_READ_API_KEY: randomBytes(32).toString('hex'),
    OPERATOR_GITHUB_IDS: '138879141,456', JUDGE_ROUTES_ENABLED: 'true', JUDGE_READS_ENABLED: 'true',
    JUDGE_REARM_ENABLED: 'true',
  };
  const key = join(dir, 'server.key'); const cert = join(dir, 'server.pem'); const caPath = join(dir, 'ca.pem');
  const openssl = (args: string[]) => execFileSync('openssl', args, { cwd: dir, stdio: 'pipe' });
  openssl(['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-keyout', 'ca.key', '-out', 'ca.pem', '-days', '1', '-subj', '/CN=ChargeGuard disposable HTTP test CA']);
  openssl(['req', '-newkey', 'rsa:2048', '-nodes', '-keyout', 'server.key', '-out', 'server.csr', '-subj', '/CN=127.0.0.1']);
  await writeFile(join(dir, 'extensions'), 'subjectAltName=IP:127.0.0.1,DNS:localhost\nextendedKeyUsage=serverAuth\nbasicConstraints=CA:FALSE\n');
  openssl(['x509', '-req', '-in', 'server.csr', '-CA', 'ca.pem', '-CAkey', 'ca.key', '-CAcreateserial', '-out', 'server.pem', '-days', '1', '-extfile', 'extensions']);
  const ca = await readFile(caPath);
  Object.assign(env, { NODE_EXTRA_CA_CERTS: caPath, FIXTURE_TLS_KEY: key, FIXTURE_TLS_CERT: cert });
  // Explicitly prohibit downloads: an absent cached MongoDB binary fails with setup instructions.
  const binary = await DryMongoBinary.locateBinary({ version: '8.0.16' });
  assert.ok(binary, 'Cache MongoDB 8.0.16 before running: this harness never downloads binaries');
  mongo = await MongoMemoryServer.create({ binary: { version: '8.0.16', systemBinary: binary }, instance: { ip: '127.0.0.1' } });
  client = await new MongoClient(mongo.getUri()).connect();
  const db = client.db('judge_bff_http');
  const baseline = { _id: runId, owner, synthetic: true, stationId: 'demo-station-01', chargerId: 'demo-charger-01', status: 'BASELINE', revision: 0, actions: [], observations: [] };
  // Deliberately omit cycle: exercises existing legacy documents' cycle=1 behavior.
  await db.collection('judge_runs').insertMany([baseline as any, { ...baseline, _id: otherId, owner: 'github:456' } as any]);
  const originalCollections = ['incidents', 'chargers', 'telemetry', 'stations', 'incident_actions', 'ingestion_receipts'];
  for (const name of originalCollections) await db.collection(name).insertOne({ _id: (name === 'incidents' ? 'demo-58a1983cae09' : `sentinel-${name}`) as any, status: 'RESOLVED', evidence: ['unchanged'] });
  const originals = await Promise.all(originalCollections.map(name => db.collection(name).find({}).toArray()));
  const otherBefore = await db.collection('judge_runs').findOne({ _id: otherId as any });

  function start(file: string, cwd: string, extra: NodeJS.ProcessEnv = {}, ts = false) {
    const args = ['--require', join(fixtures, 'judge-bff-loopback.cjs')];
    if (ts) args.push('--import', join(api, 'node_modules/tsx/dist/loader.mjs'));
    const child = spawn(process.execPath, [...args, file], { cwd, env: { ...env, ...extra }, stdio: ['ignore', 'pipe', 'pipe', 'ipc'] });
    children.push(child);
    child.stdout?.on('data', data => logs.push(String(data))); child.stderr?.on('data', data => logs.push(String(data)));
    return child;
  }
  async function ready(child: ChildProcess): Promise<any> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`Child startup timeout\n${logs.join('')}`)), 60000);
      child.on('message', (message: any) => { if (message.kind === 'ready') { clearTimeout(timer); resolve(message); } });
      child.once('exit', code => { clearTimeout(timer); reject(new Error(`Child exited ${code}\n${logs.join('')}`)); });
      child.once('error', error => { clearTimeout(timer); reject(error); });
    });
  }
  const port = await new Promise<number>(resolve => {
    const server = net.createServer(); server.listen(0, '127.0.0.1', () => {
      const port = (server.address() as net.AddressInfo).port; server.close(() => resolve(port));
    });
  });
  const origin = `https://127.0.0.1:${port}`;
  Object.assign(env, { NEXTAUTH_URL: origin, OPERATOR_ORIGIN: origin, FIXTURE_MONGO_URI: mongo.getUri() });
  const backend = start(join(fixtures, 'judge-bff-api.ts'), api, {}, true);
  const assertions: { path: string; token: string }[] = [];
  backend.on('message', (message: any) => { if (message.kind === 'assertion') assertions.push(message); });
  const backendUrl = (await ready(backend)).url;
  const project = join(dir, 'web');
  await mkdir(join(project, 'src/app/api'), { recursive: true }); await mkdir(join(project, 'src/lib'), { recursive: true });
  await cp(join(web, 'src/app/api/judge'), join(project, 'src/app/api/judge'), { recursive: true });
  for (const file of ['judge-read.ts', 'judge-read-session.mts', 'judge-production-gate.mts', 'operator-assertion.ts', 'operator-session.mts', 'operator-policy.mts']) {
    await cp(join(web, 'src/lib', file), join(project, 'src/lib', file));
  }
  await symlink(join(web, 'node_modules'), join(project, 'node_modules'), 'dir');
  await writeFile(join(project, 'package.json'), JSON.stringify({ private: true }));
  await writeFile(join(project, 'tsconfig.json'), JSON.stringify({ compilerOptions: { target: 'ES2022', module: 'esnext', moduleResolution: 'bundler', jsx: 'preserve', allowImportingTsExtensions: true, paths: { '@/*': ['./src/*'] } } }));
  // The broad filesystem root permits the node_modules symlink; only copied routes are served.
  await writeFile(join(project, 'next.config.js'), 'module.exports={distDir:".next-http-fixture",turbopack:{root:"/"}};\n');
  const next = start(join(fixtures, 'judge-bff-next.cjs'), project, { PORT: String(port), NEST_API_BASE_URL: backendUrl });
  await ready(next);

  type Reply = { status: number; body: any };
  function http(url: string, method = 'GET', headers: Record<string, string> = {}, body?: string, trusted = true): Promise<Reply> {
    assert.equal(new URL(url).hostname, '127.0.0.1');
    return new Promise((resolve, reject) => {
      const req = https.request(url, { method, headers, ca: trusted ? ca : undefined, rejectUnauthorized: true, timeout: 45000 }, res => {
        const chunks: Buffer[] = []; res.on('data', chunk => chunks.push(chunk));
        res.on('end', () => { try { resolve({ status: res.statusCode!, body: JSON.parse(Buffer.concat(chunks).toString()) }); } catch { reject(new Error(`Non-JSON HTTP ${res.statusCode}: ${Buffer.concat(chunks).toString().slice(0, 200)}\n${logs.join('').slice(-8000)}`)); } });
      });
      req.on('error', reject); req.on('timeout', () => req.destroy(new Error('HTTP timeout'))); req.end(body);
    });
  }
  const cookie = async (id = '138879141', secret = env.NEXTAUTH_SECRET!, maxAge = 600) =>
    `__Secure-next-auth.session-token=${await encode({ token: { operatorId: id }, secret, maxAge })}`;
  const headers = { cookie: await cookie(), origin, 'sec-fetch-site': 'same-origin', 'content-type': 'application/json' };
  const base = `${origin}/api/judge/runs/${runId}`;
  const read = async () => { const result = await http(base, 'GET', { cookie: headers.cookie }); assert.equal(result.status, 200, JSON.stringify(result.body)); return result.body; };
  const precondition = (run: any) => JSON.stringify({ expectedRevision: run.revision, expectedCycle: run.cycle ?? 1 });
  const action = async (operation: string) => {
    const result = await http(`${base}/${operation}`, 'POST', headers, precondition(await read()));
    assert.equal(result.status, 201, `${operation}: ${JSON.stringify(result.body)}`); return result.body;
  };
  await t.test('test CA is required; Next signed secure cookies and ownership enforced', async () => {
    await assert.rejects(http(base, 'GET', {}, undefined, false), /certificate|issuer|verify/i);
    for (const value of ['', await cookie('999'), await cookie('138879141', 'wrong-test-secret'), await cookie('138879141', env.NEXTAUTH_SECRET!, -60)]) {
      assert.equal((await http(base, 'GET', { cookie: value })).status, 401);
    }
    assert.equal((await http(base, 'GET', { cookie: headers.cookie, authorization: 'Bearer spoofed' })).status, 401);
    assert.equal((await http(base, 'GET', { cookie: await cookie('456') })).status, 404);
    const list = await http(`${origin}/api/judge/runs`, 'GET', { cookie: headers.cookie });
    assert.equal(list.status, 200); assert.deepEqual(list.body.map((run: any) => run._id), [runId]); assert.equal(list.body[0].owner, undefined);
  });
  await t.test('anonymous, CSRF, body injection and invalid early reset cannot mutate', async () => {
    const body = precondition(await read());
    for (const change of [{ cookie: '' }, { origin: 'https://evil.invalid' }, { 'sec-fetch-site': 'cross-site' }, { 'content-type': 'text/plain' }]) {
      assert.equal((await http(`${base}/fault`, 'POST', { ...headers, ...change }, body)).status, 403);
    }
    for (const value of ['{}', JSON.stringify({ expectedRevision: 0, expectedCycle: 1, actor: owner })]) {
      assert.equal((await http(`${base}/fault`, 'POST', headers, value)).status, 403);
    }
    assert.equal((await http(`${base}/reset`, 'POST', headers, body)).status, 409);
    assert.equal((await read()).revision, 0);
  });
  await t.test('full cycle, stale action, signed replay, reset retaining evidence, second cycle', async () => {
    const stale = precondition(await read());
    for (const operation of ['fault', 'acknowledge', 'recover', 'resolve']) await action(operation);
    let run = await read(); assert.equal(run.status, 'RESOLVED'); assert.equal(run.revision, 4);
    assert.equal((await http(`${base}/fault`, 'POST', headers, precondition(run))).status, 409);
    assert.equal((await http(`${base}/fault`, 'POST', headers, stale)).status, 409);
    const firstActions = run.actions; const firstObservations = run.observations;
    await action('reset'); run = await read();
    assert.equal(run.cycle, 2); assert.equal(run.revision, 5); assert.equal(run.status, 'BASELINE');
    assert.deepEqual(run.actions.slice(0, 4), firstActions); assert.deepEqual(run.observations, firstObservations);
    const captured = assertions.find(item => item.path.endsWith('/fault'))!;
    const signed = decodeJwt(captured.token); assert.equal(signed.expectedRevision, 0); assert.equal(signed.expectedCycle, 1);
    assert.equal((await http(`${backendUrl}${captured.path}`, 'POST', {
      origin, 'content-type': 'application/json', 'x-chargeguard-write-key': env.JUDGE_WRITE_API_KEY!, 'x-chargeguard-operator': captured.token,
    }, stale)).status, 409);
    const current = precondition(await read());
    const raced = await Promise.all([http(`${base}/fault`, 'POST', headers, current), http(`${base}/fault`, 'POST', headers, current)]);
    assert.deepEqual(raced.map(result => result.status).sort(), [201, 409]);
    for (const operation of ['acknowledge', 'recover', 'resolve']) await action(operation);
    run = await read(); assert.equal(run.status, 'RESOLVED'); assert.equal(run.cycle, 2); assert.equal(run.revision, 9);
    assert.equal(run.actions.length, 9); assert.equal(run.observations.length, 4);
    assert.deepEqual(run.actions.map((item: any) => item.cycle), [1, 1, 1, 1, 2, 2, 2, 2, 2]);
    assert.deepEqual(run.observations.map((item: any) => item.cycle), [1, 1, 2, 2]);
    assert.ok(run.actions.every((item: any) => item.actor === owner));
    assert.deepEqual(run.observations.map((item: any) => [item.currentA, item.chargingState, item.sourceType]), [[0, 'FAULT', 'SYNTHETIC'], [8.25, 'CHARGING', 'SYNTHETIC'], [0, 'FAULT', 'SYNTHETIC'], [8.25, 'CHARGING', 'SYNTHETIC']]);
  });
  await t.test('re-arm opt-in is enforced independently by BFF and API', async () => {
    async function rearm(child: ChildProcess, enabled: boolean) {
      const changed = new Promise<void>(resolve => {
        const listener = (message: any) => { if (message.kind === 'rearm' && message.enabled === enabled) { child.off('message', listener); resolve(); } };
        child.on('message', listener);
      });
      child.send({ kind: 'rearm', enabled }); await changed;
    }
    const body = precondition(await read());
    await rearm(next, false);
    assert.equal((await http(`${base}/reset`, 'POST', headers, body)).status, 403);
    await rearm(next, true); await rearm(backend, false);
    assert.equal((await http(`${base}/reset`, 'POST', headers, body)).status, 403);
    await rearm(backend, true); assert.equal((await read()).revision, 9);
  });
  await t.test('original collections and other owner run remain byte-for-byte equivalent', async () => {
    for (const [index, name] of originalCollections.entries()) assert.deepEqual(await db.collection(name).find({}).toArray(), originals[index]);
    assert.deepEqual(await db.collection('judge_runs').findOne({ _id: otherId as any }), otherBefore);
    assert.ok(await db.collection('judge_policy').countDocuments() > 0);
  });
});
