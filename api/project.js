import { databaseConfigured } from '../lib/platform/database.js';
import { createOrUpdateProject, getProject } from '../lib/platform/repository.js';
import { requirePlatformAccess } from '../lib/platform/access.js';

function bodyOf(req) { return typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {}); }

export default async function handler(req, res) {
  res.setHeader('Cache-Control','no-store');
  try {
    if (!requirePlatformAccess(req, res)) return;
    if (!databaseConfigured()) return res.status(503).json({ error:'Base de datos no configurada.', code:'DATABASE_NOT_CONFIGURED' });
    const id = String(req.query?.id || '').trim();
    if (!id) return res.status(400).json({ error:'Falta id del proyecto.' });
    if (req.method === 'GET') {
      const project = await getProject(id);
      if (!project) return res.status(404).json({ error:'Proyecto no encontrado.' });
      return res.status(200).json({ project });
    }
    if (req.method === 'PATCH') {
      const current = await getProject(id);
      if (!current) return res.status(404).json({ error:'Proyecto no encontrado.' });
      const body = bodyOf(req);
      const project = await createOrUpdateProject({ id, domain:current.domain, name:body.name ?? current.name, description:body.description ?? current.description, archived:body.archived ?? current.archived });
      return res.status(200).json({ project });
    }
    return res.status(405).json({ error:'Método no permitido.' });
  } catch (error) {
    console.error('[project]', error);
    return res.status(400).json({ error:error?.message || 'No se pudo procesar el proyecto.' });
  }
}
