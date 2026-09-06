import { databaseConfigured, databaseProvider, dbQuery, ensurePlatformSchema } from '../platform/database.js';

const memory = new Map();

function memoryConsume(key, cost, limit, windowMs, now) {
  const current = memory.get(key);
  const bucket = !current || current.expiresAt <= now ? { used:0, expiresAt:now + windowMs } : current;
  if (bucket.used + cost > limit) return { allowed:false, remaining:Math.max(0, limit - bucket.used), retryAfter:Math.max(1, Math.ceil((bucket.expiresAt - now) / 1000)), backend:'memory' };
  bucket.used += cost;
  memory.set(key, bucket);
  if (memory.size > 5000) for (const [id, value] of memory) if (value.expiresAt <= now) memory.delete(id);
  return { allowed:true, remaining:Math.max(0, limit - bucket.used), retryAfter:0, backend:'memory' };
}

async function databaseConsume(key, cost, limit, windowMs, now) {
  await ensurePlatformSchema();
  const expiresAt = now + windowMs;
  const provider = databaseProvider();
  if (provider === 'mysql') {
    await dbQuery('INSERT IGNORE INTO cybergcode_rate_limits (bucket_key, window_start, used, expires_at) VALUES (?, ?, 0, ?)', [key, now, expiresAt]);
    await dbQuery('UPDATE cybergcode_rate_limits SET window_start = ?, used = 0, expires_at = ? WHERE bucket_key = ? AND expires_at <= ?', [now, expiresAt, key, now]);
    const update = await dbQuery('UPDATE cybergcode_rate_limits SET used = used + ? WHERE bucket_key = ? AND used + ? <= ?', [cost, key, cost, limit]);
    const rows = await dbQuery('SELECT used, expires_at FROM cybergcode_rate_limits WHERE bucket_key = ?', [key]);
    const row = rows?.[0] || { used:limit, expires_at:expiresAt };
    const allowed = Number(update?.affectedRows || 0) === 1;
    return { allowed, remaining:Math.max(0, limit - Number(row.used || 0)), retryAfter:allowed ? 0 : Math.max(1, Math.ceil((Number(row.expires_at || expiresAt) - now) / 1000)), backend:'database' };
  }
  await dbQuery('INSERT INTO cybergcode_rate_limits (bucket_key, window_start, used, expires_at) VALUES (?, ?, 0, ?) ON CONFLICT (bucket_key) DO NOTHING', [key, now, expiresAt]);
  await dbQuery('UPDATE cybergcode_rate_limits SET window_start = ?, used = 0, expires_at = ? WHERE bucket_key = ? AND expires_at <= ?', [now, expiresAt, key, now]);
  const rows = await dbQuery('UPDATE cybergcode_rate_limits SET used = used + ? WHERE bucket_key = ? AND used + ? <= ? RETURNING used, expires_at', [cost, key, cost, limit]);
  if (rows?.[0]) return { allowed:true, remaining:Math.max(0, limit - Number(rows[0].used || 0)), retryAfter:0, backend:'database' };
  const current = await dbQuery('SELECT used, expires_at FROM cybergcode_rate_limits WHERE bucket_key = ?', [key]);
  const row = current?.[0] || { used:limit, expires_at:expiresAt };
  return { allowed:false, remaining:Math.max(0, limit - Number(row.used || 0)), retryAfter:Math.max(1, Math.ceil((Number(row.expires_at || expiresAt) - now) / 1000)), backend:'database' };
}

export async function consumeRateLimit(key, cost, limit, { windowMs = 10 * 60 * 1000 } = {}) {
  const now = Date.now();
  if (databaseConfigured()) {
    try { return await databaseConsume(key, cost, limit, windowMs, now); }
    catch (error) { console.error('[rate-limit/database]', error?.message || error); }
  }
  return memoryConsume(key, cost, limit, windowMs, now);
}
