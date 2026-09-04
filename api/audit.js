import { runAudit } from '../lib/audit/engine.js';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido.' });

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const url = body.url;
    const maxPages = Math.min(Math.max(Number(body.maxPages) || 12, 1), 50);
    const pageSpeed = body.pageSpeed !== false;
    const result = await runAudit({ url, maxPages, pageSpeed });
    return res.status(200).json(result);
  } catch (error) {
    console.error('[audit]', error);
    return res.status(400).json({ error: error?.message || 'No se pudo completar la auditoría.' });
  }
}
