import { createFinding } from '../audit/finding.js';
import { RULES } from '../config/rules.js';

function scoreThreshold(value, good, needsImprovement, higherIsBetter = false) {
  if (!Number.isFinite(value)) return null;
  if (higherIsBetter) {
    if (value >= good) return 100;
    if (value >= needsImprovement) return 75;
    return 45;
  }
  if (value <= good) return 100;
  if (value <= needsImprovement) return 75;
  return 45;
}

export function computeBrowserLabScore(performance = {}) {
  const parts = [
    scoreThreshold(performance.lcpMs, 2500, 4000),
    scoreThreshold(performance.cls, 0.1, 0.25),
    scoreThreshold(performance.fcpMs, 1800, 3000),
    scoreThreshold(performance.ttfbMs, 800, 1800),
    scoreThreshold(performance.longTaskTotalMs, 200, 600)
  ].filter(Number.isFinite);
  if (parts.length < 3) return null;
  return Math.round(parts.reduce((sum, value) => sum + value, 0) / parts.length);
}

export function buildBrowserLabFindings(target, performance = {}) {
  const findings = [];
  if (Number.isFinite(performance.lcpMs) && performance.lcpMs > 2500) findings.push(createFinding({
    rule: RULES.performance.lcp,
    category: 'performance', title: 'LCP elevado en laboratorio Chromium', url: target,
    evidence: `LCP observado en Chromium: ${(performance.lcpMs / 1000).toFixed(2)} s.`,
    expected: '≤ 2.5 s como referencia de buena experiencia.',
    impact: 'El elemento principal visible tarda más de lo deseable en renderizarse.',
    recommendation: 'Identificar el elemento LCP y optimizar servidor, prioridad del recurso, imagen/fuente asociada y recursos bloqueantes.',
    source: 'Chromium PerformanceObserver / lab', confidence: 0.92
  }));
  if (Number.isFinite(performance.cls) && performance.cls > 0.1) findings.push(createFinding({
    rule: RULES.performance.cls,
    category: 'performance', title: 'CLS elevado en laboratorio Chromium', url: target,
    evidence: `CLS observado en Chromium: ${performance.cls.toFixed(3)}.`, expected: '≤ 0.1.',
    impact: 'La página presenta cambios de posición inesperados durante la carga.',
    recommendation: 'Reservar dimensiones, estabilizar fuentes y evitar insertar contenido por encima de elementos ya renderizados.',
    source: 'Chromium PerformanceObserver / lab', confidence: 0.92
  }));
  if (Number.isFinite(performance.longTaskTotalMs) && performance.longTaskTotalMs > 200) findings.push(createFinding({
    rule: RULES.performance.longTasks,
    category: 'performance', title: 'Trabajo prolongado en el hilo principal', url: target,
    evidence: `${performance.longTaskCount || 0} long task(s), ${Math.round(performance.longTaskTotalMs)} ms acumulados.`,
    impact: 'Tareas largas pueden bloquear interacción y retrasar el renderizado.',
    recommendation: 'Dividir tareas largas, reducir JavaScript inicial y posponer trabajo no esencial.',
    source: 'Chromium PerformanceObserver / longtask', confidence: 0.9
  }));
  if (Number.isFinite(performance.ttfbMs) && performance.ttfbMs > 1800) findings.push(createFinding({
    rule: RULES.performance.ttfb,
    category: 'performance', title: 'TTFB elevado en laboratorio Chromium', url: target,
    evidence: `TTFB observado: ${Math.round(performance.ttfbMs)} ms.`,
    impact: 'La respuesta inicial del servidor retrasa todo el pipeline de carga.',
    recommendation: 'Revisar caché, backend, consultas, CDN y proximidad del servidor al usuario objetivo.',
    source: 'Chromium Navigation Timing / lab', confidence: 0.9
  }));
  return findings;
}
