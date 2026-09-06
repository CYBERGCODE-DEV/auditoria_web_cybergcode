CREATE TABLE IF NOT EXISTS cybergcode_admin_events (
  id TEXT PRIMARY KEY,
  actor_id TEXT NOT NULL,
  actor_email TEXT,
  action_name TEXT NOT NULL,
  target_user_id TEXT,
  organization_id TEXT,
  details_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS cybergcode_admin_events_created_idx ON cybergcode_admin_events(created_at DESC);
CREATE INDEX IF NOT EXISTS cybergcode_admin_events_org_idx ON cybergcode_admin_events(organization_id,created_at DESC);
