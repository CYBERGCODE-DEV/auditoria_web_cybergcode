import { databaseConfigured, platformDatabaseStatus } from '../lib/platform/database.js';
import {
  compareAuditRecords,
  createOrUpdateProject,
  getAuditRecord,
  getProject,
  listAuditHistory,
  listProjects
} from '../lib/platform/repository.js';
import { hasPlatformAccess, platformAccessConfigured, requirePlatformAccess } from '../lib/platform/access.js';

function bodyOf(req) {
  return typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
}

function requireDatabase(res) {
  if (databaseConfigured()) return true;
  res.status(503).json({ error:'Base de datos no configurada.', code:'DATABASE_NOT_CONFIGURED' });
  return false;
}

async function status(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error:'Método no permitido.' });
  const database = await platformDatabaseStatus();
  const accessConfigured = platformAccessConfigured();
  const authorized = accessConfigured && hasPlatformAccess(req);
  const projects = database.ready && authorized ? await listProjects({ limit:5 }).catch(()=>[]) : [];
  return res.status(200).json({ database, access:{ configured:accessConfigured, authorized, required:true }, projectCount:authorized ? projects.length : null, recentProjects:projects });
}

async function projects(req, res) {
  if (!requireDatabase(res)) return;
  if (req.method === 'GET') {
    const rows = await listProjects({ includeArchived:req.query?.archived === '1', limit:req.query?.limit || 100 });
    return res.status(200).json({ projects:rows });
  }
  if (req.method === 'POST') {
    const body = bodyOf(req);
    const project = await createOrUpdateProject({ domain:body.domain, name:body.name, description:body.description });
    return res.status(201).json({ project });
  }
  return res.status(405).json({ error:'Método no permitido.' });
}

async function project(req, res) {
  if (!requireDatabase(res)) return;
  const id = String(req.query?.id || '').trim();
  if (!id) return res.status(400).json({ error:'Falta id del proyecto.' });
  if (req.method === 'GET') {
    const row = await getProject(id);
    return row ? res.status(200).json({ project:row }) : res.status(404).json({ error:'Proyecto no encontrado.' });
  }
  if (req.method === 'PATCH') {
    const current = await getProject(id);
    if (!current) return res.status(404).json({ error:'Proyecto no encontrado.' });
    const body = bodyOf(req);
    const row = await createOrUpdateProject({ id, domain:current.domain, name:body.name ?? current.name, description:body.description ?? current.description, archived:body.archived ?? current.archived });
    return res.status(200).json({ project:row });
  }
  return res.status(405).json({ error:'Método no permitido.' });
}

async function history(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error:'Método no permitido.' });
  if (!requireDatabase(res)) return;
  const audits = await listAuditHistory({ projectId:req.query?.projectId || null, limit:req.query?.limit || 30, offset:req.query?.offset || 0 });
  return res.status(200).json({ audits });
}

async function auditRecord(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error:'Método no permitido.' });
  if (!requireDatabase(res)) return;
  const id = String(req.query?.id || '').trim();
  if (!id) return res.status(400).json({ error:'Falta ID de auditoría.' });
  const audit = await getAuditRecord(id, { includeResult:req.query?.result === '1' });
  return audit ? res.status(200).json({ audit }) : res.status(404).json({ error:'Auditoría no encontrada.' });
}

async function comparison(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error:'Método no permitido.' });
  if (!requireDatabase(res)) return;
  const before = String(req.query?.before || '').trim();
  const after = String(req.query?.after || '').trim();
  if (!before || !after) return res.status(400).json({ error:'Selecciona dos auditorías.' });
  return res.status(200).json(await compareAuditRecords(before, after));
}

const handlers = { status, projects, project, history, 'audit-record':auditRecord, comparison };

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  const resource = String(req.query?.resource || 'status');
  const selected = handlers[resource];
  if (!selected) return res.status(404).json({ error:'Recurso de plataforma no encontrado.' });
  try {
    if (resource !== 'status' && !requirePlatformAccess(req, res)) return;
    return await selected(req, res);
  } catch (error) {
    console.error(`[platform/${resource}]`, error);
    return res.status(400).json({ error:error?.message || 'No se pudo procesar la solicitud de plataforma.' });
  }
}
