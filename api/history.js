import { databaseConfigured } from '../lib/platform/database.js';
import { listAuditHistory } from '../lib/platform/repository.js';
import { requirePlatformAccess } from '../lib/platform/access.js';

export default async function handler(req, res) {
  res.setHeader('Cache-Control','no-store');
  try {
    if (!requirePlatformAccess(req, res)) return;
    if (req.method !== 'GET') return res.status(405).json({ error:'Método no permitido.' });
    if (!databaseConfigured()) return res.status(503).json({ error:'Base de datos no configurada.', code:'DATABASE_NOT_CONFIGURED' });
    const audits = await listAuditHistory({ projectId:req.query?.projectId || null, limit:req.query?.limit || 30, offset:req.query?.offset || 0 });
    return res.status(200).json({ audits });
  } catch (error) {
    console.error('[history]', error);
    return res.status(400).json({ error:error?.message || 'No se pudo cargar el histórico.' });
  }
}
