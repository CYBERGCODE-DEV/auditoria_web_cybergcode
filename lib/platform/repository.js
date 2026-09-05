import crypto from 'node:crypto';
import { databaseConfigured, databaseProvider, dbQuery, ensurePlatformSchema } from './database.js';
import { buildAuditSnapshot, compareAuditSnapshots } from './snapshot.js';

const MAX_RESULT_JSON_BYTES = 3_500_000;

function projectIdForDomain(domain) {
  return `PRJ-${crypto.createHash('sha256').update(domain).digest('hex').slice(0,12).toUpperCase()}`;
}
function normalizeDomain(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  try { return new URL(raw.includes('://') ? raw : `https://${raw}`).hostname.toLowerCase().replace(/^www\./,''); }
  catch { return raw.toLowerCase().replace(/^www\./,'').split('/')[0]; }
}
function jsonText(value) { return JSON.stringify(value ?? {}); }
function jsonValue(value) {
  if (value == null || typeof value === 'object') return value;
  try { return JSON.parse(value); } catch { return null; }
}
function dateValue(value) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}
function publicProject(row) {
  if (!row) return null;
  return { id:row.id, name:row.name, domain:row.domain, description:row.description || '', archived:Boolean(row.archived), createdAt:row.created_at, updatedAt:row.updated_at, auditCount:Number(row.audit_count || 0), lastAuditAt:row.last_audit_at || null, lastScore:row.last_score == null ? null : Number(row.last_score) };
}
function publicAudit(row, { includeResult = false } = {}) {
  if (!row) return null;
  return {
    id:row.id, projectId:row.project_id, target:row.target_url, hostname:row.hostname, engineVersion:row.engine_version,
    mode:row.audit_mode, globalScore:row.global_score == null ? null : Number(row.global_score),
    status:row.status, findingsTotal:Number(row.findings_total || 0), pagesCrawled:Number(row.pages_crawled || 0),
    snapshot:jsonValue(row.snapshot_json), summary:jsonValue(row.summary_json), resultStored:Boolean(row.result_stored),
    startedAt:row.started_at, completedAt:row.completed_at, createdAt:row.created_at,
    ...(includeResult ? { result:jsonValue(row.result_json) } : {})
  };
}

async function projectByDomain(domain) {
  const rows = await dbQuery(`SELECT p.*,
    (SELECT COUNT(*) FROM cybergcode_audits a WHERE a.project_id=p.id) AS audit_count,
    (SELECT MAX(a.completed_at) FROM cybergcode_audits a WHERE a.project_id=p.id) AS last_audit_at,
    (SELECT a2.global_score FROM cybergcode_audits a2 WHERE a2.project_id=p.id AND a2.global_score IS NOT NULL ORDER BY a2.completed_at DESC LIMIT 1) AS last_score
    FROM cybergcode_projects p WHERE p.domain=? LIMIT 1`, [domain]);
  return publicProject(rows?.[0]);
}

export async function ensureProject({ domain, name = null, description = null } = {}) {
  if (!databaseConfigured()) return null;
  await ensurePlatformSchema();
  const hostname = normalizeDomain(domain);
  if (!hostname) throw new Error('Dominio de proyecto inválido.');
  const id = projectIdForDomain(hostname);
  const projectName = String(name || hostname).trim().slice(0,160) || hostname;
  if (databaseProvider() === 'mysql') {
    await dbQuery(`INSERT INTO cybergcode_projects (id,name,domain,description,updated_at)
      VALUES (?,?,?,?,CURRENT_TIMESTAMP(3))
      ON DUPLICATE KEY UPDATE name=IF(name=domain,VALUES(name),name), updated_at=CURRENT_TIMESTAMP(3)`, [id,projectName,hostname,description || null]);
  } else {
    await dbQuery(`INSERT INTO cybergcode_projects (id,name,domain,description,updated_at)
      VALUES (?,?,?,?,NOW())
      ON CONFLICT (domain) DO UPDATE SET
      name=CASE WHEN cybergcode_projects.name=cybergcode_projects.domain THEN EXCLUDED.name ELSE cybergcode_projects.name END,
      updated_at=NOW()`, [id,projectName,hostname,description || null]);
  }
  return projectByDomain(hostname);
}

export async function createOrUpdateProject({ id = null, domain, name, description = null, archived = false } = {}) {
  if (!databaseConfigured()) throw new Error('Base de datos no configurada.');
  await ensurePlatformSchema();
  const hostname = normalizeDomain(domain);
  if (!hostname) throw new Error('Dominio obligatorio.');
  const projectId = id || projectIdForDomain(hostname);
  const projectName = String(name || hostname).trim().slice(0,160) || hostname;
  if (databaseProvider() === 'mysql') {
    await dbQuery(`INSERT INTO cybergcode_projects (id,name,domain,description,archived,updated_at)
      VALUES (?,?,?,?,?,CURRENT_TIMESTAMP(3))
      ON DUPLICATE KEY UPDATE name=VALUES(name),description=VALUES(description),archived=VALUES(archived),updated_at=CURRENT_TIMESTAMP(3)`, [projectId,projectName,hostname,description || null,Boolean(archived)]);
  } else {
    await dbQuery(`INSERT INTO cybergcode_projects (id,name,domain,description,archived,updated_at)
      VALUES (?,?,?,?,?,NOW())
      ON CONFLICT (id) DO UPDATE SET name=EXCLUDED.name,description=EXCLUDED.description,archived=EXCLUDED.archived,updated_at=NOW()`, [projectId,projectName,hostname,description || null,Boolean(archived)]);
  }
  return getProject(projectId);
}

export async function listProjects({ includeArchived = false, limit = 100 } = {}) {
  if (!databaseConfigured()) return [];
  await ensurePlatformSchema();
  const max = Math.min(Math.max(Number(limit) || 100,1),250);
  const where = includeArchived ? '' : 'WHERE p.archived=FALSE';
  const rows = await dbQuery(`SELECT p.*,
    (SELECT COUNT(*) FROM cybergcode_audits a WHERE a.project_id=p.id) AS audit_count,
    (SELECT MAX(a.completed_at) FROM cybergcode_audits a WHERE a.project_id=p.id) AS last_audit_at,
    (SELECT a2.global_score FROM cybergcode_audits a2 WHERE a2.project_id=p.id AND a2.global_score IS NOT NULL ORDER BY a2.completed_at DESC LIMIT 1) AS last_score
    FROM cybergcode_projects p ${where}
    ORDER BY COALESCE((SELECT MAX(a3.completed_at) FROM cybergcode_audits a3 WHERE a3.project_id=p.id),p.updated_at) DESC LIMIT ?`, [max]);
  return rows.map(publicProject);
}

export async function getProject(id) {
  if (!databaseConfigured()) return null;
  await ensurePlatformSchema();
  const rows = await dbQuery(`SELECT p.*,
    (SELECT COUNT(*) FROM cybergcode_audits a WHERE a.project_id=p.id) AS audit_count,
    (SELECT MAX(a.completed_at) FROM cybergcode_audits a WHERE a.project_id=p.id) AS last_audit_at,
    (SELECT a2.global_score FROM cybergcode_audits a2 WHERE a2.project_id=p.id AND a2.global_score IS NOT NULL ORDER BY a2.completed_at DESC LIMIT 1) AS last_score
    FROM cybergcode_projects p WHERE p.id=? LIMIT 1`, [id]);
  return publicProject(rows?.[0]);
}

export async function persistAuditResult(audit, { projectId = null } = {}) {
  if (!databaseConfigured()) return { status:'unavailable', reason:'database-not-configured', project:null, audit:null };
  await ensurePlatformSchema();
  const target = audit?.meta?.target;
  if (!target || !audit?.meta?.id) throw new Error('Resultado de auditoría inválido para persistencia.');
  const hostname = normalizeDomain(target);
  let project = projectId ? await getProject(projectId) : null;
  if (!project) project = await ensureProject({ domain:hostname, name:hostname });
  const snapshot = buildAuditSnapshot(audit);
  const resultString = jsonText(audit);
  const resultBytes = Buffer.byteLength(resultString);
  const storeFullResult = resultBytes <= MAX_RESULT_JSON_BYTES;
  const values = [audit.meta.id,project.id,target,hostname,audit.meta.engineVersion || null,audit.meta.mode || null,Number.isFinite(audit?.scores?.global) ? audit.scores.global : null,'completed',Number(audit?.summary?.findingsTotal || 0),Number(audit?.summary?.pagesCrawled || 0),jsonText(snapshot),jsonText(audit?.summary || {}),storeFullResult ? resultString : null,storeFullResult,dateValue(audit.meta.startedAt),dateValue(audit.meta.finishedAt) || new Date()];
  if (databaseProvider() === 'mysql') {
    await dbQuery(`INSERT INTO cybergcode_audits (
      id,project_id,target_url,hostname,engine_version,audit_mode,global_score,status,findings_total,pages_crawled,snapshot_json,summary_json,result_json,result_stored,started_at,completed_at
    ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    ON DUPLICATE KEY UPDATE snapshot_json=VALUES(snapshot_json),summary_json=VALUES(summary_json),result_json=VALUES(result_json),result_stored=VALUES(result_stored),global_score=VALUES(global_score),findings_total=VALUES(findings_total),pages_crawled=VALUES(pages_crawled),completed_at=VALUES(completed_at)`, values);
    await dbQuery('UPDATE cybergcode_projects SET updated_at=CURRENT_TIMESTAMP(3) WHERE id=?',[project.id]);
  } else {
    await dbQuery(`INSERT INTO cybergcode_audits (
      id,project_id,target_url,hostname,engine_version,audit_mode,global_score,status,findings_total,pages_crawled,snapshot_json,summary_json,result_json,result_stored,started_at,completed_at
    ) VALUES (?,?,?,?,?,?,?,?,?,?,?::jsonb,?::jsonb,?::jsonb,?,?,?)
    ON CONFLICT (id) DO UPDATE SET snapshot_json=EXCLUDED.snapshot_json,summary_json=EXCLUDED.summary_json,result_json=EXCLUDED.result_json,result_stored=EXCLUDED.result_stored,global_score=EXCLUDED.global_score,findings_total=EXCLUDED.findings_total,pages_crawled=EXCLUDED.pages_crawled,completed_at=EXCLUDED.completed_at`, values);
    await dbQuery('UPDATE cybergcode_projects SET updated_at=NOW() WHERE id=?',[project.id]);
  }
  const storedAudit = await getAuditRecord(audit.meta.id);
  const refreshedProject = await getProject(project.id);
  return { status:'stored', project:refreshedProject || project, audit:storedAudit, fullResultStored:storeFullResult, resultBytes };
}

export async function listAuditHistory({ projectId, limit = 30, offset = 0 } = {}) {
  if (!databaseConfigured()) return [];
  await ensurePlatformSchema();
  const max = Math.min(Math.max(Number(limit) || 30,1),100);
  const skip = Math.max(Number(offset) || 0,0);
  const rows = projectId
    ? await dbQuery('SELECT * FROM cybergcode_audits WHERE project_id=? ORDER BY completed_at DESC LIMIT ? OFFSET ?',[projectId,max,skip])
    : await dbQuery('SELECT * FROM cybergcode_audits ORDER BY completed_at DESC LIMIT ? OFFSET ?',[max,skip]);
  return rows.map((row) => publicAudit(row));
}

export async function getAuditRecord(id, { includeResult = false } = {}) {
  if (!databaseConfigured()) return null;
  await ensurePlatformSchema();
  const columns = includeResult ? '*' : 'id,project_id,target_url,hostname,engine_version,audit_mode,global_score,status,findings_total,pages_crawled,snapshot_json,summary_json,result_stored,started_at,completed_at,created_at';
  const rows = await dbQuery(`SELECT ${columns} FROM cybergcode_audits WHERE id=? LIMIT 1`, [id]);
  return publicAudit(rows?.[0], { includeResult });
}

export async function compareAuditRecords(beforeId, afterId) {
  const [before,after] = await Promise.all([getAuditRecord(beforeId),getAuditRecord(afterId)]);
  if (!before || !after) throw new Error('No se encontraron ambas auditorías para comparar.');
  if (before.projectId !== after.projectId) throw new Error('Las auditorías deben pertenecer al mismo proyecto.');
  return { projectId:before.projectId, before, after, comparison:compareAuditSnapshots(before.snapshot,after.snapshot) };
}
