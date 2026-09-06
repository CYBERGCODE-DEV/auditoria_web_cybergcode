CREATE TABLE IF NOT EXISTS cybergcode_admin_events (
  id VARCHAR(64) PRIMARY KEY,
  actor_id VARCHAR(64) NOT NULL,
  actor_email VARCHAR(255) NULL,
  action_name VARCHAR(80) NOT NULL,
  target_user_id VARCHAR(64) NULL,
  organization_id VARCHAR(64) NULL,
  details_json LONGTEXT NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX cybergcode_admin_events_created_idx (created_at),
  INDEX cybergcode_admin_events_org_idx (organization_id,created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
