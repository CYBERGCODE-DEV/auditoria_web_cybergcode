import test from 'node:test';
import assert from 'node:assert/strict';
import { runIsoReadiness } from '../lib/compliance/iso.js';

test('ISO readiness separa evidencia observable de revisión manual', async () => {
  const iso = await runIsoReadiness({
    target: 'https://example.com/',
    pages: [{ complianceSignals: { privacyLinks: 1, cookieLinks: 1, termsLinks: 1, forms: 1, piiFields: 2, consentControls: 1 } }],
    browser: { data: {
      axe: { moduleStatus: 'measured', violations: 0, violationNodes: 0 },
      contrast: { checked: 20, failed: 0 },
      responsive: { horizontalOverflow: false },
      privacy: { privacyLinks: 1, cookieLinks: 1, termsLinks: 1, forms: 1, piiFields: 2, consentControls: 1, cookieConsentUi: true }
    } },
    performance: { status: 'measured', mobile: { categories: { performance: 90 } } },
    findings: [],
    securityTxt: { found: true, url: 'https://example.com/.well-known/security.txt', status: 200, sample: 'Contact: mailto:security@example.com' }
  });
  assert.equal(iso.status, 'partial-assessment');
  assert.ok(iso.overall.observableScore > 0);
  assert.ok(iso.overall.manual > 0);
  assert.equal(iso.findings.length, 0);
  assert.ok(iso.standards.some((s) => s.reference === 'ISO/IEC 40500:2025'));
  assert.ok(iso.evidenceCenter.items.length > 0);
  assert.equal(iso.evidenceCenter.status, 'ready-for-evidence');
});

test('ISO readiness genera remediación de privacidad cuando hay PII sin aviso', async () => {
  const iso = await runIsoReadiness({
    target: 'https://example.com/',
    pages: [{ complianceSignals: { privacyLinks: 0, cookieLinks: 0, termsLinks: 0, forms: 1, piiFields: 3, consentControls: 0 } }],
    browser: { status: 'unavailable' },
    performance: { status: 'unavailable' },
    findings: [],
    securityTxt: { found: false, url: 'https://example.com/.well-known/security.txt', status: 404, sample: '' }
  });
  const privacy = iso.findings.find((f) => f.ruleId === 'ISO-29184-PRIVACY-001');
  assert.ok(privacy);
  assert.ok(privacy.solution);
  assert.ok(privacy.acceptanceCriteria);
  assert.ok(Array.isArray(privacy.remediationSteps));
});
