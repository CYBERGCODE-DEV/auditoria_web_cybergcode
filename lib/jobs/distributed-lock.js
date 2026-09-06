import crypto from 'node:crypto';
import { databaseConfigured, databaseProvider, dbQuery, ensurePlatformSchema } from '../platform/database.js';

const memoryLocks = new Map();

export async function acquireJobLock(key, ttlMs = 180000) {
  const now = Date.now();
  const expiresAt = now + ttlMs;
  const owner = crypto.randomUUID();
  if (databaseConfigured()) {
    try {
      await ensurePlatformSchema();
      if (databaseProvider() === 'mysql') {
        await dbQuery(`INSERT INTO cybergcode_job_locks (lock_key, owner_token, expires_at) VALUES (?, ?, ?)
          ON DUPLICATE KEY UPDATE owner_token = IF(expires_at <= ?, VALUES(owner_token), owner_token), expires_at = IF(expires_at <= ?, VALUES(expires_at), expires_at)`, [key, owner, expiresAt, now, now]);
        const rows = await dbQuery('SELECT owner_token, expires_at FROM cybergcode_job_locks WHERE lock_key = ?', [key]);
        return { acquired:rows?.[0]?.owner_token === owner, owner, key, expiresAt, backend:'database' };
      }
      const rows = await dbQuery(`INSERT INTO cybergcode_job_locks (lock_key, owner_token, expires_at) VALUES (?, ?, ?)
        ON CONFLICT (lock_key) DO UPDATE SET owner_token = EXCLUDED.owner_token, expires_at = EXCLUDED.expires_at
        WHERE cybergcode_job_locks.expires_at <= ? RETURNING owner_token`, [key, owner, expiresAt, now]);
      return { acquired:rows?.[0]?.owner_token === owner, owner, key, expiresAt, backend:'database' };
    } catch (error) {
      console.error('[job-lock/database]', error?.message || error);
    }
  }
  const current = memoryLocks.get(key);
  if (current && current.expiresAt > now) return { acquired:false, owner, key, expiresAt, backend:'memory' };
  memoryLocks.set(key, { owner, expiresAt });
  return { acquired:true, owner, key, expiresAt, backend:'memory' };
}

export async function releaseJobLock(lock) {
  if (!lock?.acquired) return;
  if (lock.backend === 'database' && databaseConfigured()) {
    try {
      await dbQuery('DELETE FROM cybergcode_job_locks WHERE lock_key = ? AND owner_token = ?', [lock.key, lock.owner]);
      return;
    } catch (error) { console.error('[job-lock/release]', error?.message || error); }
  }
  const current = memoryLocks.get(lock.key);
  if (current?.owner === lock.owner) memoryLocks.delete(lock.key);
}
