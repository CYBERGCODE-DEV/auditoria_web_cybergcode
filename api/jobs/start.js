import { createLargeAuditJob } from '../../lib/jobs/large-audit.js';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido.' });
  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const job = await createLargeAuditJob({
      url: body.url,
      maxPages: body.maxPages,
      auditMode: body.auditMode || 'complete',
      modules: body.modules || {},
      devices: body.devices || {},
      pageSpeed: body.pageSpeed !== false,
      stableMode: body.stableMode !== false,
      aiReview: body.aiReview === true
    });
    return res.status(202).json({ job });
  } catch (error) {
    console.error('[jobs/start]', error);
    return res.status(400).json({ error: error?.message || 'No se pudo iniciar el job.' });
  }
}
