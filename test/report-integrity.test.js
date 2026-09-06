import test from 'node:test';
import assert from 'node:assert/strict';
import { attachReportAuthorization, verifyReportAuthorization } from '../lib/report/integrity.js';

function audit() {
  return { meta:{ id:'AUD-TEST' }, findings:[], scores:{ global:90 }, accessibilityManual:{ items:[] }, iso:{} };
}

test('firma un resultado y rechaza modificaciones', () => {
  const previous = process.env.CYBERGCODE_REPORT_SECRET;
  process.env.CYBERGCODE_REPORT_SECRET = 'test-secret-with-more-than-thirty-two-characters';
  try {
    const value = audit();
    attachReportAuthorization(value);
    assert.equal(value.meta.reportAuthorization.status, 'signed');
    assert.equal(verifyReportAuthorization(value).ok, true);
    value.scores.global = 1;
    assert.equal(verifyReportAuthorization(value).code, 'AUDIT_PAYLOAD_CHANGED');
  } finally {
    if (previous === undefined) delete process.env.CYBERGCODE_REPORT_SECRET;
    else process.env.CYBERGCODE_REPORT_SECRET = previous;
  }
});

test('no autoriza PDF si el secreto no está configurado', () => {
  const previous = process.env.CYBERGCODE_REPORT_SECRET;
  delete process.env.CYBERGCODE_REPORT_SECRET;
  try {
    const value = audit();
    attachReportAuthorization(value);
    assert.equal(verifyReportAuthorization(value).code, 'REPORT_SIGNING_NOT_CONFIGURED');
  } finally {
    if (previous !== undefined) process.env.CYBERGCODE_REPORT_SECRET = previous;
  }
});
