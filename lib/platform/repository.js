import crypto from 'node:crypto';
import { databaseConfigured, ensurePlatformSchema, getSql } from './database.js';
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
    snapshot:row.snapshot_json || null, summary:row.summary_json || null, resultStored:Boolean(row.result_stored),
    startedAt:row.started_at, completedAt:row.completed_at, createdAt:row.created_at,
    ...(includeResult ? { result:row.result_json || null } : {})
  };
}

export async function ensureProject({ domain, name = null, description = null } = {}) {
  if (!databaseConfigured()) return null;
  await ensurePlatformSchema();
  const hostname = normalizeDomain(domain);
  if (!hostname) throw new Error('Dominio de proyecto inválido.');
  const id = projectIdForDomain(hostname);
  const projectName = String(name || hostname).trim().slice(0,160) || hostname;
  const sql = getSql();
  const rows = await sql`
    INSERT INTO cybergcode_projects (id, name, domain, description, updated_at)
    VALUES (${id}, ${projectName}, ${hostname}, ${description || null}, NOW())
    ON CONFLICT (domain) DO UPDATE SET
      name = CASE WHEN cybergcode_projects.name = cybergcode_projects.domain THEN EXCLUDED.name ELSE cybergcode_projects.name END,
      updated_at = NOW()
    RETURNING *
  `;
  return publicProject(rows?.[0]);
}

export async function createOrUpdateProject({ id = null, domain, name, description = null, archived = false } = {}) {
  if (!databaseConfigured()) throw new Error('Base de datos no configurada.');
  await ensurePlatformSchema();
  const hostname = normalizeDomain(domain);
  if (!hostname) throw new Error('Dominio obligatorio.');
  const projectId = id || projectIdForDomain(hostname);
  const sql = getSql();
  const rows = await sql`
    INSERT INTO cybergcode_projects (id, name, domain, description, archived, updated_at)
    VALUES (${projectId}, ${String(name || hostname).trim().slice(0,160)}, ${hostname}, ${description || null}, ${Boolean(archived)}, NOW())
    ON CONFLICT (id) DO UPDATE SET name=EXCLUDED.name, description=EXCLUDED.description, archived=EXCLUDED.archived, updated_at=NOW()
    RETURNING *
  `;
  return publicProject(rows?.[0]);
}

export async function listProjects({ includeArchived = false, limit = 100 } = {}) {
  if (!databaseConfigured()) return [];
  await ensurePlatformSchema();
  const sql = getSql();
  const max = Math.min(Math.max(Number(limit) || 100, 1), 250);
  const rows = includeArchived
    ? await sql`SELECT p.*, COUNT(a.id)::int AS audit_count, MAX(a.completed_at) AS last_audit_at, (ARRAY_AGG(a.global_score ORDER BY a.completed_at DESC) FILTER (WHERE a.global_score IS NOT NULL))[1] AS last_score FROM cybergcode_projects p LEFT JOIN cybergcode_audits a ON a.project_id=p.id GROUP BY p.id ORDER BY COALESCE(MAX(a.completed_at),p.updated_at) DESC LIMIT ${max}`
    : await sql`SELECT p.*, COUNT(a.id)::int AS audit_count, MAX(a.completed_at) AS last_audit_at, (ARRAY_AGG(a.global_score ORDER BY a.completed_at DESC) FILTER (WHERE a.global_score IS NOT NULL))[1] AS last_score FROM cybergcode_projects p LEFT JOIN cybergcode_audits a ON a.project_id=p.id WHERE p.archived=FALSE GROUP BY p.id ORDER BY COALESCE(MAX(a.completed_at),p.updated_at) DESC LIMIT ${max}`;
  return rows.map(publicProject);
}

export async function getProject(id) {
  if (!databaseConfigured()) return null;
  await ensurePlatformSchema();
  const sql = getSql();
  const rows = await sql`SELECT p.*, COUNT(a.id)::int AS audit_count, MAX(a.completed_at) AS last_audit_at, (ARRAY_AGG(a.global_score ORDER BY a.completed_at DESC) FILTER (WHERE a.global_score IS NOT NULL))[1] AS last_score FROM cybergcode_projects p LEFT JOIN cybergcode_audits a ON a.project_id=p.id WHERE p.id=${id} GROUP BY p.id LIMIT 1`;
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
  const sql = getSql();
  const rows = await sql`
    INSERT INTO cybergcode_audits (
      id, project_id, target_url, hostname, engine_version, audit_mode, global_score, status,
      findings_total, pages_crawled, snapshot_json, summary_json, result_json, result_stored,
      started_at, completed_at
    ) VALUES (
      ${audit.meta.id}, ${project.id}, ${target}, ${hostname}, ${audit.meta.engineVersion || null}, ${audit.meta.mode || null},
      ${Number.isFinite(audit?.scores?.global) ? audit.scores.global : null}, 'completed', ${Number(audit?.summary?.findingsTotal || 0)},
      ${Number(audit?.summary?.pagesCrawled || 0)}, ${jsonText(snapshot)}::jsonb, ${jsonText(audit?.summary || {})}::jsonb,
      ${storeFullResult ? resultString : null}::jsonb, ${storeFullResult}, ${audit.meta.startedAt || null}, ${audit.meta.finishedAt || new Date().toISOString()}
    )
    ON CONFLICT (id) DO UPDATE SET
      snapshot_json=EXCLUDED.snapshot_json, summary_json=EXCLUDED.summary_json, result_json=EXCLUDED.result_json,
      result_stored=EXCLUDED.result_stored, global_score=EXCLUDED.global_score, findings_total=EXCLUDED.findings_total,
      pages_crawled=EXCLUDED.pages_crawled, completed_at=EXCLUDED.completed_at
    RETURNING *
  `;
  await sql`UPDATE cybergcode_projects SET updated_at=NOW() WHERE id=${project.id}`;
  const storedAudit = publicAudit(rows?.[0]);
  return { status:'stored', project:{ ...project, lastAuditAt:storedAudit?.completedAt || project.lastAuditAt, lastScore:storedAudit?.globalScore ?? project.lastScore, auditCount:Number(project.auditCount || 0) + (project.auditCount ? 0 : 1) }, audit:storedAudit, fullResultStored:storeFullResult, resultBytes };
}

export async function listAuditHistory({ projectId, limit = 30, offset = 0 } = {}) {
  if (!databaseConfigured()) return [];
  await ensurePlatformSchema();
  const sql = getSql();
  const max = Math.min(Math.max(Number(limit) || 30, 1), 100);
  const skip = Math.max(Number(offset) || 0, 0);
  const rows = projectId
    ? await sql`SELECT * FROM cybergcode_audits WHERE project_id=${projectId} ORDER BY completed_at DESC LIMIT ${max} OFFSET ${skip}`
    : await sql`SELECT * FROM cybergcode_audits ORDER BY completed_at DESC LIMIT ${max} OFFSET ${skip}`;
  return rows.map((row) => publicAudit(row));
}

export async function getAuditRecord(id, { includeResult = false } = {}) {
  if (!databaseConfigured()) return null;
  await ensurePlatformSchema();
  const sql = getSql();
  const rows = includeResult
    ? await sql`SELECT * FROM cybergcode_audits WHERE id=${id} LIMIT 1`
    : await sql`SELECT id,project_id,target_url,hostname,engine_version,audit_mode,global_score,status,findings_total,pages_crawled,snapshot_json,summary_json,result_stored,started_at,completed_at,created_at FROM cybergcode_audits WHERE id=${id} LIMIT 1`;
  return publicAudit(rows?.[0], { includeResult });
}

export async function compareAuditRecords(beforeId, afterId) {
  const [before, after] = await Promise.all([getAuditRecord(beforeId), getAuditRecord(afterId)]);
  if (!before || !after) throw new Error('No se encontraron ambas auditorías para comparar.');
  if (before.projectId !== after.projectId) throw new Error('Las auditorías deben pertenecer al mismo proyecto.');
  return { projectId:before.projectId, before, after, comparison:compareAuditSnapshots(before.snapshot, after.snapshot) };
}
