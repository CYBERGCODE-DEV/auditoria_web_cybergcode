import { buildAuditPdf } from '../lib/report/pdf.js';
import { requireAuditAccess } from '../lib/security/api-access.js';
import { verifyReportAuthorization } from '../lib/report/integrity.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido.' });
  if (!requireAuditAccess(req, res, { scope:'report', cost:2 })) return;
  try {
    const audit = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body;
    if (!audit?.meta?.id || !Array.isArray(audit?.findings)) return res.status(400).json({ error: 'Informe de auditoría inválido.' });
    const authorization = verifyReportAuthorization(audit);
    if (!authorization.ok) return res.status(authorization.code === 'REPORT_SIGNING_NOT_CONFIGURED' ? 503 : 403).json({ error:authorization.message, code:authorization.code });
    const pdf = await buildAuditPdf(audit);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${audit.meta.id}.pdf"`);
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).send(pdf);
  } catch (error) {
    console.error('[report]', error);
    return res.status(500).json({ error: 'No se pudo generar el PDF.' });
  }
}
