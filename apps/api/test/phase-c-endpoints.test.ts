import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ChargersService } from '../src/chargers/chargers.service';
import { IncidentsService } from '../src/incidents/incidents.service';
import { DemoService } from '../src/demo/demo.service';

test('ChargersService returns virtual chargers and station metadata', async () => {
  const fakeDb: any = {
    collection: (name: string) => ({
      find: () => ({
        toArray: async () =>
          name === 'chargers'
            ? [{ _id: 'demo-charger-01', stationId: 'demo-station-01', connectorId: '1', status: 'AVAILABLE' }]
            : [{ _id: 'demo-station-01', name: 'Demo Station' }],
      }),
      findOne: async (q: any) =>
        q._id === 'demo-charger-01'
          ? { _id: 'demo-charger-01', stationId: 'demo-station-01', connectorId: '1', status: 'AVAILABLE' }
          : null,
    }),
  };

  const service = new ChargersService(fakeDb);
  const chargers = await service.findAll();
  assert.equal(chargers.length, 1);
  assert.equal(chargers[0]._id, 'demo-charger-01');

  const one = await service.findOne('demo-charger-01');
  assert.equal(one._id, 'demo-charger-01');

  await assert.rejects(() => service.findOne('non-existent'));
  const stations = await service.findStations();
  assert.equal(stations.length, 1);
});

test('IncidentsService handles lifecycle: findAll, findOne, acknowledge, resolve', async () => {
  const incidents = new Map<string, any>([
    [
      'inc-1',
      { _id: 'inc-1', chargerId: 'demo-charger-01', status: 'OPEN', detectedAt: new Date(), scenario: 'OVERHEAT' },
    ],
  ]);
  const actions: any[] = [];

  const fakeDb: any = {
    collection: (name: string) => ({
      find: (q?: any) => ({
        toArray: async () =>
          name === 'incidents'
            ? Array.from(incidents.values())
            : actions.filter((a) => a.incidentId === q.incidentId),
      }),
      findOne: async (q: any) => incidents.get(q._id) ?? null,
      findOneAndUpdate: async (q: any, update: any) => {
        const item = incidents.get(q._id);
        if (!item) return null;
        Object.assign(item, update.$set);
        return item;
      },
      insertOne: async (doc: any) => {
        actions.push(doc);
        return { acknowledged: true };
      },
    }),
  };

  const fakeObs: any = { record: () => {} };
  const service = new IncidentsService(fakeDb, fakeObs);

  const all = await service.findAll();
  assert.equal(all.length, 1);

  const detail = await service.findOne('inc-1');
  assert.equal(detail._id, 'inc-1');
  assert.equal(detail.actions.length, 0);

  const ack = await service.acknowledge('inc-1', 'operator-test');
  assert.equal(ack.status, 'ACKNOWLEDGED');
  assert.equal(actions.length, 1);
  assert.equal(actions[0].action, 'acknowledged');

  await assert.rejects(() => service.resolve('inc-1', 'operator-test'), /recovery telemetry/);
  Object.assign(incidents.get('inc-1'), { status: 'RESOLVING', recoveryTelemetryAt: new Date() });
  const res = await service.resolve('inc-1', 'operator-test');
  assert.equal(res.status, 'RESOLVED');
  assert.equal(actions.length, 2);
  assert.equal(actions[1].action, 'resolved');
});

test('DemoService triggers fault and recovery telemetry batches', async () => {
  let insertedIncident: any = null;
  let ingestedEvents: any[] = [];
  const loggedActions: string[] = [];

  const fakeDb: any = {
    collection: (name: string) => ({
      insertOne: async (doc: any) => {
        if (name === 'incidents') insertedIncident = doc;
      },
      findOne: async (_q: any) => name === 'incidents' ? insertedIncident : null,
      find: () => ({ toArray: async () => [] }),
      findOneAndUpdate: async (_q: any, update: any) => { Object.assign(insertedIncident, update.$set); return insertedIncident; },
      updateMany: async () => ({ modifiedCount: 1 }),
      insertMany: async () => ({ insertedCount: 0 }),
    }),
  };

  const fakeTelemetry: any = {
    ingestBatch: async (body: any) => {
      ingestedEvents = body.events;
      return { accepted: body.events.length, failed: 0 };
    },
  };

  const fakeObs: any = {
    record: (_lvl: string, _event: string, fields: any) => {
      if (fields?.action) loggedActions.push(fields.action);
    },
    flush: async () => {},
  };

  const service = new DemoService(fakeDb, fakeTelemetry, fakeObs);

  const faultRes = await service.triggerFault(1, 'SIM_OVERHEAT');
  assert.equal(faultRes.status, 'OPEN');
  assert.match(faultRes.message, /Verify the Datadog monitor state directly/);
  assert.ok(insertedIncident);
  assert.equal(insertedIncident.severity, 'CRITICAL');
  assert.equal(ingestedEvents.length, 5);
  assert.equal(ingestedEvents[0].currentA, 0);
  assert.equal(ingestedEvents[0].chargingState, 'FAULT');
  assert.equal(ingestedEvents[1].currentA, 8.25);
  assert.equal(ingestedEvents[1].chargingState, 'CHARGING');
  assert.ok(loggedActions.includes('fault_injected'));

  insertedIncident.status = 'ACKNOWLEDGED';
  const recoverRes = await service.recover(faultRes.incidentId);
  assert.equal(recoverRes.status, 'RESOLVING');
  assert.match(recoverRes.message, /Verify the Datadog monitor state directly/);
  assert.equal(ingestedEvents.length, 1);
  assert.equal(ingestedEvents[0].currentA, 8.25);
  assert.equal(ingestedEvents[0].chargingState, 'CHARGING');
  assert.ok(loggedActions.includes('recovery_requested'));

  const resetRes = await service.reset();
  assert.equal(resetRes.success, true);
  assert.match(resetRes.message, /Verify the Datadog monitor state directly/);
  assert.ok(loggedActions.includes('baseline'));
});

test('DemoService rejects invalid trigger input before writing', async () => {
  let writes = 0;
  const fakeDb: any = {
    collection: () => ({
      findOne: async () => null,
      insertOne: async () => { writes += 1; },
    }),
  };
  const fakeTelemetry: any = {};
  const fakeObs: any = {};
  const service = new DemoService(fakeDb, fakeTelemetry, fakeObs);

  await assert.rejects(() => service.triggerFault(6, 'SIM_OVERHEAT'));
  await assert.rejects(() => service.triggerFault(1, 'UNSUPPORTED'));
  assert.equal(writes, 0);
});

test('DemoService reset is scoped to the five synthetic demo chargers and preserves audit history', async () => {
  const active = [{ _id: 'demo-active' }];
  let readFilter: any;
  let updateFilter: any;
  let auditActions: any[] = [];
  let events: any[] = [];
  const fakeDb: any = {
    collection: (name: string) => ({
      find: (filter: any) => {
        if (name === 'incidents') readFilter = filter;
        return { toArray: async () => active };
      },
      updateMany: async (filter: any) => {
        updateFilter = filter;
        return { modifiedCount: 1 };
      },
      insertMany: async (docs: any[]) => {
        auditActions = docs;
        return { insertedCount: docs.length };
      },
    }),
  };
  const fakeTelemetry: any = {
    ingestBatch: async ({ events: inserted }: { events: any[] }) => {
      events = inserted;
      return { accepted: inserted.length, failed: 0 };
    },
  };
  const fakeObs: any = { record: () => {}, flush: async () => {} };
  const service = new DemoService(fakeDb, fakeTelemetry, fakeObs);

  const result = await service.reset();

  assert.equal(result.success, true);
  assert.deepEqual(readFilter, updateFilter);
  assert.deepEqual(readFilter, {
    stationId: 'demo-station-01',
    chargerId: { $in: ['demo-charger-01', 'demo-charger-02', 'demo-charger-03', 'demo-charger-04', 'demo-charger-05'] },
    status: { $in: ['OPEN', 'ACKNOWLEDGED', 'RESOLVING'] },
    synthetic: true,
  });
  assert.deepEqual(auditActions.map(({ incidentId, actor, action }) => ({ incidentId, actor, action })), [{
    incidentId: 'demo-active',
    actor: 'demo-operator-ui',
    action: 'baseline_reset',
  }]);
  assert.equal(events.length, 5);
  assert.ok(events.every((event) => event.currentA === 8.25 && event.chargingState === 'CHARGING'));
});

test('DemoService.triggerFault is idempotent while a synthetic incident is active', async () => {
  let existing = false;
  const fakeDb: any = {
    collection: (name: string) => ({
      insertOne: async () => {},
      findOne: async () => (existing
        ? { _id: 'demo-existing', chargerId: 'demo-charger-01', scenario: 'SIM_OVERHEAT', status: 'OPEN', detectedAt: new Date() }
        : null),
      findOneAndUpdate: async () => ({ _id: 'demo-test', status: 'RESOLVING' }),
      updateMany: async () => ({ modifiedCount: 1 }),
    }),
  };
  const fakeTelemetry: any = { ingestBatch: async () => ({ accepted: 5, failed: 0 }) };
  const fakeObs: any = { record: () => {}, flush: async () => {} };
  const service = new DemoService(fakeDb, fakeTelemetry, fakeObs);

  const first = await service.triggerFault(1, 'SIM_OVERHEAT');
  assert.equal(first.status, 'OPEN');
  assert.equal(first.duplicate, undefined);

  existing = true;
  const second = await service.triggerFault(2, 'SIM_POWER_LOSS');
  assert.equal(second.incidentId, 'demo-existing');
  assert.equal(second.duplicate, true);
  assert.equal(second.chargerId, 'demo-charger-01');
});
