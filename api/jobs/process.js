import { getLargeAuditJobStatus, processLargeAuditJob } from '../../lib/jobs/large-audit.js';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido.' });
  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    if (!body.id) throw new Error('Falta el ID del job.');
    const job = await processLargeAuditJob(body.id);
    return res.status(200).json({ job });
  } catch (error) {
    console.error('[jobs/process]', error);
    const job = error?.job || (req?.body?.id ? await getLargeAuditJobStatus(req.body.id).catch(()=>null) : null);
    return res.status(error?.retryable ? 503 : 400).json({ error: error?.message || 'No se pudo procesar el lote.', retryable:Boolean(error?.retryable), job });
  }
}
