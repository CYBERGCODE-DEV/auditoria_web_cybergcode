import { databaseConfigured } from '../lib/platform/database.js';
import { createOrUpdateProject, listProjects } from '../lib/platform/repository.js';
import { requirePlatformAccess } from '../lib/platform/access.js';

function bodyOf(req) { return typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {}); }

export default async function handler(req, res) {
  res.setHeader('Cache-Control','no-store');
  try {
    if (!requirePlatformAccess(req, res)) return;
    if (!databaseConfigured()) return res.status(503).json({ error:'Base de datos no configurada.', code:'DATABASE_NOT_CONFIGURED' });
    if (req.method === 'GET') {
      const projects = await listProjects({ includeArchived:req.query?.archived === '1', limit:req.query?.limit || 100 });
      return res.status(200).json({ projects });
    }
    if (req.method === 'POST') {
      const body = bodyOf(req);
      const project = await createOrUpdateProject({ domain:body.domain, name:body.name, description:body.description });
      return res.status(201).json({ project });
    }
    return res.status(405).json({ error:'Método no permitido.' });
  } catch (error) {
    console.error('[projects]', error);
    return res.status(400).json({ error:error?.message || 'No se pudo procesar el proyecto.' });
  }
}
