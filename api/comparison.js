import { databaseConfigured } from '../lib/platform/database.js';
import { compareAuditRecords } from '../lib/platform/repository.js';
import { requirePlatformAccess } from '../lib/platform/access.js';

export default async function handler(req, res) {
  res.setHeader('Cache-Control','no-store');
  try {
    if (!requirePlatformAccess(req, res)) return;
    if (req.method !== 'GET') return res.status(405).json({ error:'Método no permitido.' });
    if (!databaseConfigured()) return res.status(503).json({ error:'Base de datos no configurada.', code:'DATABASE_NOT_CONFIGURED' });
    const before = String(req.query?.before || '').trim();
    const after = String(req.query?.after || '').trim();
    if (!before || !after) return res.status(400).json({ error:'Selecciona dos auditorías.' });
    const comparison = await compareAuditRecords(before, after);
    return res.status(200).json(comparison);
  } catch (error) {
    console.error('[comparison]', error);
    return res.status(400).json({ error:error?.message || 'No se pudo comparar las auditorías.' });
  }
}
