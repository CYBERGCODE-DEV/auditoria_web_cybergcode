import test from 'node:test';
import assert from 'node:assert/strict';
import { compareAuditSnapshots } from '../lib/platform/snapshot.js';

function snapshot(id, fingerprint, score, findings) {
  return {
    auditId:id, completedAt:'2026-01-01T00:00:00.000Z', profileFingerprint:fingerprint,
    scores:{ global:score, categories:{ seo:score } }, coverage:{ findingsTotal:findings },
    severity:{ critical:0, high:findings, medium:0 }, seo:{}, performance:{ mobile:{}, desktop:{} }
  };
}

test('compara únicamente perfiles compatibles y calcula la dirección', () => {
  const result = compareAuditSnapshots(snapshot('A','SAME',70,5), snapshot('B','SAME',85,2));
  assert.equal(result.scores.global.change, 15);
  assert.equal(result.scores.global.improved, true);
  assert.equal(result.findings.total.change, -3);
  assert.equal(result.findings.total.improved, true);
});

test('rechaza comparaciones con configuraciones diferentes', () => {
  assert.throws(() => compareAuditSnapshots(snapshot('A','ONE',70,5), snapshot('B','TWO',80,2)), (error) => error.code === 'INCOMPATIBLE_AUDIT_PROFILES');
});
