import crypto from 'node:crypto';
import { consumeRateLimit } from './distributed-rate-limit.js';

function safeEqual(actual, expected) {
  const left = Buffer.from(String(actual || ''), 'utf8');
  const right = Buffer.from(String(expected || ''), 'utf8');
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

function clientId(req) {
  const forwarded = String(req.headers?.['x-forwarded-for'] || '').split(',')[0].trim();
  return forwarded || req.socket?.remoteAddress || 'unknown';
}

export async function requireScopedRateLimit(res, { scope, identity, cost = 1, limit = 120 } = {}) {
  const normalizedLimit = Number.isFinite(Number(limit)) && Number(limit) > 0 ? Math.floor(Number(limit)) : 120;
  const rate = await consumeRateLimit(`${scope}:${identity}`, Math.max(1, Number(cost) || 1), normalizedLimit);
  res.setHeader('X-RateLimit-Limit', String(normalizedLimit));
  res.setHeader('X-RateLimit-Remaining', String(rate.remaining));
  res.setHeader('X-RateLimit-Backend', rate.backend);
  if (!rate.allowed) {
    res.setHeader('Retry-After', String(rate.retryAfter));
    res.status(429).json({ error:'Se alcanzó la cuota temporal de esta operación.', code:'RATE_LIMITED', retryAfterSeconds:rate.retryAfter });
    return false;
  }
  return true;
}

export async function requireJobRateLimit(req, res, jobId, { scope = 'job', cost = 1 } = {}) {
  const token = String(req.headers?.['x-cybergcode-job-token'] || '');
  const identity = crypto.createHash('sha256').update(`${jobId}:${token}`).digest('hex').slice(0, 32);
  return requireScopedRateLimit(res, { scope, identity, cost, limit:process.env.CYBERGCODE_JOB_RATE_LIMIT || 180 });
}

export async function requireAuditAccess(req, res, { scope = 'audit', cost = 1 } = {}) {
  const configuredKey = String(process.env.CYBERGCODE_AUDIT_KEY || '').trim();
  const suppliedKey = String(req.headers?.['x-cybergcode-audit-key'] || '').trim();
  const production = process.env.VERCEL_ENV === 'production';
  const anonymousAllowed = process.env.CYBERGCODE_ALLOW_ANONYMOUS_AUDITS === '1';
  if (production && !configuredKey && !anonymousAllowed) {
    res.status(503).json({ error:'CYBERGCODE_AUDIT_KEY debe configurarse antes de habilitar auditorías en producción.', code:'AUDIT_AUTH_NOT_CONFIGURED' });
    return false;
  }
  if (production && configuredKey && configuredKey.length < 32) {
    res.status(503).json({ error:'CYBERGCODE_AUDIT_KEY debe tener al menos 32 caracteres.', code:'AUDIT_AUTH_WEAK_KEY' });
    return false;
  }
  if (configuredKey && !safeEqual(suppliedKey, configuredKey)) {
    res.status(401).json({ error:'Se requiere una clave de auditoría válida.', code:'AUDIT_AUTH_REQUIRED' });
    return false;
  }
  const configuredLimit = Number(process.env.CYBERGCODE_RATE_LIMIT || 30);
  const limit = Number.isFinite(configuredLimit) && configuredLimit > 0 ? Math.floor(configuredLimit) : 30;
  const identity = configuredKey ? crypto.createHash('sha256').update(suppliedKey).digest('hex').slice(0, 16) : clientId(req);
  return requireScopedRateLimit(res, { scope, identity, cost, limit });
}

export function auditPersistenceAllowed() {
  return Boolean(String(process.env.CYBERGCODE_AUDIT_KEY || '').trim()) || process.env.CYBERGCODE_ALLOW_ANONYMOUS_PERSISTENCE === '1';
}
