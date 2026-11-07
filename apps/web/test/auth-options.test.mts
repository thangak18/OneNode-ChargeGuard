import test from 'node:test';
import assert from 'node:assert/strict';
import {
  LOCAL_DEMO_OPERATOR_ID,
  authorizeDemoOperator,
  isSessionOperator,
  localDemoLoginEnabled,
  operatorAuthConfigured,
  sessionSecret,
  signInAllowed,
} from '../src/lib/auth-policy.mts';
import { isOperatorId } from '../src/lib/operator-policy.mts';

const OWNER_ID = '138879141';
const prod = {
  NODE_ENV: 'production',
  NEXTAUTH_SECRET: 'x'.repeat(40),
  NEXTAUTH_URL: 'https://example.vercel.app',
  GITHUB_CLIENT_ID: 'id',
  GITHUB_CLIENT_SECRET: 'secret',
  OPERATOR_GITHUB_IDS: OWNER_ID,
};
const dev = { NODE_ENV: 'development', OPERATOR_GITHUB_IDS: OWNER_ID };

test('production never accepts demo credentials, even if a sign-in reached the callback', () => {
  assert.equal(localDemoLoginEnabled(prod), false);
  assert.equal(authorizeDemoOperator({ email: 'admin', password: 'admin' }, prod), null);
  assert.equal(signInAllowed({ provider: 'credentials' }, { id: LOCAL_DEMO_OPERATOR_ID }, prod), false);
  assert.equal(isSessionOperator(LOCAL_DEMO_OPERATOR_ID, prod), false);
});

test('production has no fallback session secret and stays unconfigured without GitHub', () => {
  assert.equal(sessionSecret({ NODE_ENV: 'production' }), undefined);
  assert.equal(operatorAuthConfigured({ NODE_ENV: 'production' }), false);
  assert.equal(operatorAuthConfigured(prod), true);
  assert.equal(sessionSecret(prod), prod.NEXTAUTH_SECRET);
});

test('demo login works only in development and never impersonates a GitHub operator', () => {
  const user = authorizeDemoOperator({ email: ' Admin ', password: 'admin' }, dev);
  assert.ok(user);
  assert.equal(user.id, LOCAL_DEMO_OPERATOR_ID);
  assert.notEqual(user.id, OWNER_ID);
  // The demo identity is not numeric, so server-side operator/judge checks reject it.
  assert.equal(isOperatorId(user.id, OWNER_ID), false);
  assert.equal(authorizeDemoOperator({ email: 'admin', password: 'wrong' }, dev), null);
  assert.equal(authorizeDemoOperator({ email: 'someone', password: 'admin' }, dev), null);
  assert.equal(signInAllowed({ provider: 'credentials' }, user, dev), true);
  assert.equal(isSessionOperator(LOCAL_DEMO_OPERATOR_ID, dev), true);
  assert.ok(sessionSecret(dev));
});

test('GitHub sign-in still requires the operator allowlist', () => {
  assert.equal(signInAllowed({ provider: 'github', providerAccountId: OWNER_ID }, null, prod), true);
  assert.equal(signInAllowed({ provider: 'github', providerAccountId: '42' }, null, prod), false);
  assert.equal(isSessionOperator('42', prod), false);
  assert.equal(isSessionOperator(OWNER_ID, prod), true);
  // GitHub is refused when OAuth is not fully configured.
  assert.equal(signInAllowed({ provider: 'github', providerAccountId: OWNER_ID }, null, { ...prod, NEXTAUTH_URL: 'http://x' }), false);
});
