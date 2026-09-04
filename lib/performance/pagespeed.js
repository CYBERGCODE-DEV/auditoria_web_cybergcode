import { RULES } from '../config/rules.js';
import { createFinding } from '../audit/finding.js';

const API = 'https://www.googleapis.com/pagespeedonline/v5/runPagespeed';

const toScore = (value) => Number.isFinite(value) ? Math.round(value * 100) : null;
const numeric = (audit) => Number.isFinite(audit?.numericValue) ? audit.numericValue : null;

function pickMetrics(json) {
  const lr = json?.lighthouseResult || {};
  const audits = lr.audits || {};
  return {
    lighthouseVersion: lr.lighthouseVersion || null,
    fetchTime: lr.fetchTime || null,
    categories: {
      performance: toScore(lr.categories?.performance?.score),
      accessibility: toScore(lr.categories?.accessibility?.score),
      bestPractices: toScore(lr.categories?.['best-practices']?.score),
      seo: toScore(lr.categories?.seo?.score)
    },
    metrics: {
      fcpMs: numeric(audits['first-contentful-paint']),
      lcpMs: numeric(audits['largest-contentful-paint']),
      cls: numeric(audits['cumulative-layout-shift']),
      tbtMs: numeric(audits['total-blocking-time']),
      speedIndexMs: numeric(audits['speed-index']),
      ttfbMs: numeric(audits['server-response-time'])
    },
    diagnostics: {
      requests: audits['network-requests']?.details?.items?.length ?? null,
      totalByteWeight: numeric(audits['total-byte-weight']),
      domSize: audits['dom-size']?.details?.items?.[0]?.value ?? null
    },
    field: json.loadingExperience || null,
    originField: json.originLoadingExperience || null,
    warnings: lr.runWarnings || []
  };
}

async function fetchStrategy(target, strategy, timeoutMs = 90000) {
  const url = new URL(API);
  url.searchParams.set('url', target);
  url.searchParams.set('strategy', strategy);
  url.searchParams.set('locale', 'es');
  for (const category of ['performance','accessibility','best-practices','seo']) url.searchParams.append('category', category);
  if (process.env.PAGESPEED_API_KEY) url.searchParams.set('key', process.env.PAGESPEED_API_KEY);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { signal: controller.signal, headers: { accept: 'application/json' } });
    if (!response.ok) throw new Error(`PageSpeed ${strategy}: HTTP ${response.status}`);
    return pickMetrics(await response.json());
  } finally {
    clearTimeout(timer);
  }
}

function buildFindings(target, mobile) {
  if (!mobile) return [];
  const findings = [];
  const m = mobile.metrics || {};
  if (m.lcpMs != null && m.lcpMs > 2500) findings.push(createFinding({
    rule: RULES.performance.lcp,
    category: 'performance', title: 'LCP móvil por encima del umbral bueno', url: target,
    evidence: `Largest Contentful Paint: ${(m.lcpMs/1000).toFixed(2)} s.`, expected: '≤ 2.5 s para una experiencia buena.',
    impact: 'El contenido principal tarda demasiado en mostrarse en la prueba de laboratorio.', recommendation: 'Optimizar el recurso LCP, imágenes, CSS crítico, servidor y recursos bloqueantes.',
    source: 'PageSpeed Insights / Lighthouse lab'
  }));
  if (m.cls != null && m.cls > 0.1) findings.push(createFinding({
    rule: RULES.performance.cls,
    category: 'performance', title: 'CLS móvil por encima del umbral bueno', url: target,
    evidence: `Cumulative Layout Shift: ${m.cls.toFixed(3)}.`, expected: '≤ 0.1.', impact: 'Cambios inesperados de layout pueden perjudicar la estabilidad visual.',
    recommendation: 'Reservar espacio para imágenes/iframes, estabilizar fuentes y evitar insertar contenido por encima de contenido existente.', source: 'PageSpeed Insights / Lighthouse lab'
  }));
  if (m.tbtMs != null && m.tbtMs > 200) findings.push(createFinding({
    rule: RULES.performance.tbt,
    category: 'performance', title: 'Total Blocking Time elevado en móvil', url: target,
    evidence: `TBT: ${Math.round(m.tbtMs)} ms.`, impact: 'Un hilo principal bloqueado reduce la capacidad de respuesta durante la carga.',
    recommendation: 'Reducir JavaScript, dividir tareas largas y posponer scripts no esenciales.', source: 'PageSpeed Insights / Lighthouse lab'
  }));
  return findings;
}

export async function runPageSpeedAudit(target, enabled = true) {
  if (!enabled) return { status: 'disabled', mobile: null, desktop: null, findings: [], error: null };
  try {
    const [mobile, desktop] = await Promise.all([fetchStrategy(target, 'mobile'), fetchStrategy(target, 'desktop')]);
    return { status: 'measured', mobile, desktop, findings: buildFindings(target, mobile), error: null };
  } catch (error) {
    return { status: 'unavailable', mobile: null, desktop: null, findings: [], error: String(error?.message || error) };
  }
}
