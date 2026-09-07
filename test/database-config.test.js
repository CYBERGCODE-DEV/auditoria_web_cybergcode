import test from 'node:test';
import assert from 'node:assert/strict';
import { databaseConfigured, databaseProvider, databaseUrl, platformDatabaseStatus } from '../lib/platform/database.js';

test('reconoce la URI del pooler de Supabase como PostgreSQL sin confundirla con Auth', () => {
  const previous = {
    DB_PROVIDER:process.env.DB_PROVIDER,
    SUPABASE_DB_URL:process.env.SUPABASE_DB_URL,
    DATABASE_URL:process.env.DATABASE_URL,
    POSTGRES_URL:process.env.POSTGRES_URL
  };
  try {
    process.env.DB_PROVIDER = 'postgres';
    process.env.SUPABASE_DB_URL = 'postgresql://user:password@aws-0-us-east-1.pooler.supabase.com:6543/postgres?sslmode=require';
    delete process.env.DATABASE_URL;
    delete process.env.POSTGRES_URL;
    assert.equal(databaseProvider(), 'postgres');
    assert.equal(databaseConfigured(), true);
    assert.equal(databaseUrl(), process.env.SUPABASE_DB_URL);
  } finally {
    for (const [key,value] of Object.entries(previous)) {
      if (value == null) delete process.env[key];
      else process.env[key] = value;
    }
  }
});

test('rechaza una URI de Supabase que conserva marcadores del ejemplo sin intentar DNS', async () => {
  const previous = {
    DB_PROVIDER:process.env.DB_PROVIDER,
    SUPABASE_DB_URL:process.env.SUPABASE_DB_URL,
    DATABASE_URL:process.env.DATABASE_URL,
    POSTGRES_URL:process.env.POSTGRES_URL
  };
  try {
    process.env.DB_PROVIDER = 'postgres';
    process.env.SUPABASE_DB_URL = 'postgresql://postgres.PROJECT_REF:password@aws-0-REGION.pooler.supabase.com:6543/postgres';
    delete process.env.DATABASE_URL;
    delete process.env.POSTGRES_URL;
    assert.equal(databaseProvider(), 'postgres');
    assert.equal(databaseConfigured(), false);
    const status = await platformDatabaseStatus();
    assert.equal(status.ready, false);
    assert.match(status.reason, /valores de ejemplo/i);
    assert.match(status.reason, /REGION/);
  } finally {
    for (const [key,value] of Object.entries(previous)) {
      if (value == null) delete process.env[key];
      else process.env[key] = value;
    }
  }
});
