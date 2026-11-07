import test from 'node:test';
import assert from 'node:assert/strict';
import { syntheticTick, syntheticTickerEnabled } from '../src/demo/synthetic-ticker';

test('synthetic ticker runs on Render by default, never on Vercel, and can be switched off', () => {
  assert.equal(syntheticTickerEnabled({ RENDER: 'true' }), true);
  assert.equal(syntheticTickerEnabled({ RENDER: 'true', CHARGEGUARD_SYNTHETIC_TICKER: 'false' }), false);
  assert.equal(syntheticTickerEnabled({ VERCEL: '1', CHARGEGUARD_SYNTHETIC_TICKER: 'true' }), false);
  assert.equal(syntheticTickerEnabled({}), false, 'plain local `npm run dev` stays off');
  assert.equal(syntheticTickerEnabled({ CHARGEGUARD_SYNTHETIC_TICKER: 'true' }), true);
});

test('a tick writes one labelled SYNTHETIC baseline reading per demo charger', async () => {
  const batches: { events: Array<Record<string, any>> }[] = [];
  const count = await syntheticTick(
    { findActiveIncidentChargerId: async () => undefined, ingestBatch: async (b) => { batches.push(b as any); } },
    7,
    new Date('2026-11-07T00:00:00Z'),
  );
  assert.equal(count, 5);
  const events = batches[0].events;
  assert.deepEqual(events.map((e) => e.meta.chargerId), ['demo-charger-01', 'demo-charger-02', 'demo-charger-03', 'demo-charger-04', 'demo-charger-05']);
  for (const e of events) {
    assert.equal(e.currentA, 8.25);
    assert.equal(e.provenance.sourceType, 'SYNTHETIC');
    assert.equal(e.ts, '2026-11-07T00:00:00.000Z');
  }
  assert.equal(new Set(events.map((e) => e.eventId)).size, 5, 'event ids are unique');
});

test('a tick skips the charger of an active incident so its fault stays visible', async () => {
  const batches: { events: Array<Record<string, any>> }[] = [];
  const count = await syntheticTick(
    { findActiveIncidentChargerId: async () => 'demo-charger-03', ingestBatch: async (b) => { batches.push(b as any); } },
    1,
  );
  assert.equal(count, 4);
  assert.ok(!batches[0].events.some((e) => e.meta.chargerId === 'demo-charger-03'));
});
