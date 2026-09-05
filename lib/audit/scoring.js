import { CATEGORY_WEIGHTS } from '../config/rules.js';

const ALL_CATEGORIES = Object.keys(CATEGORY_WEIGHTS);
const RULE_CAP = { critical: 36, high: 24, medium: 15, low: 10, info: 0 };

export function scoreAudit(findings, measured = {}) {
  const scores = Object.fromEntries(ALL_CATEGORIES.map((c) => [c, 100]));
  const deductionByRule = new Map();

  for (const finding of findings) {
    if (scores[finding.category] === undefined) continue;
    const key = `${finding.category}:${finding.ruleId}`;
    const cap = RULE_CAP[finding.severity] ?? 10;
    const used = deductionByRule.get(key) || 0;
    const next = Math.min(cap, used + (finding.penalty || 0));
    deductionByRule.set(key, next);
  }

  for (const [key, deduction] of deductionByRule.entries()) {
    const category = key.split(':', 1)[0];
    scores[category] = Math.max(0, scores[category] - deduction);
  }

  for (const [category, value] of Object.entries(measured)) {
    if (scores[category] !== undefined && Number.isFinite(value)) scores[category] = Math.min(scores[category], Math.max(0, Math.min(100, Math.round(value))));
  }

  const notMeasured = new Set();
  if (measured.enabledCategories && typeof measured.enabledCategories === 'object') {
    for (const category of ALL_CATEGORIES) if (measured.enabledCategories[category] === false) notMeasured.add(category);
  }
  if (!measured.uxMeasured && !Number.isFinite(measured.ux)) notMeasured.add('ux');
  if (!measured.contentMeasured) notMeasured.add('content');
  if (!measured.complianceMeasured && !Number.isFinite(measured.compliance)) notMeasured.add('compliance');
  if (!Number.isFinite(measured.performance)) notMeasured.add('performance');
  if (!measured.accessibilityMeasured && !Number.isFinite(measured.accessibility)) notMeasured.add('accessibility');
  for (const category of notMeasured) scores[category] = null;

  let weighted = 0;
  let weightSum = 0;
  for (const [category, weight] of Object.entries(CATEGORY_WEIGHTS)) {
    if (scores[category] === null) continue;
    weighted += scores[category] * weight;
    weightSum += weight;
  }

  return {
    global: weightSum ? Math.round(weighted / weightSum) : null,
    categories: scores,
    methodology: 'CYBERGCODE v0.13.2 — módulos medidos únicamente; ISO/Cumplimiento representa alineamiento observable y no certificación; deducciones repetidas tienen límite por regla; las métricas externas actúan como techo de la categoría para que hallazgos objetivos propios no queden ocultos por una puntuación agregada.'
  };
}
