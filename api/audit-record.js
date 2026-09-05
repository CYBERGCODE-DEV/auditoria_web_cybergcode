import { databaseConfigured } from '../lib/platform/database.js';
import { getAuditRecord } from '../lib/platform/repository.js';
import { requirePlatformAccess } from '../lib/platform/access.js';

export default async function handler(req, res) {
  res.setHeader('Cache-Control','no-store');
  try {
    if (!requirePlatformAccess(req, res)) return;
    if (req.method !== 'GET') return res.status(405).json({ error:'Método no permitido.' });
    if (!databaseConfigured()) return res.status(503).json({ error:'Base de datos no configurada.', code:'DATABASE_NOT_CONFIGURED' });
    const id = String(req.query?.id || '').trim();
    if (!id) return res.status(400).json({ error:'Falta ID de auditoría.' });
    const audit = await getAuditRecord(id, { includeResult:req.query?.result === '1' });
    if (!audit) return res.status(404).json({ error:'Auditoría no encontrada.' });
    return res.status(200).json({ audit });
  } catch (error) {
    console.error('[audit-record]', error);
    return res.status(400).json({ error:error?.message || 'No se pudo recuperar la auditoría.' });
  }
}
