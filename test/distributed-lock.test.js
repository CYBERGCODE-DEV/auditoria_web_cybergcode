import test from 'node:test';
import assert from 'node:assert/strict';
import { acquireJobLock, releaseJobLock } from '../lib/jobs/distributed-lock.js';

test('impide dos leases simultáneos y permite adquirir después de liberar', async () => {
  const key = `test-lock-${Date.now()}`;
  const first = await acquireJobLock(key, 10000);
  const second = await acquireJobLock(key, 10000);
  assert.equal(first.acquired, true);
  assert.equal(second.acquired, false);
  await releaseJobLock(first);
  const third = await acquireJobLock(key, 10000);
  assert.equal(third.acquired, true);
  await releaseJobLock(third);
});
