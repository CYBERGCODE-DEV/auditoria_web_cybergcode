import test from 'node:test';
import assert from 'node:assert/strict';
import { createFinding } from '../lib/audit/finding.js';
import { RULES } from '../lib/config/rules.js';

test('enriquece hallazgos con solución y criterio de cierre', () => {
  const finding = createFinding({
    rule: RULES.seo.missingH1,
    category: 'seo',
    title: 'Página sin H1',
    url: 'https://example.com',
    evidence: '0 H1',
    impact: 'Estructura principal poco clara.',
    source: 'HTML'
  });
  assert.match(finding.recommendation, /H1/i);
  assert.match(finding.solution, /h1/i);
  assert.ok(finding.remediationSteps.length >= 3);
  assert.match(finding.acceptanceCriteria, /regla|auditoría|URL/i);
  assert.ok(finding.effort);
});

test('permite remediación específica para reglas dinámicas como axe-core', () => {
  const finding = createFinding({
    rule: { id: 'A11Y-AXE-BUTTON-NAME', severity: 'high', penalty: 8 },
    category: 'accessibility',
    title: 'Botón sin nombre accesible',
    url: 'https://example.com',
    evidence: 'button.icon',
    impact: 'No tiene nombre accesible.',
    recommendation: 'Añadir nombre accesible.',
    solution: 'Añadir texto visible o aria-label apropiado.',
    remediationSteps: ['Localizar botón', 'Añadir nombre', 'Reprobar'],
    acceptanceCriteria: 'axe-core devuelve 0 violaciones button-name.',
    source: 'axe-core'
  });
  assert.equal(finding.solution, 'Añadir texto visible o aria-label apropiado.');
  assert.equal(finding.remediationSteps.length, 3);
});
