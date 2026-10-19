import { Inject, Injectable } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import { DatabaseService } from '../database/database.service';
import { ObservabilityService } from '../observability/observability.service';
import { TelemetryService } from '../telemetry/telemetry.service';
import { demoReading } from '../observability/demo-scenario';

@Injectable()
export class DemoService {
  constructor(
    @Inject(DatabaseService) private readonly database: DatabaseService,
    @Inject(TelemetryService) private readonly telemetry: TelemetryService,
    @Inject(ObservabilityService) private readonly obs: ObservabilityService,
  ) {}

  async triggerFault(chargerIndex = 1, scenario = 'SIM_OVERHEAT') {
    const chargerId = `demo-charger-${String(chargerIndex).padStart(2, '0')}`;

    // Idempotency safeguard: if an active synthetic incident already exists,
    // return it instead of creating a duplicate. This prevents accidental
    // repeated triggering (e.g. double-clicks) from cluttering Atlas and
    // keeps the demo's DETECT -> INVESTIGATE -> RESOLVE lifecycle clean.
    const existing = await this.database.collection('incidents').findOne(
      { status: { $in: ['OPEN', 'ACKNOWLEDGED', 'RESOLVING'] }, synthetic: true },
      { sort: { detectedAt: -1 } },
    );
    if (existing) {
      return {
        incidentId: existing._id,
        status: existing.status,
        chargerId: existing.chargerId,
        scenario: existing.scenario,
        detectedAt: new Date(existing.detectedAt).toISOString(),
        synthetic: true,
        message: `An active synthetic incident (${existing._id}) is already in progress. Acknowledge, recover and resolve it before triggering a new fault.`,
        duplicate: true,
      };
    }

    const run = randomBytes(6).toString('hex');
    const incidentId = `demo-${run}`;
    const detectedAt = new Date();

    // 1. Create incident in Atlas
    await this.database.collection('incidents').insertOne({
      _id: incidentId,
      stationId: 'demo-station-01',
      chargerId,
      scenario,
      severity: 'CRITICAL',
      status: 'OPEN',
      detectedAt,
      synthetic: true,
      evidence: [
        {
          type: 'TELEMETRY_ANOMALY',
          detail: 'Synthetic current dropped to 0 A with FAULT state',
          faultCode: 'SIMULATED_DEMO_FAULT',
        },
      ],
      createdAt: detectedAt,
      updatedAt: detectedAt,
    });

    // 2. Insert incident action
    await this.database.collection('incident_actions').insertOne({
      incidentId,
      actor: 'demo-operator-ui',
      action: 'fault_injected',
      at: detectedAt,
      synthetic: true,
    });

    // 3. Emit structured log
    this.obs.record('info', 'demo.action', { demo_id: run, action: 'fault_injected' });

    // 4. Ingest 5 telemetry events (chargerIndex has fault)
    const now = new Date();
    const events = Array.from({ length: 5 }, (_, i) =>
      demoReading(run, 1, i + 1, i + 1 === chargerIndex, now),
    );

    await this.telemetry.ingestBatch({ events });
    await this.obs.flush();

    return {
      incidentId,
      status: 'OPEN',
      chargerId,
      scenario,
      detectedAt: detectedAt.toISOString(),
      synthetic: true,
      message: `Synthetic fault telemetry submitted for ${chargerId}. Verify the Datadog monitor state directly.`,
    };
  }

  async recover(incidentId: string) {
    const at = new Date();
    const run = incidentId.startsWith('demo-') ? incidentId.slice(5) : randomBytes(6).toString('hex');

    // 1. Update incident status
    const updated = await this.database.collection('incidents').findOneAndUpdate(
      { _id: incidentId },
      { $set: { status: 'RESOLVING', recoveryRequestedAt: at } },
      { returnDocument: 'after' },
    );

    // 2. Insert incident action
    await this.database.collection('incident_actions').insertOne({
      incidentId,
      actor: 'demo-operator-ui',
      action: 'recovery_requested',
      at,
      synthetic: true,
    });

    // 3. Record log
    if (/^[a-f0-9]{12}$/.test(run)) {
      this.obs.record('info', 'demo.action', { demo_id: run, action: 'recovery_requested' });
    }

    // 4. Ingest recovery readings (all 5 chargers healthy at 8.25 A)
    const now = new Date();
    const safeRun = /^[a-f0-9]{12}$/.test(run) ? run : randomBytes(6).toString('hex');
    const events = Array.from({ length: 5 }, (_, i) => demoReading(safeRun, 2, i + 1, false, now));

    await this.telemetry.ingestBatch({ events });
    await this.obs.flush();

    return {
      incidentId,
      status: 'RESOLVING',
      recoveredAt: at.toISOString(),
      message: 'Recovery telemetry submitted. Verify the Datadog monitor state directly.',
      incident: updated,
    };
  }

  async reset() {
    const run = randomBytes(6).toString('hex');
    const now = new Date();

    // 1. Close any open demo incidents
    await this.database.collection('incidents').updateMany(
      { status: { $in: ['OPEN', 'ACKNOWLEDGED', 'RESOLVING'] }, synthetic: true },
      { $set: { status: 'RESOLVED', resolvedAt: now } },
    );

    // 2. Emit clean baseline telemetry for all 5 chargers
    const events = Array.from({ length: 5 }, (_, i) => demoReading(run, 0, i + 1, false, now));
    await this.telemetry.ingestBatch({ events });

    this.obs.record('info', 'demo.action', { demo_id: run, action: 'baseline' });
    await this.obs.flush();

    return {
      success: true,
      message: 'Baseline telemetry submitted for all 5 virtual chargers. Verify the Datadog monitor state directly.',
      run,
    };
  }
}
