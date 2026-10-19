import { recordIncidentAction } from '../incidents/incident-audit';
import { BadRequestException, ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import { DatabaseService } from '../database/database.service';
import { ObservabilityService } from '../observability/observability.service';
import { TelemetryService } from '../telemetry/telemetry.service';
import { demoReading } from '../observability/demo-scenario';

const DEMO_CHARGER_IDS = Array.from({ length: 5 }, (_, index) => `demo-charger-${String(index + 1).padStart(2, '0')}`);
const DEMO_SCENARIOS = new Set(['SIM_OVERHEAT', 'SIM_POWER_LOSS', 'SIM_HARDWARE_FAULT']);
const ACTIVE_STATUSES = ['OPEN', 'ACKNOWLEDGED', 'RESOLVING'];

@Injectable()
export class DemoService {
  constructor(
    @Inject(DatabaseService) private readonly database: DatabaseService,
    @Inject(TelemetryService) private readonly telemetry: TelemetryService,
    @Inject(ObservabilityService) private readonly obs: ObservabilityService,
  ) {}

  async triggerFault(chargerIndex = 1, scenario = 'SIM_OVERHEAT') {
    if (!Number.isInteger(chargerIndex) || chargerIndex < 1 || chargerIndex > DEMO_CHARGER_IDS.length) {
      throw new BadRequestException('chargerIndex must be an integer from 1 through 5.');
    }
    if (!DEMO_SCENARIOS.has(scenario)) {
      throw new BadRequestException('Unsupported synthetic fault scenario.');
    }
    const chargerId = `demo-charger-${String(chargerIndex).padStart(2, '0')}`;

    // Idempotency safeguard: if an active synthetic incident already exists,
    // return it instead of creating a duplicate. This prevents accidental
    // repeated triggering (e.g. double-clicks) from cluttering Atlas and
    // keeps the demo's DETECT -> INVESTIGATE -> RESOLVE lifecycle clean.
    const existing = await this.database.collection('incidents').findOne(
      {
        stationId: 'demo-station-01',
        chargerId: { $in: DEMO_CHARGER_IDS },
        status: { $in: ACTIVE_STATUSES },
        synthetic: true,
      },
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
          detail: scenario === 'SIM_OVERHEAT'
            ? 'Synthetic current dropped to 0 A with FAULT state; illustrative synthetic temperature stimulus is 72 °C, not a measured value or hardware threshold.'
            : 'Synthetic current dropped to 0 A with FAULT state.',
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
      demoReading(run, 1, i + 1, i + 1 === chargerIndex, now, scenario),
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

  async recover(incidentId: unknown) {
    if (typeof incidentId !== 'string' || !/^demo-[a-f0-9]{12}$/.test(incidentId)) {
      throw new BadRequestException('A valid synthetic demo incidentId is required.');
    }
    const scope = { _id: incidentId, stationId: 'demo-station-01', chargerId: { $in: DEMO_CHARGER_IDS }, synthetic: true };
    let incident = await this.database.collection('incidents').findOne(scope);
    if (!incident) throw new NotFoundException('Synthetic demo incident not found');
    if (!['ACKNOWLEDGED', 'RESOLVING'].includes(incident.status)) {
      throw new ConflictException('Acknowledge the active incident before sending recovery telemetry.');
    }
    if (incident.status === 'ACKNOWLEDGED') {
      // Reserve one immutable event timestamp so retries reuse the exact payload fingerprint.
      const reserved = await this.database.collection('incidents').findOneAndUpdate(
        { ...scope, status: 'ACKNOWLEDGED' },
        { $set: { status: 'RESOLVING', recoveryEventAt: new Date(), updatedAt: new Date() } },
        { returnDocument: 'after' },
      );
      incident = reserved ?? await this.database.collection('incidents').findOne(scope);
    }
    if (!incident || incident.status !== 'RESOLVING' || !incident.recoveryEventAt) {
      throw new ConflictException('Recovery is unavailable; inspect the incident timeline.');
    }
    const run = incidentId.slice(5);
    const eventTime = new Date(incident.recoveryEventAt);
    const chargerIndex = DEMO_CHARGER_IDS.indexOf(incident.chargerId) + 1;
    // Recover only this incident's charger; preserve the other four chargers' observations.
    const event = demoReading(run, 2, chargerIndex, false, eventTime);
    await this.telemetry.ingestBatch({ events: [event] });
    const at = new Date();
    const updated = await this.database.collection('incidents').findOneAndUpdate(
      { ...scope, status: 'RESOLVING' },
      { $set: { recoveryTelemetryAt: eventTime, recoveryRequestedAt: eventTime, updatedAt: at } },
      { returnDocument: 'after' },
    );
    if (!updated) throw new ConflictException('Incident state changed during recovery.');
    await recordIncidentAction(this.database, incidentId, 'demo-operator-ui', 'recovery_requested', eventTime);
    this.obs.record('info', 'demo.action', { demo_id: run, incident_id: incidentId, charger_id: incident.chargerId, station_id: incident.stationId, action: 'recovery_requested' });
    await this.obs.flush();
    return { incidentId, status: 'RESOLVING', recoveredAt: eventTime.toISOString(), message: 'Recovery telemetry submitted for the affected charger. Verify the Datadog monitor state directly.', incident: updated };
  }

  async reset() {
    const run = randomBytes(6).toString('hex');
    const now = new Date();
    const resetScope = {
      stationId: 'demo-station-01',
      chargerId: { $in: DEMO_CHARGER_IDS },
      status: { $in: ACTIVE_STATUSES },
      synthetic: true,
    };
    const activeIncidents = await this.database
      .collection('incidents')
      .find(resetScope, { projection: { _id: 1 } })
      .toArray();

    if (activeIncidents.length > 0) {
      await this.database.collection('incidents').updateMany(resetScope, {
        $set: { status: 'RESOLVED', resolvedAt: now },
      });
      await this.database.collection('incident_actions').insertMany(
        activeIncidents.map((incident) => ({
          incidentId: incident._id,
          actor: 'demo-operator-ui',
          action: 'baseline_reset',
          at: now,
          synthetic: true,
        })),
      );
    }

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
