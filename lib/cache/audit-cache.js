import crypto from 'node:crypto';
import zlib from 'node:zlib';
import { normalizeUrl } from '../security/url-guard.js';

const memory = new Map();
const MAX_RUNTIME_ITEM_BYTES = 1_850_000;
export const STABLE_CACHE_TTL_SECONDS = 30 * 60;
export const AUDIT_PROFILE_VERSION = 'CG-STABLE-1';

function canonicalTarget(input) {
  const url = normalizeUrl(input);
  url.hash = '';
  url.searchParams.sort();
  if ((url.protocol === 'https:' && url.port === '443') || (url.protocol === 'http:' && url.port === '80')) url.port = '';
  return url.href;
}

export function makeAuditCacheKey({ url, maxPages = 12, pageSpeed = true, stableMode = true, engineVersion = '0.0.0' }) {
  const payload = JSON.stringify({
    target: canonicalTarget(url),
    maxPages: Number(maxPages),
    pageSpeed: Boolean(pageSpeed),
    stableMode: Boolean(stableMode),
    engineVersion,
    profile: AUDIT_PROFILE_VERSION
  });
  return `audit:${crypto.createHash('sha256').update(payload).digest('hex')}`;
}

function encode(value) {
  const json = JSON.stringify(value);
  const compressed = zlib.gzipSync(Buffer.from(json, 'utf8'), { level: 6 });
  return { format: 'gzip-base64', data: compressed.toString('base64') };
}

function decode(value) {
  if (!value) return null;
  if (value.format !== 'gzip-base64' || typeof value.data !== 'string') return value;
  const json = zlib.gunzipSync(Buffer.from(value.data, 'base64')).toString('utf8');
  return JSON.parse(json);
}

async function vercelRuntimeCache() {
  if (!process.env.VERCEL) return null;
  try {
    const { getCache } = await import('@vercel/functions');
    const project = process.env.VERCEL_PROJECT_ID || process.env.VERCEL_PROJECT_PRODUCTION_URL || 'default';
    return getCache({ namespace: `cybergcode-web-audit:${project}` });
  } catch (error) {
    console.warn('[audit-cache] Runtime Cache no disponible:', error?.message || error);
    return null;
  }
}

export async function getCachedAudit(key) {
  const runtime = await vercelRuntimeCache();
  if (runtime) {
    try {
      return decode(await runtime.get(key));
    } catch (error) {
      console.warn('[audit-cache] lectura Runtime Cache:', error?.message || error);
    }
  }

  const item = memory.get(key);
  if (!item) return null;
  if (item.expiresAt <= Date.now()) {
    memory.delete(key);
    return null;
  }
  return decode(item.value);
}

export async function setCachedAudit(key, result, ttlSeconds = STABLE_CACHE_TTL_SECONDS) {
  let encoded;
  try { encoded = encode(result); } catch { return false; }
  const bytes = Buffer.byteLength(JSON.stringify(encoded), 'utf8');
  if (bytes > MAX_RUNTIME_ITEM_BYTES) {
    console.warn(`[audit-cache] resultado comprimido demasiado grande (${bytes} bytes), se omite cache.`);
    return false;
  }

  const runtime = await vercelRuntimeCache();
  if (runtime) {
    try {
      await runtime.set(key, encoded, { ttl: ttlSeconds, tags: ['cybergcode-audits'], name: 'CYBERGCODE stable web audit' });
      return true;
    } catch (error) {
      console.warn('[audit-cache] escritura Runtime Cache:', error?.message || error);
    }
  }

  memory.set(key, { value: encoded, expiresAt: Date.now() + ttlSeconds * 1000 });
  return true;
}
