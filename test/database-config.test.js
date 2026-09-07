import test from 'node:test';
import assert from 'node:assert/strict';
import { databaseConfigured, databaseProvider, databaseUrl } from '../lib/platform/database.js';

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
