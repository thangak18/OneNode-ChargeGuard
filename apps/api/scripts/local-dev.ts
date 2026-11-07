import 'reflect-metadata';
import { randomBytes } from 'node:crypto';
import { NestFactory } from '@nestjs/core';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { MongoClient, Db } from 'mongodb';
import { loadLocalEnv, validateConfig } from '../src/config/config';
import { listenHost } from '../src/config/runtime';
import { createApplication, configureApplication } from '../src/bootstrap';
import { AppModule } from '../src/app.module';
import { DatabaseService } from '../src/database/database.service';
import { APP_CONFIG } from '../src/config/tokens';
import { initializeCollections } from '../src/database/initialize';
import { DemoService } from '../src/demo/demo.service';
import { TelemetryService } from '../src/telemetry/telemetry.service';
import { demoReading } from '../src/observability/demo-scenario';
import { JsonFrameworkLogger, ObservabilityService, observabilityConfig } from '../src/observability/observability.service';

async function seedData(db: Db): Promise<void> {
  const now = new Date();
  await db.collection('stations').updateOne(
    { _id: 'demo-station-01' as any },
    { $setOnInsert: { name: 'OneNode virtual station', capacityKW: 55, createdAt: now, updatedAt: now, location: { city: 'Virtual demo' } } },
    { upsert: true }
  );
  for (let i = 1; i <= 5; i++) {
    const id = `demo-charger-${String(i).padStart(2, '0')}`;
    await db.collection('chargers').updateOne(
      { _id: id as any },
      { $setOnInsert: { stationId: 'demo-station-01', connectorId: `virtual-${i}`, ratedPowerKW: 11, status: 'AVAILABLE', statusUpdatedAt: now, createdAt: now, updatedAt: now } },
      { upsert: true }
    );
  }
}

async function main() {
  loadLocalEnv();
  const cfg = validateConfig(process.env);

  let app!: INestApplication;
  let mongod: MongoMemoryServer | undefined;
  let client: MongoClient | undefined;

  // Try starting with Atlas standard application
  let useLocalFallback = false;
  try {
    const probeClient = new MongoClient(cfg.mongoUri, { serverSelectionTimeoutMS: 3000, connectTimeoutMS: 3000 });
    await probeClient.connect();
    await probeClient.db(cfg.mongoDatabase).admin().ping();
    await probeClient.close();
    console.log('[ChargeGuard API] Connected successfully to MongoDB Atlas.');
    app = await createApplication(NestFactory);
  } catch (err: any) {
    console.warn('[ChargeGuard API] MongoDB Atlas unavailable (' + (err.message || 'connection failed') + '). Falling back to in-memory MongoDB for local testing.');
    useLocalFallback = true;
  }

  if (useLocalFallback) {
    mongod = await MongoMemoryServer.create({ binary: { version: '8.0.16' } });
    const uri = mongod.getUri();
    client = new MongoClient(uri);
    await client.connect();
    const db = client.db('chargeguard');
    await initializeCollections(db);
    await seedData(db);

    const fakeDb = {
      db: () => db,
      collection: (name: string) => db.collection(name),
      ping: async () => true,
    };

    const bootstrapObs = new ObservabilityService({ ...observabilityConfig(process.env), enabled: false });
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(DatabaseService)
      .useValue(fakeDb)
      .overrideProvider(APP_CONFIG)
      .useValue({ ...cfg, nodeEnv: 'development' })
      .compile();

    app = configureApplication(moduleRef.createNestApplication({ logger: new JsonFrameworkLogger(bootstrapObs) }));
  }

  await app.listen(cfg.port, listenHost(process.env));
  console.log(`[ChargeGuard API] Listening on http://127.0.0.1:${cfg.port}/api/v1`);
  console.log(`[ChargeGuard API] Swagger documentation available at http://127.0.0.1:${cfg.port}/docs`);

  if (useLocalFallback) {
    console.warn('\n' + '!'.repeat(72));
    console.warn('[ChargeGuard API] RUNNING ON IN-MEMORY MONGODB — NOTHING IS WRITTEN TO ATLAS.');
    console.warn('[ChargeGuard API] Fix Atlas Network Access (add your current IP) and restart before recording.');
    console.warn('!'.repeat(72) + '\n');
    // Fresh in-memory DB: seed a clean baseline so charts have data right away.
    // (Never auto-reset on Atlas: that would silently close real active incidents.)
    try {
      await app.get(DemoService).reset();
      console.log('[ChargeGuard API] Initial synthetic baseline telemetry generated for all 5 chargers.');
    } catch (e) {
      console.warn('[ChargeGuard API] Baseline initialization notice:', e);
    }
  }

  // Continuous 8-second synthetic telemetry loop keeps the dashboard FRESH.
  // Writes go through the normal TelemetryService. The charger of an active
  // incident is skipped so its fault stays visible until it is resolved.
  //
  // In-memory fallback: on by default (disposable data).
  // Atlas: OFF by default, because Atlas is the shared database the read-only
  // cloud deployment also serves; an unattended laptop loop would make it look
  // live. Opt in explicitly with CHARGEGUARD_LOCAL_TICKER=true (e.g. while
  // recording). CHARGEGUARD_LOCAL_TICKER=false disables it in both modes.
  const tickerSetting = process.env.CHARGEGUARD_LOCAL_TICKER;
  const tickerEnabled = useLocalFallback ? tickerSetting !== 'false' : tickerSetting === 'true';
  if (!tickerEnabled && !useLocalFallback) {
    console.log('[ChargeGuard API] Synthetic telemetry ticker is OFF for Atlas (set CHARGEGUARD_LOCAL_TICKER=true to enable).');
  }
  if (tickerEnabled) {
    const database = app.get(DatabaseService);
    const telemetryService = app.get(TelemetryService);
    let tickerSeq = 1;
    const ticker = setInterval(async () => {
      try {
        const activeIncident = await database.collection('incidents').findOne({
          stationId: 'demo-station-01',
          status: { $in: ['OPEN', 'ACKNOWLEDGED', 'RESOLVING'] },
        });
        const now = new Date();
        const run = randomBytes(6).toString('hex');
        const faultChargerId = activeIncident?.chargerId;
        const events = [];
        for (let i = 1; i <= 5; i++) {
          const chargerId = `demo-charger-${String(i).padStart(2, '0')}`;
          if (faultChargerId === chargerId) continue;
          events.push(demoReading(run, tickerSeq, i, false, now));
        }
        if (events.length > 0) {
          await telemetryService.ingestBatch({ events });
          tickerSeq++;
        }
      } catch {
        // Safe skip on teardown or temporary conflict
      }
    }, 8000);

    if (ticker.unref) ticker.unref();
    console.log(`[ChargeGuard API] Synthetic telemetry ticker: every 8 s → ${useLocalFallback ? 'IN-MEMORY MongoDB' : 'MongoDB Atlas'}.`);
  }

  const cleanup = async () => {
    console.log('[ChargeGuard API] Shutting down...');
    if (app) await app.close();
    if (client) await client.close();
    if (mongod) await mongod.stop();
    process.exit(0);
  };

  process.on('SIGINT', cleanup);
  process.on('SIGTERM', cleanup);
}

void main().catch((err) => {
  console.error('[ChargeGuard API] Startup failure:', err);
  process.exit(1);
});

