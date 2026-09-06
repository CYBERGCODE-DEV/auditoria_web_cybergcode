-- CYBERGCODE Web Audit Intelligence v0.15.1
-- MySQL 8 / MariaDB / TiDB-compatible platform schema
CREATE TABLE IF NOT EXISTS cybergcode_projects (
  id VARCHAR(40) PRIMARY KEY,
  name VARCHAR(160) NOT NULL,
  domain VARCHAR(255) NOT NULL UNIQUE,
  description TEXT NULL,
  archived BOOLEAN NOT NULL DEFAULT FALSE,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS cybergcode_rate_limits (
  bucket_key VARCHAR(191) PRIMARY KEY,
  window_start BIGINT NOT NULL,
  used INT NOT NULL DEFAULT 0,
  expires_at BIGINT NOT NULL,
  INDEX cybergcode_rate_limits_expires_idx (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS cybergcode_job_locks (
  lock_key VARCHAR(191) PRIMARY KEY,
  owner_token VARCHAR(64) NOT NULL,
  expires_at BIGINT NOT NULL,
  INDEX cybergcode_job_locks_expires_idx (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS cybergcode_audits (
  id VARCHAR(64) PRIMARY KEY,
  project_id VARCHAR(40) NOT NULL,
  target_url TEXT NOT NULL,
  hostname VARCHAR(255) NOT NULL,
  engine_version VARCHAR(32) NULL,
  audit_mode VARCHAR(40) NULL,
  global_score INT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'completed',
  findings_total INT NOT NULL DEFAULT 0,
  pages_crawled INT NOT NULL DEFAULT 0,
  snapshot_json LONGTEXT NOT NULL,
  summary_json LONGTEXT NOT NULL,
  result_json LONGTEXT NULL,
  result_stored BOOLEAN NOT NULL DEFAULT FALSE,
  started_at DATETIME(3) NULL,
  completed_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX cybergcode_audits_project_created_idx (project_id, completed_at),
  INDEX cybergcode_audits_hostname_created_idx (hostname, completed_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
