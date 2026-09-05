import { runAudit } from '../lib/audit/engine.js';
import { COMPANY } from '../lib/config/company.js';
import { makeAuditCacheKey, getCachedAudit, setCachedAudit, STABLE_CACHE_TTL_SECONDS } from '../lib/cache/audit-cache.js';
import { resolveAuditConfig } from '../lib/config/audit-modes.js';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido.' });

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const url = body.url;
    const stableMode = body.stableMode !== false;
    const forceFresh = body.forceFresh === true;
    const config = resolveAuditConfig({
      auditMode: body.auditMode || 'complete',
      modules: body.modules || {},
      devices: body.devices || {},
      maxPages: body.maxPages,
      pageSpeed: body.pageSpeed !== false,
      aiReview: body.aiReview === true
    });
    if (config.maxPages > 50) {
      return res.status(409).json({ error: 'Las auditorías de más de 50 páginas deben ejecutarse mediante el modo de job por lotes.', code: 'LARGE_AUDIT_JOB_REQUIRED' });
    }

    const cacheKey = makeAuditCacheKey({
      url,
      maxPages: config.maxPages,
      pageSpeed: config.pageSpeed,
      stableMode,
      aiReview: config.aiReview,
      auditMode: config.mode,
      modules: config.modules,
      devices: config.devices,
      engineVersion: COMPANY.engineVersion
    });

    if (stableMode && !forceFresh) {
      const cached = await getCachedAudit(cacheKey);
      if (cached) {
        res.setHeader('X-CYBERGCODE-Cache', 'HIT');
        res.setHeader('X-CYBERGCODE-Stability', 'stable');
        return res.status(200).json(cached);
      }
    }

    const result = await runAudit({ url, maxPages: config.maxPages, pageSpeed: config.pageSpeed, stableMode, aiReview: config.aiReview, auditMode: config.mode, modules: config.modules, devices: config.devices });
    if (result.meta?.consistency) result.meta.consistency.fingerprint = cacheKey.split(':').pop().slice(0, 12).toUpperCase();
    let cacheState = 'BYPASS';
    if (stableMode) cacheState = (await setCachedAudit(cacheKey, result, STABLE_CACHE_TTL_SECONDS)) ? 'STORED' : 'BYPASS';
    res.setHeader('X-CYBERGCODE-Cache', cacheState);
    res.setHeader('X-CYBERGCODE-Stability', stableMode ? 'stable' : 'live');
    return res.status(200).json(result);
  } catch (error) {
    console.error('[audit]', error);
    return res.status(400).json({ error: error?.message || 'No se pudo completar la auditoría.' });
  }
}
