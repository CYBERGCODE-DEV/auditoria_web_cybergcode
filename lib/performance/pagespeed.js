import { RULES } from '../config/rules.js';
import { createFinding } from '../audit/finding.js';

const API = 'https://www.googleapis.com/pagespeedonline/v5/runPagespeed';
export const STABLE_PAGESPEED_SAMPLES = 3;

const toScore = (value) => Number.isFinite(value) ? Math.round(value * 100) : null;
const numeric = (audit) => Number.isFinite(audit?.numericValue) ? audit.numericValue : null;
const finite = (items) => items.filter(Number.isFinite).sort((a, b) => a - b);

export function median(values) {
  const list = finite(values);
  if (!list.length) return null;
  const middle = Math.floor(list.length / 2);
  return list.length % 2 ? list[middle] : (list[middle - 1] + list[middle]) / 2;
}

function spread(values) {
  const list = finite(values);
  if (!list.length) return null;
  return { min: list[0], max: list[list.length - 1], range: list[list.length - 1] - list[0] };
}

function pickMetrics(json) {
  const lr = json?.lighthouseResult || {};
  const audits = lr.audits || {};
  return {
    lighthouseVersion: lr.lighthouseVersion || null,
    fetchTime: lr.fetchTime || null,
    environment: {
      benchmarkIndex: Number.isFinite(lr.environment?.benchmarkIndex) ? lr.environment.benchmarkIndex : null,
      hostUserAgent: lr.environment?.hostUserAgent || null,
      emulatedFormFactor: lr.configSettings?.emulatedFormFactor || null,
      throttlingMethod: lr.configSettings?.throttlingMethod || null
    },
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

export function aggregateSamples(samples) {
  const valid = samples.filter(Boolean);
  if (!valid.length) return null;
  const categoryKeys = ['performance', 'accessibility', 'bestPractices', 'seo'];
  const metricKeys = ['fcpMs', 'lcpMs', 'cls', 'tbtMs', 'speedIndexMs', 'ttfbMs'];
  const diagnosticKeys = ['requests', 'totalByteWeight', 'domSize'];
  const base = valid[0];
  const categories = Object.fromEntries(categoryKeys.map((key) => [key, median(valid.map((s) => s.categories?.[key]))]));
  const metrics = Object.fromEntries(metricKeys.map((key) => [key, median(valid.map((s) => s.metrics?.[key]))]));
  const diagnostics = Object.fromEntries(diagnosticKeys.map((key) => [key, median(valid.map((s) => s.diagnostics?.[key]))]));
  return {
    ...base,
    categories,
    metrics,
    diagnostics,
    aggregation: valid.length > 1 ? 'median' : 'single-run',
    sampleCount: valid.length,
    samples: valid.map((sample, index) => ({
      index: index + 1,
      fetchTime: sample.fetchTime,
      performance: sample.categories?.performance ?? null,
      lcpMs: sample.metrics?.lcpMs ?? null,
      cls: sample.metrics?.cls ?? null,
      tbtMs: sample.metrics?.tbtMs ?? null,
      benchmarkIndex: sample.environment?.benchmarkIndex ?? null
    })),
    variability: {
      performance: spread(valid.map((s) => s.categories?.performance)),
      lcpMs: spread(valid.map((s) => s.metrics?.lcpMs)),
      cls: spread(valid.map((s) => s.metrics?.cls)),
      tbtMs: spread(valid.map((s) => s.metrics?.tbtMs))
    },
    warnings: [...new Set(valid.flatMap((s) => s.warnings || []))]
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

async function fetchStrategySamples(target, strategy, sampleCount) {
  const settled = await Promise.allSettled(Array.from({ length: sampleCount }, () => fetchStrategy(target, strategy)));
  const values = settled.filter((item) => item.status === 'fulfilled').map((item) => item.value);
  if (!values.length) {
    const reason = settled.find((item) => item.status === 'rejected')?.reason;
    throw reason || new Error(`PageSpeed ${strategy}: sin muestras válidas.`);
  }
  return aggregateSamples(values);
}

function buildFindings(target, mobile) {
  if (!mobile) return [];
  const findings = [];
  const m = mobile.metrics || {};
  const stabilitySuffix = mobile.sampleCount > 1 ? ` Mediana de ${mobile.sampleCount} muestras.` : '';
  if (m.lcpMs != null && m.lcpMs > 2500) findings.push(createFinding({
    rule: RULES.performance.lcp,
    category: 'performance', title: 'LCP móvil por encima del umbral bueno', url: target,
    evidence: `Largest Contentful Paint: ${(m.lcpMs/1000).toFixed(2)} s.${stabilitySuffix}`, expected: '≤ 2.5 s para una experiencia buena.',
    impact: 'El contenido principal tarda demasiado en mostrarse en la prueba de laboratorio.', recommendation: 'Optimizar el recurso LCP, imágenes, CSS crítico, servidor y recursos bloqueantes.',
    source: 'PageSpeed Insights / Lighthouse lab'
  }));
  if (m.cls != null && m.cls > 0.1) findings.push(createFinding({
    rule: RULES.performance.cls,
    category: 'performance', title: 'CLS móvil por encima del umbral bueno', url: target,
    evidence: `Cumulative Layout Shift: ${m.cls.toFixed(3)}.${stabilitySuffix}`, expected: '≤ 0.1.', impact: 'Cambios inesperados de layout pueden perjudicar la estabilidad visual.',
    recommendation: 'Reservar espacio para imágenes/iframes, estabilizar fuentes y evitar insertar contenido por encima de contenido existente.', source: 'PageSpeed Insights / Lighthouse lab'
  }));
  if (m.tbtMs != null && m.tbtMs > 200) findings.push(createFinding({
    rule: RULES.performance.tbt,
    category: 'performance', title: 'Total Blocking Time elevado en móvil', url: target,
    evidence: `TBT: ${Math.round(m.tbtMs)} ms.${stabilitySuffix}`, impact: 'Un hilo principal bloqueado reduce la capacidad de respuesta durante la carga.',
    recommendation: 'Reducir JavaScript, dividir tareas largas y posponer scripts no esenciales.', source: 'PageSpeed Insights / Lighthouse lab'
  }));
  return findings;
}

export async function runPageSpeedAudit(target, enabled = true, { stableMode = true } = {}) {
  if (!enabled) return { status: 'disabled', mobile: null, desktop: null, findings: [], error: null, stability: null };
  const sampleCount = stableMode ? STABLE_PAGESPEED_SAMPLES : 1;
  try {
    const [mobile, desktop] = await Promise.all([
      fetchStrategySamples(target, 'mobile', sampleCount),
      fetchStrategySamples(target, 'desktop', sampleCount)
    ]);
    return {
      status: 'measured', mobile, desktop, findings: buildFindings(target, mobile), error: null,
      stability: { mode: stableMode ? 'stable' : 'live', requestedSamples: sampleCount, mobileSamples: mobile?.sampleCount || 0, desktopSamples: desktop?.sampleCount || 0 }
    };
  } catch (error) {
    return { status: 'unavailable', mobile: null, desktop: null, findings: [], error: String(error?.message || error), stability: { mode: stableMode ? 'stable' : 'live', requestedSamples: sampleCount } };
  }
}
