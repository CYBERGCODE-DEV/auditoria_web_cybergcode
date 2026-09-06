import { assertLargeAuditJobAccess, getLargeAuditResult } from '../../lib/jobs/large-audit-state.js';
import { withApiObservability } from '../../lib/observability/api.js';
import { requireJobRateLimit } from '../../lib/security/api-access.js';

async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET') return res.status(405).json({ error: 'Método no permitido.' });
  try {
    const id = String(req.query?.id || '');
    if (!id) throw new Error('Falta el ID del job.');
    await assertLargeAuditJobAccess(id, req.headers?.['x-cybergcode-job-token']);
    if (!await requireJobRateLimit(req, res, id, { scope:'jobs/result', cost:2 })) return;
    const payload = await getLargeAuditResult(id);
    return res.status(200).json(payload);
  } catch (error) {
    return res.status(error?.code === 'JOB_ACCESS_DENIED' ? 403 : 400).json({ error: error?.message || 'No se pudo recuperar el resultado.' });
  }
}

export default withApiObservability('jobs/result', handler);
