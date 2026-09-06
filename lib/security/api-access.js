import crypto from 'node:crypto';

const buckets = new Map();
const WINDOW_MS = 10 * 60 * 1000;

function safeEqual(actual, expected) {
  const left = Buffer.from(String(actual || ''), 'utf8');
  const right = Buffer.from(String(expected || ''), 'utf8');
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

function clientId(req) {
  const forwarded = String(req.headers?.['x-forwarded-for'] || '').split(',')[0].trim();
  return forwarded || req.socket?.remoteAddress || 'unknown';
}

function consume(key, cost, limit) {
  const now = Date.now();
  const current = buckets.get(key);
  const bucket = !current || current.resetAt <= now ? { used:0, resetAt:now + WINDOW_MS } : current;
  if (bucket.used + cost > limit) return { allowed:false, retryAfter:Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)) };
  bucket.used += cost;
  buckets.set(key, bucket);
  if (buckets.size > 5000) for (const [id, value] of buckets) if (value.resetAt <= now) buckets.delete(id);
  return { allowed:true, remaining:Math.max(0, limit - bucket.used) };
}

export function requireAuditAccess(req, res, { scope = 'audit', cost = 1 } = {}) {
  const configuredKey = String(process.env.CYBERGCODE_AUDIT_KEY || '').trim();
  const suppliedKey = String(req.headers?.['x-cybergcode-audit-key'] || '').trim();
  if (configuredKey && !safeEqual(suppliedKey, configuredKey)) {
    res.status(401).json({ error:'Se requiere una clave de auditoría válida.', code:'AUDIT_AUTH_REQUIRED' });
    return false;
  }
  const configuredLimit = Number(process.env.CYBERGCODE_RATE_LIMIT || 30);
  const limit = Number.isFinite(configuredLimit) && configuredLimit > 0 ? Math.floor(configuredLimit) : 30;
  const identity = configuredKey ? crypto.createHash('sha256').update(suppliedKey).digest('hex').slice(0, 16) : clientId(req);
  const rate = consume(`${scope}:${identity}`, Math.max(1, Number(cost) || 1), limit);
  if (!rate.allowed) {
    res.setHeader('Retry-After', String(rate.retryAfter));
    res.status(429).json({ error:'Se alcanzó la cuota temporal de esta operación.', code:'RATE_LIMITED', retryAfterSeconds:rate.retryAfter });
    return false;
  }
  res.setHeader('X-RateLimit-Limit', String(limit));
  res.setHeader('X-RateLimit-Remaining', String(rate.remaining));
  return true;
}

export function auditPersistenceAllowed() {
  return Boolean(String(process.env.CYBERGCODE_AUDIT_KEY || '').trim()) || process.env.CYBERGCODE_ALLOW_ANONYMOUS_PERSISTENCE === '1';
}
