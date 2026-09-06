import crypto from 'node:crypto';
import { inspectSiteIdentity } from '../lib/audit/site-identity.js';
import { runAudit } from '../lib/audit/engine.js';
import { requireAuditAccess, requireScopedRateLimit } from '../lib/security/api-access.js';
import { withApiObservability } from '../lib/observability/api.js';

function clientIdentity(req) {
  const ip = String(req.headers?.['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown').split(',')[0].trim();
  const agent = String(req.headers?.['user-agent'] || '').slice(0,300);
  return crypto.createHash('sha256').update(`${ip}:${agent}`).digest('hex').slice(0,32);
}

function publicDemoResult(audit) {
  const findings = [...(audit?.findings || [])]
    .sort((a,b)=>({critical:4,high:3,medium:2,low:1}[b.severity]||0)-({critical:4,high:3,medium:2,low:1}[a.severity]||0))
    .slice(0,3)
    .map((finding)=>({ ruleId:finding.ruleId, title:finding.title, category:finding.category, severity:finding.severity, recommendation:finding.recommendation || finding.remediation?.summary || '' }));
  return {
    demo:true,
    expiresInMinutes:30,
    target:audit?.meta?.target || null,
    hostname:(()=>{ try { return new URL(audit?.meta?.target).hostname; } catch { return ''; } })(),
    completedAt:audit?.meta?.finishedAt || new Date().toISOString(),
    score:Number.isFinite(audit?.scores?.global) ? audit.scores.global : null,
    categories:audit?.scores?.categories || {},
    summary:{
      pagesCrawled:audit?.summary?.pagesCrawled || 1,
      findingsTotal:audit?.summary?.findingsTotal ?? audit?.findings?.length ?? 0,
      critical:audit?.summary?.critical ?? audit?.findings?.filter((item)=>item.severity==='critical').length ?? 0,
      high:audit?.summary?.high ?? audit?.findings?.filter((item)=>item.severity==='high').length ?? 0
    },
    findings,
    lockedSections:[
      'Evidencia técnica completa','Todas las páginas','Rendimiento y Core Web Vitals','Accesibilidad detallada',
      'Tecnologías y composición','Dominio y alojamiento','Historial y comparaciones','Informe profesional PDF'
    ],
    disclosure:'Resumen limitado obtenido de una auditoría real. Los módulos bloqueados no se ejecutan o no se entregan en la demostración.'
  };
}

async function handlePublicDemo(req,res) {
  const limit = Math.min(Math.max(Number(process.env.CYBERGCODE_DEMO_RATE_LIMIT)||5,1),20);
  if (!await requireScopedRateLimit(res,{ scope:'public-demo', identity:clientIdentity(req), cost:1, limit })) return;
  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
  if (!body.url) return res.status(400).json({ error:'Escribe un dominio o una URL pública.' });
  const audit = await runAudit({ url:body.url, maxPages:1, pageSpeed:false, stableMode:true, aiReview:false, auditMode:'quick', devices:{ mobile:true, desktop:false } });
  return res.status(200).json(publicDemoResult(audit));
}

async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido.' });
  if (req.query?.mode === 'demo') {
    try { return await handlePublicDemo(req,res); }
    catch (error) {
      console.error('[demo]',error);
      return res.status(400).json({ error:error?.message || 'No se pudo completar la demostración.' });
    }
  }
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
