import { buildAuditPdf } from '../lib/report/pdf.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido.' });
  try {
    const audit = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body;
    if (!audit?.meta?.id || !Array.isArray(audit?.findings)) return res.status(400).json({ error: 'Informe de auditoría inválido.' });
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
