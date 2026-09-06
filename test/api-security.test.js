import test from 'node:test';
import assert from 'node:assert/strict';
import { requireAuditAccess, requireJobRateLimit } from '../lib/security/api-access.js';

function response() {
  return { code:null, body:null, headers:{}, setHeader(key,value){this.headers[key]=value;}, status(code){this.code=code;return this;}, json(body){this.body=body;return this;} };
}

test('exige la clave configurada mediante comparación segura', async () => {
  const previous = process.env.CYBERGCODE_AUDIT_KEY;
  process.env.CYBERGCODE_AUDIT_KEY = 'correct-key';
  try {
    const denied = response();
    assert.equal(await requireAuditAccess({ headers:{ 'x-cybergcode-audit-key':'wrong' } }, denied), false);
    assert.equal(denied.code, 401);
    const allowed = response();
    assert.equal(await requireAuditAccess({ headers:{ 'x-cybergcode-audit-key':'correct-key' } }, allowed), true);
  } finally {
    if (previous === undefined) delete process.env.CYBERGCODE_AUDIT_KEY;
    else process.env.CYBERGCODE_AUDIT_KEY = previous;
  }
});

test('aplica cuota temporal y devuelve Retry-After', async () => {
  const previousLimit = process.env.CYBERGCODE_RATE_LIMIT;
  const previousKey = process.env.CYBERGCODE_AUDIT_KEY;
  process.env.CYBERGCODE_RATE_LIMIT = '1';
  process.env.CYBERGCODE_AUDIT_KEY = '';
  try {
    const request = { headers:{ 'x-forwarded-for':`203.0.113.${Date.now() % 200}` } };
    assert.equal(await requireAuditAccess(request, response(), { scope:`test-${Date.now()}` }), true);
    const limited = response();
    const scope = `limited-${Date.now()}`;
    assert.equal(await requireAuditAccess(request, response(), { scope }), true);
    assert.equal(await requireAuditAccess(request, limited, { scope }), false);
    assert.equal(limited.code, 429);
    assert.ok(Number(limited.headers['Retry-After']) > 0);
    assert.equal(limited.headers['X-RateLimit-Backend'], 'memory');
  } finally {
    if (previousLimit === undefined) delete process.env.CYBERGCODE_RATE_LIMIT; else process.env.CYBERGCODE_RATE_LIMIT = previousLimit;
    if (previousKey === undefined) delete process.env.CYBERGCODE_AUDIT_KEY; else process.env.CYBERGCODE_AUDIT_KEY = previousKey;
  }
});

test('producción falla cerrada si no se configuró autenticación', async () => {
  const previousEnv = process.env.VERCEL_ENV;
  const previousKey = process.env.CYBERGCODE_AUDIT_KEY;
  const previousAnonymous = process.env.CYBERGCODE_ALLOW_ANONYMOUS_AUDITS;
  process.env.VERCEL_ENV = 'production';
  delete process.env.CYBERGCODE_AUDIT_KEY;
  process.env.CYBERGCODE_ALLOW_ANONYMOUS_AUDITS = '0';
  try {
    const denied = response();
    assert.equal(await requireAuditAccess({ headers:{} }, denied), false);
    assert.equal(denied.code, 503);
    assert.equal(denied.body.code, 'AUDIT_AUTH_NOT_CONFIGURED');
  } finally {
    if (previousEnv === undefined) delete process.env.VERCEL_ENV; else process.env.VERCEL_ENV = previousEnv;
    if (previousKey === undefined) delete process.env.CYBERGCODE_AUDIT_KEY; else process.env.CYBERGCODE_AUDIT_KEY = previousKey;
    if (previousAnonymous === undefined) delete process.env.CYBERGCODE_ALLOW_ANONYMOUS_AUDITS; else process.env.CYBERGCODE_ALLOW_ANONYMOUS_AUDITS = previousAnonymous;
  }
});

test('los endpoints de jobs aplican una cuota separada por token y trabajo', async () => {
  const previousLimit = process.env.CYBERGCODE_JOB_RATE_LIMIT;
  process.env.CYBERGCODE_JOB_RATE_LIMIT = '1';
  try {
    const request = { headers:{ 'x-cybergcode-job-token':`token-${Date.now()}` } };
    const jobId = `job-${Date.now()}`;
    assert.equal(await requireJobRateLimit(request, response(), jobId, { scope:'test-job' }), true);
    const limited = response();
    assert.equal(await requireJobRateLimit(request, limited, jobId, { scope:'test-job' }), false);
    assert.equal(limited.code, 429);
    assert.equal(limited.headers['X-RateLimit-Backend'], 'memory');
  } finally {
    if (previousLimit === undefined) delete process.env.CYBERGCODE_JOB_RATE_LIMIT;
    else process.env.CYBERGCODE_JOB_RATE_LIMIT = previousLimit;
  }
});
