import { finalizeLargeAuditJob } from '../../lib/jobs/large-audit.js';
import { assertLargeAuditJobAccess, getLargeAuditJobStatus } from '../../lib/jobs/large-audit-state.js';
import { withApiObservability } from '../../lib/observability/api.js';
import { requireJobRateLimit } from '../../lib/security/api-access.js';

async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido.' });
  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    if (!body.id) throw new Error('Falta el ID del job.');
    if (!await requireJobRateLimit(req, res, body.id, { scope:'jobs/finalize', cost:10 })) return;
    await assertLargeAuditJobAccess(body.id, req.headers?.['x-cybergcode-job-token'],req.cybergcodeUser);
    const payload = await finalizeLargeAuditJob(body.id,req.cybergcodeUser);
    return res.status(200).json(payload);
  } catch (error) {
    console.error('[jobs/finalize]', error);
    const id = typeof req.body === 'string' ? null : req.body?.id;
    const job = error?.job || (id ? await getLargeAuditJobStatus(id).catch(()=>null) : null);
    return res.status(error?.code === 'JOB_ACCESS_DENIED' ? 403 : (error?.retryable ? 503 : 400)).json({ error: error?.message || 'No se pudo consolidar la auditoría.', retryable:Boolean(error?.retryable), job });
  }
}

export default withApiObservability('jobs/finalize', handler);
