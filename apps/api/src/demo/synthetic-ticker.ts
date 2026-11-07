import { randomBytes } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { TelemetryService } from '../telemetry/telemetry.service';
import { demoReading } from '../observability/demo-scenario';

/**
 * Synthetic "live" telemetry for the five virtual demo chargers.
 *
 * Every reading is labelled SYNTHETIC (see demoReading) and goes through the
 * normal TelemetryService path (validation, idempotency receipt, 7-day TTL).
 * The charger of an active incident is skipped so a fault stays visible until
 * an operator resolves it. Nothing here creates, changes or closes incidents.
 */

export const SYNTHETIC_TICK_MS = 8000;

/**
 * Hosted Render API: ON by default so the public read-only dashboard has fresh
 * data whenever the free instance is awake (it sleeps when nobody visits).
 * Set CHARGEGUARD_SYNTHETIC_TICKER=false to turn it off, or =true to force it
 * on elsewhere. Vercel serverless functions never run it (no long-lived process).
 */
export function syntheticTickerEnabled(env: NodeJS.ProcessEnv): boolean {
  const flag = env.CHARGEGUARD_SYNTHETIC_TICKER;
  if (env.VERCEL === '1') return false;
  if (flag === 'false') return false;
  return flag === 'true' || env.RENDER === 'true';
}

export interface SyntheticTickDeps {
  findActiveIncidentChargerId(): Promise<string | undefined>;
  ingestBatch(batch: { events: unknown[] }): Promise<unknown>;
}

/** One tick: baseline readings for every demo charger except one with an active incident. */
export async function syntheticTick(deps: SyntheticTickDeps, sequence: number, now = new Date()): Promise<number> {
  const faultChargerId = await deps.findActiveIncidentChargerId();
  const run = randomBytes(6).toString('hex');
  const events = [];
  for (let i = 1; i <= 5; i++) {
    const chargerId = `demo-charger-${String(i).padStart(2, '0')}`;
    if (faultChargerId === chargerId) continue;
    events.push(demoReading(run, sequence, i, false, now));
  }
  if (events.length > 0) await deps.ingestBatch({ events });
  return events.length;
}

/** Starts the interval; returns a stop function. Failed ticks (e.g. database not ready yet) are skipped. */
export function startSyntheticTicker(app: INestApplication, intervalMs = SYNTHETIC_TICK_MS): () => void {
  const database = app.get(DatabaseService);
  const telemetry = app.get(TelemetryService);
  const deps: SyntheticTickDeps = {
    async findActiveIncidentChargerId() {
      const active = await database.collection<{ chargerId?: string }>('incidents').findOne(
        { stationId: 'demo-station-01', status: { $in: ['OPEN', 'ACKNOWLEDGED', 'RESOLVING'] } },
        { projection: { chargerId: 1 } },
      );
      return active?.chargerId;
    },
    ingestBatch: (batch) => telemetry.ingestBatch(batch),
  };
  let sequence = 1;
  let running = false;
  const timer = setInterval(() => {
    if (running) return; // never overlap ticks on a slow database
    running = true;
    syntheticTick(deps, sequence)
      .then((count) => { if (count > 0) sequence++; })
      .catch(() => { /* database unavailable or conflict: skip this tick */ })
      .finally(() => { running = false; });
  }, intervalMs);
  timer.unref?.();
  return () => clearInterval(timer);
}
