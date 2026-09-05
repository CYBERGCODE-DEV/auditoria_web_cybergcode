import { neon } from '@neondatabase/serverless';

let schemaReady = null;

export function databaseUrl() {
  return String(process.env.DATABASE_URL || process.env.POSTGRES_URL || '').trim();
}

export function databaseConfigured() {
  return Boolean(databaseUrl());
}

export function getSql() {
  const url = databaseUrl();
  if (!url) return null;
  return neon(url);
}

export async function ensurePlatformSchema() {
  if (!databaseConfigured()) return { configured:false, ready:false, provider:'none' };
  if (schemaReady) return schemaReady;
  schemaReady = (async () => {
    const sql = getSql();
    await sql`
      CREATE TABLE IF NOT EXISTS cybergcode_projects (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        domain TEXT NOT NULL UNIQUE,
        description TEXT,
        archived BOOLEAN NOT NULL DEFAULT FALSE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `;
    await sql`
      CREATE TABLE IF NOT EXISTS cybergcode_audits (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL REFERENCES cybergcode_projects(id) ON DELETE CASCADE,
        target_url TEXT NOT NULL,
        hostname TEXT NOT NULL,
        engine_version TEXT,
        audit_mode TEXT,
        global_score INTEGER,
        status TEXT NOT NULL DEFAULT 'completed',
        findings_total INTEGER NOT NULL DEFAULT 0,
        pages_crawled INTEGER NOT NULL DEFAULT 0,
        snapshot_json JSONB NOT NULL,
        summary_json JSONB NOT NULL,
        result_json JSONB,
        result_stored BOOLEAN NOT NULL DEFAULT FALSE,
        started_at TIMESTAMPTZ,
        completed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `;
    await sql`CREATE INDEX IF NOT EXISTS cybergcode_audits_project_created_idx ON cybergcode_audits(project_id, completed_at DESC)`;
    await sql`CREATE INDEX IF NOT EXISTS cybergcode_audits_hostname_created_idx ON cybergcode_audits(hostname, completed_at DESC)`;
    return { configured:true, ready:true, provider:'postgres-neon-compatible' };
  })().catch((error) => {
    schemaReady = null;
    throw error;
  });
  return schemaReady;
}

export async function platformDatabaseStatus() {
  if (!databaseConfigured()) {
    return {
      configured:false,
      ready:false,
      provider:'none',
      reason:'DATABASE_URL no configurada. El motor de auditoría funciona, pero proyectos e histórico persistente quedan desactivados.'
    };
  }
  try {
    await ensurePlatformSchema();
    const sql = getSql();
    const rows = await sql`SELECT NOW() AS now`;
    return { configured:true, ready:true, provider:'postgres-neon-compatible', serverTime:rows?.[0]?.now || null };
  } catch (error) {
    return { configured:true, ready:false, provider:'postgres-neon-compatible', reason:String(error?.message || error) };
  }
}
