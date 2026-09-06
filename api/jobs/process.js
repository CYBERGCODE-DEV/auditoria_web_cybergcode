import { processLargeAuditJob } from '../../lib/jobs/large-audit-process.js';
import { assertLargeAuditJobAccess, getLargeAuditJobStatus } from '../../lib/jobs/large-audit-state.js';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido.' });
  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    if (!body.id) throw new Error('Falta el ID del job.');
    await assertLargeAuditJobAccess(body.id, req.headers?.['x-cybergcode-job-token']);
    const job = await processLargeAuditJob(body.id);
    return res.status(200).json({ job });
  } catch (error) {
    console.error('[jobs/process]', error);
    const job = error?.job || (req?.body?.id ? await getLargeAuditJobStatus(req.body.id).catch(()=>null) : null);
    return res.status(error?.code === 'JOB_ACCESS_DENIED' ? 403 : (error?.retryable ? 503 : 400)).json({ error: error?.message || 'No se pudo procesar el lote.', retryable:Boolean(error?.retryable), job });
  }
}
