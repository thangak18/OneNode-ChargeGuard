import assert from 'node:assert/strict';
import { test } from 'node:test';
import { isAllowedApiRoute, isLocalOperatorRequest } from '../src/lib/bff-policy.mts';

test('BFF permits only supported read and mutation routes', () => {
  assert.equal(isAllowedApiRoute('GET', ['chargers']), true);
  assert.equal(isAllowedApiRoute('GET', ['chargers', 'demo-charger-01']), true);
  assert.equal(isAllowedApiRoute('GET', ['incidents', 'demo-123']), true);
  assert.equal(isAllowedApiRoute('POST', ['demo', 'trigger-fault']), true);
  assert.equal(isAllowedApiRoute('POST', ['incidents', 'demo-123', 'acknowledge']), true);
  assert.equal(isAllowedApiRoute('POST', ['telemetry']), false);
  assert.equal(isAllowedApiRoute('DELETE', ['incidents', 'demo-123']), false);
  assert.equal(isAllowedApiRoute('POST', ['demo', 'unknown']), false);
  assert.equal(isAllowedApiRoute('GET', ['admin', 'secrets']), false);
  assert.equal(isAllowedApiRoute('GET', ['health', 'atlas-diagnostics']), false);
});

test('BFF permits mutations only from a same-origin loopback development page', () => {
  const sameOrigin = new Request('http://localhost:3000/api/v1/demo/reset', {
    method: 'POST',
    headers: {
      host: 'localhost:3000',
      origin: 'http://localhost:3000',
      'sec-fetch-site': 'same-origin',
    },
  });
  assert.equal(isLocalOperatorRequest(sameOrigin, 'development'), true);

  const crossSite = new Request('http://localhost:3000/api/v1/demo/reset', {
    method: 'POST',
    headers: {
      host: 'localhost:3000',
      origin: 'https://attacker.example',
      'sec-fetch-site': 'cross-site',
    },
  });
  assert.equal(isLocalOperatorRequest(crossSite, 'development'), false);

  const missingOrigin = new Request('http://localhost:3000/api/v1/demo/reset', {
    method: 'POST',
    headers: { host: 'localhost:3000' },
  });
  assert.equal(isLocalOperatorRequest(missingOrigin, 'development'), false);
  assert.equal(isLocalOperatorRequest(sameOrigin, 'production'), false);
});
