import crypto from 'node:crypto';
import { databaseConfigured, databaseProvider, dbQuery, ensurePlatformSchema } from './database.js';

function parseDetails(value) {
  if (!value) return {};
  if (typeof value === 'object') return value;
  try { return JSON.parse(value); } catch { return {}; }
}

export async function recordAdminEvent({ actor, action, targetUserId = null, organizationId = null, details = {} } = {}) {
  if (!databaseConfigured()) return { stored:false, reason:'database-not-configured' };
  await ensurePlatformSchema();
  const id = `ADM-${crypto.randomUUID().toUpperCase()}`;
  await dbQuery(`INSERT INTO cybergcode_admin_events
    (id,actor_id,actor_email,action_name,target_user_id,organization_id,details_json)
    VALUES (?,?,?,?,?,?,?)`, [id,String(actor?.id || 'unknown'),String(actor?.email || ''),String(action || 'unknown'),targetUserId,organizationId,JSON.stringify(details || {})]);
  return { stored:true,id };
}

export async function listAdminEvents({ limit = 100 } = {}) {
  if (!databaseConfigured()) return { available:false, events:[] };
  await ensurePlatformSchema();
  const bounded = Math.min(250,Math.max(1,Number(limit)||100));
  const rows = await dbQuery(`SELECT id,actor_id,actor_email,action_name,target_user_id,organization_id,details_json,created_at
    FROM cybergcode_admin_events ORDER BY created_at DESC LIMIT ${bounded}`);
  return { available:true, events:(rows || []).map((row)=>({
    id:row.id, actorId:row.actor_id, actorEmail:row.actor_email || '', action:row.action_name,
    targetUserId:row.target_user_id || null, organizationId:row.organization_id || null,
    details:parseDetails(row.details_json), createdAt:row.created_at
  })), provider:databaseProvider() };
}
