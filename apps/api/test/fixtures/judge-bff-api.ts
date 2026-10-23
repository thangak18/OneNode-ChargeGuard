import 'reflect-metadata';
import { Test } from '@nestjs/testing';
import { VersioningType } from '@nestjs/common';
import { MongoClient } from 'mongodb';
import { readFileSync } from 'node:fs';
import { JudgeController } from '../../src/judge/judge.controller';
import { DatabaseService } from '../../src/database/database.service';
import { deploymentPolicy } from '../../src/common/deployment-policy';

// Never bootstrap main.ts: it loads local environment files and unrelated services.
async function main() {
  const uri = process.env.FIXTURE_MONGO_URI!;
  if (!/^mongodb:\/\/127\.0\.0\.1:\d+\//.test(uri)) throw new Error('Loopback MongoDB required');
  const client = await new MongoClient(uri).connect();
  const module = await Test.createTestingModule({
    controllers: [JudgeController],
    providers: [{ provide: DatabaseService, useValue: { db: () => client.db('judge_bff_http') } }],
  }).compile();
  const app = module.createNestApplication({ httpsOptions: {
    key: readFileSync(process.env.FIXTURE_TLS_KEY!), cert: readFileSync(process.env.FIXTURE_TLS_CERT!),
  } });
  app.use(deploymentPolicy(process.env));
  app.use((req: any, _res: unknown, next: () => void) => {
    if (req.method === 'POST' && req.headers['x-chargeguard-operator']) {
      process.send?.({ kind: 'assertion', path: req.url, token: req.headers['x-chargeguard-operator'] });
    }
    next();
  });
  (app as any).useBodyParser('json', { limit: '8kb', verify: (req: any, _res: unknown, body: Buffer) => { req.rawBody = Buffer.from(body); } });
  app.setGlobalPrefix('api');
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
  await app.listen(0, '127.0.0.1');
  process.send?.({ kind: 'ready', url: await app.getUrl() });
  process.on('message', (message: any) => {
    if (message?.kind === 'rearm' && typeof message.enabled === 'boolean') {
      process.env.JUDGE_REARM_ENABLED = String(message.enabled);
      process.send?.({ kind: 'rearm', enabled: message.enabled });
    }
  });
  let stopping = false;
  const stop = async () => {
    if (stopping) return;
    stopping = true;
    await app.close(); await client.close(); process.exit(0);
  };
  process.on('SIGTERM', stop); process.on('SIGINT', stop); process.on('disconnect', stop);
}
void main().catch(error => { console.error(error); process.exit(1); });
