import { createFinding } from '../audit/finding.js';
import { RULES } from '../config/rules.js';
const CURRENT_ENDPOINT = 'https://chromeuxreport.googleapis.com/v1/records:queryRecord';
const HISTORY_ENDPOINT = 'https://chromeuxreport.googleapis.com/v1/records:queryHistoryRecord';

const METRICS = [
  'largest_contentful_paint',
  'interaction_to_next_paint',
  'cumulative_layout_shift',
  'first_contentful_paint',
  'experimental_time_to_first_byte'
];

function key() {
  return process.env.CRUX_API_KEY || process.env.PAGESPEED_API_KEY || '';
}

function normalizeMetric(metric) {
  if (!metric) return null;
  const p75 = metric.percentiles?.p75;
  return {
    p75: Number.isFinite(p75) ? p75 : null,
    histogram: Array.isArray(metric.histogram) ? metric.histogram.map((bucket) => ({
      start: Number.isFinite(bucket.start) ? bucket.start : null,
      end: Number.isFinite(bucket.end) ? bucket.end : null,
      density: Number.isFinite(bucket.density) ? bucket.density : null
    })) : []
  };
}

function normalizeRecord(json, scope, formFactor) {
  const record = json?.record;
  if (!record) return null;
  const metrics = record.metrics || {};
  return {
    scope,
    formFactor,
    key: record.key || null,
    collectionPeriod: record.collectionPeriod || null,
    metrics: {
      lcp: normalizeMetric(metrics.largest_contentful_paint),
      inp: normalizeMetric(metrics.interaction_to_next_paint),
      cls: normalizeMetric(metrics.cumulative_layout_shift),
      fcp: normalizeMetric(metrics.first_contentful_paint),
      ttfb: normalizeMetric(metrics.experimental_time_to_first_byte)
    }
  };
}

function normalizeHistoryMetric(metric) {
  if (!metric) return null;
  return {
    p75s: Array.isArray(metric.percentilesTimeseries?.p75s) ? metric.percentilesTimeseries.p75s.map((value) => Number.isFinite(value) ? value : null) : [],
    histogramTimeseries: Array.isArray(metric.histogramTimeseries) ? metric.histogramTimeseries : []
  };
}

function normalizeHistory(json, scope, formFactor) {
  const record = json?.record;
  if (!record) return null;
  const metrics = record.metrics || {};
  return {
    scope,
    formFactor,
    key: record.key || null,
    collectionPeriods: Array.isArray(record.collectionPeriods) ? record.collectionPeriods : [],
    metrics: {
      lcp: normalizeHistoryMetric(metrics.largest_contentful_paint),
      inp: normalizeHistoryMetric(metrics.interaction_to_next_paint),
      cls: normalizeHistoryMetric(metrics.cumulative_layout_shift),
      fcp: normalizeHistoryMetric(metrics.first_contentful_paint),
      ttfb: normalizeHistoryMetric(metrics.experimental_time_to_first_byte)
    }
  };
}

async function query(endpoint, body, timeoutMs = 15000) {
  const apiKey = key();
  if (!apiKey) throw Object.assign(new Error('CrUX API key no configurada.'), { code: 'disabled' });
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`${endpoint}?key=${encodeURIComponent(apiKey)}`, {
      method: 'POST',
      signal: controller.signal,
      headers: { 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify(body)
    });
    const text = await response.text();
    let json = null;
    try { json = text ? JSON.parse(text) : null; } catch { /* ignore */ }
    if (!response.ok) {
      const error = new Error(`CrUX HTTP ${response.status}: ${json?.error?.message || text || 'sin detalle'}`);
      error.status = response.status;
      throw error;
    }
    return json;
  } finally {
    clearTimeout(timer);
  }
}

function originOf(target) {
  const u = new URL(target);
  return u.origin;
}

async function queryCurrentWithFallback(target, formFactor) {
  try {
    const page = await query(CURRENT_ENDPOINT, { url: target, formFactor, metrics: METRICS });
    return normalizeRecord(page, 'url', formFactor);
  } catch (error) {
    if (![400, 404].includes(error.status)) throw error;
  }
  try {
    const origin = await query(CURRENT_ENDPOINT, { origin: originOf(target), formFactor, metrics: METRICS });
    return normalizeRecord(origin, 'origin', formFactor);
  } catch (error) {
    if ([400, 404].includes(error.status)) return null;
    throw error;
  }
}

async function queryHistoryWithFallback(target, formFactor) {
  const bodyBase = { formFactor, metrics: METRICS, collectionPeriodCount: 12 };
  try {
    const page = await query(HISTORY_ENDPOINT, { ...bodyBase, url: target });
    return normalizeHistory(page, 'url', formFactor);
  } catch (error) {
    if (![400, 404].includes(error.status)) throw error;
  }
  try {
    const origin = await query(HISTORY_ENDPOINT, { ...bodyBase, origin: originOf(target) });
    return normalizeHistory(origin, 'origin', formFactor);
  } catch (error) {
    if ([400, 404].includes(error.status)) return null;
    throw error;
  }
}

function classifyError(error) {
  const message = String(error?.message || error || '');
  if (error?.code === 'disabled') return { code: 'disabled', detail: 'CrUX requiere una clave de API de Google Cloud con Chrome UX Report API habilitada.' };
  if (/HTTP 429/.test(message)) return { code: 'quota-or-rate-limit', detail: 'CrUX respondió HTTP 429; se alcanzó una cuota o límite temporal.' };
  if (/HTTP 403/.test(message)) return { code: 'forbidden', detail: 'La clave existe, pero Chrome UX Report API puede no estar habilitada o permitida.' };
  if (/abort|timeout/i.test(message)) return { code: 'timeout', detail: 'La consulta a CrUX excedió el tiempo disponible.' };
  return { code: 'unavailable', detail: message || 'CrUX no devolvió datos.' };
}

function vitalStatus(record) {
  if (!record) return null;
  const lcp = record.metrics?.lcp?.p75;
  const inp = record.metrics?.inp?.p75;
  const cls = record.metrics?.cls?.p75;
  const known = [lcp, inp, cls].filter(Number.isFinite).length;
  if (!known) return null;
  const pass = (!Number.isFinite(lcp) || lcp <= 2500) && (!Number.isFinite(inp) || inp <= 200) && (!Number.isFinite(cls) || cls <= 0.1);
  return { pass, known, lcp, inp, cls };
}

export async function runCruxAudit(target, { history = true, devices = { mobile: true, desktop: true }, enabled = true } = {}) {
  if (!enabled) return { status: 'disabled', current: { phone:null, desktop:null }, history: { phone:null, desktop:null }, availability: { code:'disabled', detail:'CrUX no fue seleccionado para esta auditoría.' } };
  if (!key()) return { status: 'disabled', current: null, history: null, availability: classifyError({ code: 'disabled' }) };
  const usePhone = devices?.mobile !== false;
  const useDesktop = devices?.desktop !== false;
  try {
    const [phone, desktop, phoneHistory, desktopHistory] = await Promise.all([
      usePhone ? queryCurrentWithFallback(target, 'PHONE') : Promise.resolve(null),
      useDesktop ? queryCurrentWithFallback(target, 'DESKTOP') : Promise.resolve(null),
      history && usePhone ? queryHistoryWithFallback(target, 'PHONE') : Promise.resolve(null),
      history && useDesktop ? queryHistoryWithFallback(target, 'DESKTOP') : Promise.resolve(null)
    ]);
    const measured = Boolean(phone || desktop);
    return {
      status: measured ? 'measured' : 'no-data',
      current: { phone, desktop },
      history: { phone: phoneHistory, desktop: desktopHistory },
      selectedDevices: { mobile: usePhone, desktop: useDesktop },
      coreWebVitals: { phone: vitalStatus(phone), desktop: vitalStatus(desktop) },
      availability: measured ? null : { code: 'no-data', detail: 'CrUX no dispone de una muestra pública suficiente para esta URL/origen y dispositivos seleccionados.' }
    };
  } catch (error) {
    return { status: 'unavailable', current: null, history: null, selectedDevices: { mobile: usePhone, desktop: useDesktop }, availability: classifyError(error), error: String(error?.message || error) };
  }
}

export function buildCruxFindings(target, crux) {
  if (crux?.status !== 'measured') return [];
  const findings = [];
  for (const [device, record] of Object.entries(crux.current || {})) {
    if (!record) continue;
    const label = device === 'phone' ? 'móvil' : 'escritorio';
    const scope = record.scope === 'url' ? 'URL' : 'origen';
    const lcp = record.metrics?.lcp?.p75;
    const inp = record.metrics?.inp?.p75;
    const cls = record.metrics?.cls?.p75;
    if (Number.isFinite(lcp) && lcp > 2500) findings.push(createFinding({
      rule: RULES.performance.lcp, category:'performance', title:`LCP de campo elevado en ${label}`, url:target,
      evidence:`CrUX p75 (${scope}, ${label}): ${Math.round(lcp)} ms.`, expected:'≤ 2500 ms en p75.',
      impact:'Usuarios reales experimentan una carga del contenido principal por encima del umbral bueno.',
      recommendation:'Priorizar optimizaciones del elemento LCP, TTFB, carga de imagen/fuente y recursos críticos.', source:'Chrome UX Report API · datos reales agregados', confidence:0.99
    }));
    if (Number.isFinite(inp) && inp > 200) findings.push(createFinding({
      rule: RULES.performance.inp, category:'performance', title:`INP de campo elevado en ${label}`, url:target,
      evidence:`CrUX p75 (${scope}, ${label}): ${Math.round(inp)} ms.`, expected:'≤ 200 ms en p75.',
      impact:'Usuarios reales pueden percibir una respuesta lenta tras sus interacciones.',
      recommendation:'Reducir trabajo del hilo principal, tareas largas y JavaScript ejecutado durante interacciones.', source:'Chrome UX Report API · datos reales agregados', confidence:0.99
    }));
    if (Number.isFinite(cls) && cls > 0.1) findings.push(createFinding({
      rule: RULES.performance.cls, category:'performance', title:`CLS de campo elevado en ${label}`, url:target,
      evidence:`CrUX p75 (${scope}, ${label}): ${cls.toFixed(3)}.`, expected:'≤ 0.1 en p75.',
      impact:'Usuarios reales experimentan inestabilidad visual durante la navegación.',
      recommendation:'Reservar espacio para recursos, estabilizar fuentes e impedir inserciones tardías que desplacen contenido.', source:'Chrome UX Report API · datos reales agregados', confidence:0.99
    }));
  }
  return findings;
}
