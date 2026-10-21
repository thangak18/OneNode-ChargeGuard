import test from 'node:test';
import assert from 'node:assert/strict';
import { isOperatorId } from '../src/lib/operator-policy.mts';
test('operator access requires an exact numeric provider ID in an explicit allowlist',()=>{
  assert.equal(isOperatorId('123',undefined),false);
  assert.equal(isOperatorId('123',''),false);
  assert.equal(isOperatorId('123','1234'),false);
  assert.equal(isOperatorId('123','12, 123'),true);
  assert.equal(isOperatorId('owner','owner'),false);
  assert.equal(isOperatorId(undefined,'123'),false);
});
