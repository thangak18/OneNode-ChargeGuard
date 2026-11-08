import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { loadLocalEnv, validateConfig } from '../src/config/config';
import { createApplication } from '../src/bootstrap';
import { DatabaseService } from '../src/database/database.service';
import { TelemetryService } from '../src/telemetry/telemetry.service';
import { syntheticTick } from '../src/demo/synthetic-ticker';

/**
 * One-off backfill: the last 60 minutes of labelled SYNTHETIC baseline readings
 * (one per minute, five demo chargers) through the normal TelemetryService path.
 * The dashboard shows it as FRESH for ~60 s after the run, then STALE, and it
 * drops out of the 24 h summary window a day later. Timestamps are never in the
 * future. For a continuously fresh dashboard use the Render synthetic ticker.
 */
const MINUTES = 60;

async function main() {
  loadLocalEnv();
  validateConfig(process.env);
  const app = await createApplication(NestFactory);
  await app.init();
  try {
    const database = app.get(DatabaseService);
    const telemetry = app.get(TelemetryService);
    const deps = {
      async findActiveIncidentChargerId() {
        const active = await database.collection<{ chargerId?: string }>('incidents').findOne(
          { stationId: 'demo-station-01', status: { $in: ['OPEN', 'ACKNOWLEDGED', 'RESOLVING'] } },
          { projection: { chargerId: 1 } },
        );
        return active?.chargerId;
      },
      ingestBatch: (batch: { events: unknown[] }) => telemetry.ingestBatch(batch),
    };
    const end = Date.now();
    let written = 0;
    for (let m = MINUTES - 1; m >= 0; m--) {
      written += await syntheticTick(deps, MINUTES - m, new Date(end - m * 60_000));
    }
    console.log(`SEED_TELEMETRY_ONCE PASS: ${written} SYNTHETIC readings, ${MINUTES} min ending now`);
  } catch {
    console.error('SEED_TELEMETRY_ONCE FAIL (details withheld)');
    process.exitCode = 1;
  } finally {
    await app.close();
  }
}
void main();
