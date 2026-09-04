import { CATEGORY_WEIGHTS } from '../config/rules.js';

const ALL_CATEGORIES = Object.keys(CATEGORY_WEIGHTS);

export function scoreAudit(findings) {
  const scores = Object.fromEntries(ALL_CATEGORIES.map((c) => [c, 100]));
  for (const finding of findings) {
    if (scores[finding.category] === undefined) continue;
    scores[finding.category] = Math.max(0, scores[finding.category] - (finding.penalty || 0));
  }

  // Módulos no implementados aún se marcan null para no fingir una medición.
  for (const notMeasured of ['performance', 'content', 'accessibility', 'ux', 'compliance']) scores[notMeasured] = null;

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
    methodology: 'CYBERGCODE v0.1 — ponderación provisional solo sobre módulos efectivamente medidos.'
  };
}
