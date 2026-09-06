import { assertLargeAuditJobAccess, getLargeAuditJobStatus } from '../../lib/jobs/large-audit-state.js';
import { withApiObservability } from '../../lib/observability/api.js';
import { requireJobRateLimit } from '../../lib/security/api-access.js';

async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET') return res.status(405).json({ error: 'Método no permitido.' });
  try {
    const id = String(req.query?.id || '');
    if (!id) throw new Error('Falta el ID del job.');
    if (!await requireJobRateLimit(req, res, id, { scope:'jobs/status' })) return;
    await assertLargeAuditJobAccess(id, req.headers?.['x-cybergcode-job-token'],req.cybergcodeUser);
    const job = await getLargeAuditJobStatus(id);
    if (!job) return res.status(404).json({ error: 'Job no encontrado o expirado.' });
    return res.status(200).json({ job });
  } catch (error) {
    return res.status(error?.code === 'JOB_ACCESS_DENIED' ? 403 : 400).json({ error: error?.message || 'No se pudo consultar el job.' });
  }
}

export default withApiObservability('jobs/status', handler);
