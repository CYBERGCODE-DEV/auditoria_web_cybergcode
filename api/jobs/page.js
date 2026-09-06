import { getJob, getJobChunk } from '../../lib/jobs/job-store.js';
import { assertLargeAuditJobAccess } from '../../lib/jobs/large-audit.js';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET') return res.status(405).json({ error: 'Método no permitido.' });
  try {
    const id = String(req.query?.id || '');
    const url = String(req.query?.url || '');
    if (!id || !url) throw new Error('Faltan id o url.');
    await assertLargeAuditJobAccess(id, req.headers?.['x-cybergcode-job-token']);
    const job = await getJob(id);
    if (!job) return res.status(404).json({ error: 'Job no encontrado o expirado.' });
    for (let i = 0; i < Number(job.chunkCount || 0); i += 1) {
      const chunk = await getJobChunk(id, i);
      const page = Array.isArray(chunk) ? chunk.find((item) => item.url === url) : null;
      if (page) return res.status(200).json({ page: { ...page, findings: undefined }, chunk: i });
    }
    return res.status(404).json({ error: 'La URL no está almacenada en los lotes del job.' });
  } catch (error) {
    return res.status(error?.code === 'JOB_ACCESS_DENIED' ? 403 : 400).json({ error: error?.message || 'No se pudo obtener el detalle.' });
  }
}
