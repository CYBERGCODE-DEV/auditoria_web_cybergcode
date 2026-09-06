import test from 'node:test';
import assert from 'node:assert/strict';
import { publicUser, validatePassword } from '../lib/auth/supabase.js';
import { assertLargeAuditJobAccess, tokenHash } from '../lib/jobs/large-audit-state.js';
import { setJob } from '../lib/jobs/job-store.js';

test('solo app_metadata o la lista de arranque concede rol administrativo', () => {
  const previous = process.env.CYBERGCODE_ADMIN_EMAILS;
  process.env.CYBERGCODE_ADMIN_EMAILS = 'owner@example.com';
  try {
    const bootstrap = publicUser({ id:'u-1',email:'owner@example.com',app_metadata:{},user_metadata:{} });
    const analyst = publicUser({ id:'u-2',email:'person@example.com',app_metadata:{ role:'analyst',organization_id:'org-2' },user_metadata:{} });
    const forged = publicUser({ id:'u-3',email:'other@example.com',app_metadata:{},user_metadata:{ role:'admin',organization_id:'org-forged' } });
    assert.equal(bootstrap.isAdmin,true);
    assert.equal(analyst.organizationId,'org-2');
    assert.equal(forged.isAdmin,false);
    assert.equal(forged.organizationId,'u-3');
  } finally {
    if (previous === undefined) delete process.env.CYBERGCODE_ADMIN_EMAILS;
    else process.env.CYBERGCODE_ADMIN_EMAILS = previous;
  }
});

test('la política de contraseña exige longitud y diversidad', () => {
  assert.match(validatePassword('corta'),/12 caracteres/);
  assert.match(validatePassword('solamenteminusculas'),/mayúscula/);
  assert.equal(validatePassword('Segura-2026!Clave'),'');
});

test('normaliza el plan y calcula la cuota visible sin confiar en user_metadata', () => {
  const user = publicUser({ id:'quota-user',email:'quota@example.com',app_metadata:{ plan:'monthly',billing_period:'monthly',subscription_status:'active',audit_limit:20,audit_used:7,bonus_days:3 },user_metadata:{ audit_limit:9999 } });
  assert.equal(user.subscription.plan,'monthly');
  assert.equal(user.subscription.auditLimit,20);
  assert.equal(user.subscription.auditRemaining,13);
  assert.equal(user.subscription.bonusDays,3);
});

test('un token de job no permite cruzar de usuario u organización', async () => {
  const token = 'token-de-prueba-muy-largo';
  const id = `JOB-AUTH-${Date.now()}`;
  await setJob({ id,accessTokenHash:tokenHash(token),ownerUserId:'user-a',organizationId:'org-a',status:'crawling',queue:[],events:[] });
  await assertLargeAuditJobAccess(id,token,{ id:'user-a',organizationId:'org-a' });
  await assert.rejects(()=>assertLargeAuditJobAccess(id,token,{ id:'user-b',organizationId:'org-a' }),/no pertenece/);
  await assert.rejects(()=>assertLargeAuditJobAccess(id,token,{ id:'user-a',organizationId:'org-b' }),/no pertenece/);
});
