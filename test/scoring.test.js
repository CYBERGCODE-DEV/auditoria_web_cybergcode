import test from 'node:test';
import assert from 'node:assert/strict';
import { scoreAudit } from '../lib/audit/scoring.js';

test('limita deducciones repetidas de una misma regla', () => {
  const findings = Array.from({ length: 50 }, (_, i) => ({
    id: `x${i}`,
    ruleId: 'IMG-ALT-001',
    category: 'images',
    severity: 'medium',
    penalty: 2
  }));
  const result = scoreAudit(findings, {});
  assert.equal(result.categories.images, 85);
});

test('usa PageSpeed medido para performance sin inventar módulos pendientes', () => {
  const result = scoreAudit([], { performance: 73, accessibility: 91, accessibilityMeasured: true });
  assert.equal(result.categories.performance, 73);
  assert.equal(result.categories.accessibility, 91);
  assert.equal(result.categories.content, null);
  assert.equal(result.categories.ux, null);
  assert.equal(result.categories.compliance, null);
});

test('una métrica externa no oculta deducciones objetivas más restrictivas', () => {
  const findings = [{
    id: 'a1', ruleId: 'A11Y-AXE-TEST', category: 'accessibility', severity: 'high', penalty: 8
  }];
  const result = scoreAudit(findings, { accessibility: 99, accessibilityMeasured: true });
  assert.equal(result.categories.accessibility, 92);
});
