let schemaReady = null;
let mysqlPoolPromise = null;
let postgresSqlPromise = null;

function env(name) { return String(process.env[name] || '').trim(); }

export function databaseUrl() {
  const explicit = env('DB_PROVIDER').toLowerCase();
  if (['mysql','mariadb','tidb','planetscale','mysql-compatible'].includes(explicit)) {
    return env('MYSQL_URL') || env('MARIADB_URL') || env('DATABASE_URL');
  }
  if (['postgres','postgresql','neon','pg'].includes(explicit)) {
    return env('POSTGRES_URL') || env('DATABASE_URL');
  }
  return env('MYSQL_URL') || env('MARIADB_URL') || env('POSTGRES_URL') || env('DATABASE_URL');
}

export function databaseProvider() {
  const explicit = env('DB_PROVIDER').toLowerCase();
  if (['mysql','mariadb','tidb','planetscale','mysql-compatible'].includes(explicit)) return 'mysql';
  if (['postgres','postgresql','neon','pg'].includes(explicit)) return 'postgres';
  const url = databaseUrl().toLowerCase();
  if (/^(mysql|mariadb):\/\//.test(url)) return 'mysql';
  if (/^(postgres|postgresql):\/\//.test(url)) return 'postgres';
  return url ? 'unknown' : 'none';
}

export function databaseConfigured() {
  return ['mysql','postgres'].includes(databaseProvider()) && Boolean(databaseUrl());
}

function databaseProtocol() {
  const url = databaseUrl();
  const match = url.match(/^([a-z0-9+.-]+):\/\//i);
  return match ? match[1].toLowerCase() : '';
}

function databaseConfigurationError() {
  const provider = databaseProvider();
  const protocol = databaseProtocol();
  if (!databaseUrl()) return 'DATABASE_URL no configurada.';
  if (provider === 'mysql' && !['mysql','mariadb'].includes(protocol)) return `DB_PROVIDER=${env('DB_PROVIDER') || 'mysql'} requiere una URL mysql:// o mariadb://.`;
  if (provider === 'postgres' && !['postgres','postgresql'].includes(protocol)) return `DB_PROVIDER=${env('DB_PROVIDER') || 'postgres'} requiere una URL postgresql:// o postgres://.`;
  if (provider === 'unknown') return 'Protocolo de DATABASE_URL no reconocido.';
  return '';
}

function boolEnv(name, fallback = false) {
  const value = env(name).toLowerCase();
  if (!value) return fallback;
  return ['1','true','yes','on','required'].includes(value);
}

function mysqlConfig() {
  const raw = databaseUrl().replace(/^mariadb:\/\//i, 'mysql://');
  const url = new URL(raw);
  const host = url.hostname;
  const tlsByHost = /tidbcloud\.com$|\.tidbcloud\.com$|psdb\.cloud$|\.psdb\.cloud$/i.test(host);
  const sslMode = String(url.searchParams.get('ssl-mode') || url.searchParams.get('sslmode') || '').toLowerCase();
  const sslEnabled = boolEnv('DB_SSL', tlsByHost || ['required','verify-ca','verify-full'].includes(sslMode));
  const rejectUnauthorized = boolEnv('DB_SSL_REJECT_UNAUTHORIZED', true);
  const poolLimit = Math.min(Math.max(Number(env('DB_POOL_LIMIT')) || 3, 1), 10);
  const connectTimeout = Math.min(Math.max(Number(env('DB_CONNECT_TIMEOUT_MS')) || 10_000, 2_000), 30_000);
  return {
    host,
    port: Number(url.port || 3306),
    user: decodeURIComponent(url.username || ''),
    password: decodeURIComponent(url.password || ''),
    database: decodeURIComponent(url.pathname.replace(/^\//,'')),
    waitForConnections: true,
    connectTimeout,
    connectionLimit: poolLimit,
    maxIdle: poolLimit,
    idleTimeout: 30_000,
    queueLimit: 0,
    enableKeepAlive: true,
    keepAliveInitialDelay: 0,
    charset: 'utf8mb4',
    timezone: 'Z',
    ...(sslEnabled ? { ssl:{ rejectUnauthorized, minVersion:'TLSv1.2' } } : {})
  };
}

async function getMySqlPool() {
  if (!mysqlPoolPromise) {
    mysqlPoolPromise = import('mysql2/promise').then((module) => {
      const api = module.default || module;
      if (typeof api.createPool !== 'function') throw new Error('mysql2/promise no expone createPool().');
      return api.createPool(mysqlConfig());
    }).catch((error) => {
      mysqlPoolPromise = null;
      throw error;
    });
  }
  return mysqlPoolPromise;
}

async function getPostgresSql() {
  if (!postgresSqlPromise) {
    postgresSqlPromise = import('@neondatabase/serverless').then(({ neon }) => neon(databaseUrl())).catch((error) => {
      postgresSqlPromise = null;
      throw error;
    });
  }
  return postgresSqlPromise;
}

function pgPlaceholders(statement) {
  let index = 0;
  return statement.replace(/\?/g, () => `$${++index}`);
}

export async function dbQuery(statement, params = []) {
  const configurationError = databaseConfigurationError();
  if (configurationError) throw new Error(configurationError);
  const provider = databaseProvider();
  if (provider === 'mysql') {
    const pool = await getMySqlPool();
    const [rows] = await pool.execute(statement, params);
    return rows;
  }
  if (provider === 'postgres') {
    const sql = await getPostgresSql();
    return sql.query(pgPlaceholders(statement), params);
  }
  throw new Error('Proveedor de base de datos no soportado. Usa DB_PROVIDER=mysql o DB_PROVIDER=postgres.');
}

async function ensureMySqlSchema() {
  await dbQuery(`CREATE TABLE IF NOT EXISTS cybergcode_projects (
    id VARCHAR(40) PRIMARY KEY,
    organization_id VARCHAR(64) NOT NULL,
    created_by VARCHAR(64) NOT NULL,
    name VARCHAR(160) NOT NULL,
    domain VARCHAR(255) NOT NULL,
    description TEXT NULL,
    archived BOOLEAN NOT NULL DEFAULT FALSE,
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
    UNIQUE KEY cybergcode_projects_org_domain_uidx (organization_id,domain),
    INDEX cybergcode_projects_org_updated_idx (organization_id,updated_at)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
  await dbQuery(`CREATE TABLE IF NOT EXISTS cybergcode_audits (
    id VARCHAR(64) PRIMARY KEY,
    project_id VARCHAR(40) NOT NULL,
    organization_id VARCHAR(64) NOT NULL,
    created_by VARCHAR(64) NOT NULL,
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
    INDEX cybergcode_audits_org_created_idx (organization_id, completed_at),
    INDEX cybergcode_audits_hostname_created_idx (hostname, completed_at)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
  await dbQuery(`CREATE TABLE IF NOT EXISTS cybergcode_rate_limits (
    bucket_key VARCHAR(191) PRIMARY KEY,
    window_start BIGINT NOT NULL,
    used INT NOT NULL DEFAULT 0,
    expires_at BIGINT NOT NULL,
    INDEX cybergcode_rate_limits_expires_idx (expires_at)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
  await dbQuery(`CREATE TABLE IF NOT EXISTS cybergcode_job_locks (
    lock_key VARCHAR(191) PRIMARY KEY,
    owner_token VARCHAR(64) NOT NULL,
    expires_at BIGINT NOT NULL,
    INDEX cybergcode_job_locks_expires_idx (expires_at)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
  await dbQuery(`CREATE TABLE IF NOT EXISTS cybergcode_admin_events (
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
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
  await ensureMySqlTenantColumns();
}

async function ignoreSchemaError(statement) { try { await dbQuery(statement); } catch {} }

async function ensureMySqlTenantColumns() {
  await ignoreSchemaError("ALTER TABLE cybergcode_projects ADD COLUMN organization_id VARCHAR(64) NULL AFTER id");
  await ignoreSchemaError("ALTER TABLE cybergcode_projects ADD COLUMN created_by VARCHAR(64) NULL AFTER organization_id");
  await ignoreSchemaError("UPDATE cybergcode_projects SET organization_id='legacy' WHERE organization_id IS NULL OR organization_id=''");
  await ignoreSchemaError("UPDATE cybergcode_projects SET created_by='legacy' WHERE created_by IS NULL OR created_by=''");
  await ignoreSchemaError('ALTER TABLE cybergcode_projects DROP INDEX domain');
  await ignoreSchemaError('CREATE UNIQUE INDEX cybergcode_projects_org_domain_uidx ON cybergcode_projects(organization_id,domain)');
  await ignoreSchemaError('CREATE INDEX cybergcode_projects_org_updated_idx ON cybergcode_projects(organization_id,updated_at)');
  await ignoreSchemaError("ALTER TABLE cybergcode_audits ADD COLUMN organization_id VARCHAR(64) NULL AFTER project_id");
  await ignoreSchemaError("ALTER TABLE cybergcode_audits ADD COLUMN created_by VARCHAR(64) NULL AFTER organization_id");
  await ignoreSchemaError("UPDATE cybergcode_audits SET organization_id='legacy' WHERE organization_id IS NULL OR organization_id=''");
  await ignoreSchemaError("UPDATE cybergcode_audits SET created_by='legacy' WHERE created_by IS NULL OR created_by=''");
  await ignoreSchemaError('CREATE INDEX cybergcode_audits_org_created_idx ON cybergcode_audits(organization_id,completed_at)');
}

async function ensurePostgresSchema() {
  await dbQuery(`CREATE TABLE IF NOT EXISTS cybergcode_projects (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    created_by TEXT NOT NULL,
    name TEXT NOT NULL,
    domain TEXT NOT NULL,
    description TEXT,
    archived BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`);
  await dbQuery(`CREATE TABLE IF NOT EXISTS cybergcode_audits (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL REFERENCES cybergcode_projects(id) ON DELETE CASCADE,
    organization_id TEXT NOT NULL,
    created_by TEXT NOT NULL,
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
  )`);
  await dbQuery('CREATE INDEX IF NOT EXISTS cybergcode_audits_project_created_idx ON cybergcode_audits(project_id, completed_at DESC)');
  await dbQuery('CREATE INDEX IF NOT EXISTS cybergcode_audits_hostname_created_idx ON cybergcode_audits(hostname, completed_at DESC)');
  await ensurePostgresTenantColumns();
  await dbQuery(`CREATE TABLE IF NOT EXISTS cybergcode_rate_limits (
    bucket_key TEXT PRIMARY KEY,
    window_start BIGINT NOT NULL,
    used INTEGER NOT NULL DEFAULT 0,
    expires_at BIGINT NOT NULL
  )`);
  await dbQuery('CREATE INDEX IF NOT EXISTS cybergcode_rate_limits_expires_idx ON cybergcode_rate_limits(expires_at)');
  await dbQuery(`CREATE TABLE IF NOT EXISTS cybergcode_job_locks (
    lock_key TEXT PRIMARY KEY,
    owner_token TEXT NOT NULL,
    expires_at BIGINT NOT NULL
  )`);
  await dbQuery('CREATE INDEX IF NOT EXISTS cybergcode_job_locks_expires_idx ON cybergcode_job_locks(expires_at)');
  await dbQuery(`CREATE TABLE IF NOT EXISTS cybergcode_admin_events (
    id TEXT PRIMARY KEY,
    actor_id TEXT NOT NULL,
    actor_email TEXT,
    action_name TEXT NOT NULL,
    target_user_id TEXT,
    organization_id TEXT,
    details_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`);
  await dbQuery('CREATE INDEX IF NOT EXISTS cybergcode_admin_events_created_idx ON cybergcode_admin_events(created_at DESC)');
  await dbQuery('CREATE INDEX IF NOT EXISTS cybergcode_admin_events_org_idx ON cybergcode_admin_events(organization_id,created_at DESC)');
}

async function ensurePostgresTenantColumns() {
  await dbQuery('ALTER TABLE cybergcode_projects ADD COLUMN IF NOT EXISTS organization_id TEXT');
  await dbQuery('ALTER TABLE cybergcode_projects ADD COLUMN IF NOT EXISTS created_by TEXT');
  await dbQuery("UPDATE cybergcode_projects SET organization_id='legacy' WHERE organization_id IS NULL OR organization_id=''");
  await dbQuery("UPDATE cybergcode_projects SET created_by='legacy' WHERE created_by IS NULL OR created_by=''");
  await dbQuery('ALTER TABLE cybergcode_projects DROP CONSTRAINT IF EXISTS cybergcode_projects_domain_key');
  await dbQuery('CREATE UNIQUE INDEX IF NOT EXISTS cybergcode_projects_org_domain_uidx ON cybergcode_projects(organization_id,domain)');
  await dbQuery('CREATE INDEX IF NOT EXISTS cybergcode_projects_org_updated_idx ON cybergcode_projects(organization_id,updated_at DESC)');
  await dbQuery('ALTER TABLE cybergcode_audits ADD COLUMN IF NOT EXISTS organization_id TEXT');
  await dbQuery('ALTER TABLE cybergcode_audits ADD COLUMN IF NOT EXISTS created_by TEXT');
  await dbQuery("UPDATE cybergcode_audits SET organization_id='legacy' WHERE organization_id IS NULL OR organization_id=''");
  await dbQuery("UPDATE cybergcode_audits SET created_by='legacy' WHERE created_by IS NULL OR created_by=''");
  await dbQuery('CREATE INDEX IF NOT EXISTS cybergcode_audits_org_created_idx ON cybergcode_audits(organization_id,completed_at DESC)');
}

export async function ensurePlatformSchema() {
  if (!databaseConfigured()) return { configured:false, ready:false, provider:databaseProvider() };
  if (schemaReady) return schemaReady;
  schemaReady = (async () => {
    const provider = databaseProvider();
    if (provider === 'mysql') await ensureMySqlSchema();
    else if (provider === 'postgres') await ensurePostgresSchema();
    return databaseDescriptor({ configured:true, ready:true });
  })().catch((error) => {
    schemaReady = null;
    throw error;
  });
  return schemaReady;
}

function providerLabel(provider = databaseProvider()) {
  if (provider === 'mysql') {
    const explicit = env('DB_PROVIDER').toLowerCase();
    const host = (() => { try { return new URL(databaseUrl().replace(/^mariadb:/i,'mysql:')).hostname; } catch { return ''; } })();
    if (explicit === 'mariadb' || /^mariadb:/i.test(databaseUrl())) return 'MariaDB';
    if (explicit === 'tidb' || /tidbcloud\.com$/i.test(host)) return 'TiDB Cloud · MySQL compatible';
    if (explicit === 'planetscale' || /psdb\.cloud$/i.test(host)) return 'PlanetScale · MySQL compatible';
    return 'MySQL / MariaDB';
  }
  if (provider === 'postgres') return 'PostgreSQL / Neon';
  return 'No configurada';
}

function databaseDescriptor(extra = {}) {
  const provider = databaseProvider();
  return {
    provider,
    dialect: provider === 'mysql' ? 'mysql' : provider === 'postgres' ? 'postgresql' : null,
    driver: provider === 'mysql' ? 'mysql2' : provider === 'postgres' ? '@neondatabase/serverless' : null,
    label: providerLabel(provider),
    ...extra
  };
}

export async function platformDatabaseStatus() {
  const provider = databaseProvider();
  const configurationError = databaseConfigurationError();
  if (!databaseConfigured() || configurationError) {
    const reason = configurationError || 'Base de datos no configurada. Define DB_PROVIDER y DATABASE_URL para activar proyectos, histórico y comparativas.';
    return databaseDescriptor({ configured:Boolean(databaseUrl()), ready:false, reason });
  }
  try {
    await ensurePlatformSchema();
    const rows = provider === 'mysql'
      ? await dbQuery('SELECT CURRENT_TIMESTAMP AS now, VERSION() AS version')
      : await dbQuery('SELECT CURRENT_TIMESTAMP AS now, version() AS version');
    return databaseDescriptor({ configured:true, ready:true, serverTime:rows?.[0]?.now || null, serverVersion:rows?.[0]?.version || null });
  } catch (error) {
    return databaseDescriptor({ configured:true, ready:false, reason:String(error?.message || error) });
  }
}
