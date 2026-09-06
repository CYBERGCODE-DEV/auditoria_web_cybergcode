-- CYBERGCODE Web Audit Intelligence v0.15.1
-- PostgreSQL / Neon-compatible platform schema
CREATE TABLE IF NOT EXISTS cybergcode_projects (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  domain TEXT NOT NULL UNIQUE,
  description TEXT,
  archived BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
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
);
CREATE INDEX IF NOT EXISTS cybergcode_audits_project_created_idx ON cybergcode_audits(project_id, completed_at DESC);
CREATE INDEX IF NOT EXISTS cybergcode_audits_hostname_created_idx ON cybergcode_audits(hostname, completed_at DESC);
