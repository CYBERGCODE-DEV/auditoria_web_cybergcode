import test from 'node:test';
import assert from 'node:assert/strict';
import { runPeruCompliance } from '../lib/compliance/peru.js';

test('Perú detecta alerta de Libro de Reclamaciones en ecommerce sin enlace visible', () => {
  const result = runPeruCompliance({
    target: 'https://example.com/',
    pages: [{ complianceSignals: { privacyLinks: 1, claimsBookLinks: 0, forms: 1, piiFields: 1, consentControls: 1, ecommerceSignals: true } }],
    browser: { data: { privacy: { ecommerceSignals: true, claimsBookLinks: 0, privacyLinks: 1, piiFields: 1 }, network: { trackers: [] } } }
  });
  assert.equal(result.status, 'partial-assessment');
  assert.ok(result.findings.some((f) => f.ruleId === 'PE-CONSUMER-LR-001'));
  const finding = result.findings.find((f) => f.ruleId === 'PE-CONSUMER-LR-001');
  assert.ok(finding.solution);
  assert.ok(finding.acceptanceCriteria);
});

test('Perú marca señales visibles cuando privacidad y Libro están presentes', () => {
  const result = runPeruCompliance({
    target: 'https://example.com/',
    pages: [{ complianceSignals: { privacyLinks: 1, claimsBookLinks: 1, forms: 1, piiFields: 1, consentControls: 1, ecommerceSignals: true } }],
    browser: { data: { privacy: { privacyLinks:1, claimsBookLinks:1, consentControls:1, ecommerceSignals:true, cookieConsentUi:true }, network: { trackers: [] } } }
  });
  assert.ok(result.summary.observed >= 2);
  assert.equal(result.findings.some((f) => f.ruleId === 'PE-CONSUMER-LR-001'), false);
});
