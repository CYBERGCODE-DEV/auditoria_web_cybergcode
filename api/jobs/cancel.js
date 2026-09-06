import { assertLargeAuditJobAccess, cancelLargeAuditJob } from '../../lib/jobs/large-audit-state.js';
import { withApiObservability } from '../../lib/observability/api.js';
import { requireJobRateLimit } from '../../lib/security/api-access.js';

async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido.' });
  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    if (!body.id) throw new Error('Falta el ID del job.');
    if (!await requireJobRateLimit(req, res, body.id, { scope:'jobs/cancel', cost:2 })) return;
    await assertLargeAuditJobAccess(body.id, req.headers?.['x-cybergcode-job-token'],req.cybergcodeUser);
    const job = await cancelLargeAuditJob(body.id);
    return res.status(200).json({ job });
  } catch (error) {
    console.error('[jobs/cancel]', error);
    return res.status(error?.code === 'JOB_ACCESS_DENIED' ? 403 : 400).json({ error: error?.message || 'No se pudo cancelar el job.' });
  }
}

export default withApiObservability('jobs/cancel', handler);
