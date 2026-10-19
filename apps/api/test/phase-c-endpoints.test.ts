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
      findOne: async (_q: any) => null,
      findOneAndUpdate: async () => ({ _id: 'demo-test', status: 'RESOLVING' }),
      updateMany: async () => ({ modifiedCount: 1 }),
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

  const recoverRes = await service.recover(faultRes.incidentId);
  assert.equal(recoverRes.status, 'RESOLVING');
  assert.match(recoverRes.message, /Verify the Datadog monitor state directly/);
  assert.equal(ingestedEvents.length, 5);
  assert.equal(ingestedEvents[0].currentA, 8.25);
  assert.equal(ingestedEvents[0].chargingState, 'CHARGING');
  assert.ok(loggedActions.includes('recovery_requested'));

  const resetRes = await service.reset();
  assert.equal(resetRes.success, true);
  assert.match(resetRes.message, /Verify the Datadog monitor state directly/);
  assert.ok(loggedActions.includes('baseline'));
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
