import { createLargeAuditJob } from '../../lib/jobs/large-audit-create.js';
import { getLargeAuditJobStatus } from '../../lib/jobs/large-audit-state.js';
import { enqueueLargeAuditStep } from '../../lib/jobs/queue-orchestrator.js';
import { requireAuditAccess } from '../../lib/security/api-access.js';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido.' });
  if (!requireAuditAccess(req, res, { scope:'large-audit', cost:10 })) return;
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
    const orchestration = await enqueueLargeAuditStep(job.id, 'process');
    const current = await getLargeAuditJobStatus(job.id);
    return res.status(202).json({ job: current || job, accessToken:job.accessToken, orchestration });
  } catch (error) {
    console.error('[jobs/start]', error);
    return res.status(400).json({ error: error?.message || 'No se pudo iniciar el job.' });
  }
}
