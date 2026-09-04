import { inspectSiteIdentity } from '../lib/audit/site-identity.js';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido.' });
  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    if (!body.url) return res.status(400).json({ error: 'Debes indicar una URL.' });
    const identity = await inspectSiteIdentity(body.url);
    return res.status(200).json(identity);
  } catch (error) {
    return res.status(400).json({ error: error?.message || 'No se pudo obtener la identidad visual del sitio.' });
  }
}
