import { inspectSiteIdentity } from '../lib/audit/site-identity.js';
import { requireAuditAccess } from '../lib/security/api-access.js';
import { withApiObservability } from '../lib/observability/api.js';

async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido.' });
  if (!await requireAuditAccess(req, res, { scope:'identity', cost:1 })) return;
  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    if (!body.url) return res.status(400).json({ error: 'Debes indicar una URL.' });
    const identity = await inspectSiteIdentity(body.url);
    return res.status(200).json(identity);
  } catch (error) {
    return res.status(400).json({ error: error?.message || 'No se pudo obtener la identidad visual del sitio.' });
  }
}

export default withApiObservability('identity', handler);
