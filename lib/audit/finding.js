import { getRemediation } from '../config/remediations.js';

let sequence = 0;

const clip = (value, max) => {
  if (value == null) return value;
  const text = String(value);
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
};

const clipArray = (items, maxItems = 8, maxLength = 700) => Array.isArray(items)
  ? items.slice(0, maxItems).map((item) => clip(item, maxLength))
  : [];

export function createFinding({
  rule,
  category,
  title,
  url,
  selector = null,
  evidence,
  expected = null,
  impact,
  recommendation,
  solution,
  remediationSteps,
  acceptanceCriteria,
  codeExample,
  effort,
  source,
  confidence = 1,
  automated = true,
  type
}) {
  sequence += 1;
  const remediation = getRemediation(rule.id) || {};
  const finalRecommendation = recommendation || remediation.recommendation || 'Revisar el hallazgo y aplicar una corrección acorde con la evidencia detectada.';
  const finalSolution = solution || remediation.solution || finalRecommendation;
  const finalSteps = remediationSteps || remediation.steps || [];
  const finalAcceptance = acceptanceCriteria || remediation.acceptanceCriteria || 'Repetir la auditoría y confirmar que la condición detectada ya no se reproduce.';
  const finalCode = codeExample ?? remediation.codeExample ?? null;
  const finalEffort = effort || remediation.effort || 'Por evaluar';

  return {
    id: `${rule.id}-${String(sequence).padStart(4, '0')}`,
    ruleId: rule.id,
    category,
    severity: rule.severity,
    type: type ?? rule.type ?? 'objective',
    title: clip(title, 220),
    url: clip(url, 2048),
    selector: clip(selector, 600),
    evidence: clip(evidence, 1400),
    expected: clip(expected, 900),
    impact: clip(impact, 1200),
    recommendation: clip(finalRecommendation, 1800),
    solution: clip(finalSolution, 2200),
    remediationSteps: clipArray(finalSteps, 8, 700),
    acceptanceCriteria: clip(finalAcceptance, 1800),
    codeExample: clip(finalCode, 1800),
    effort: clip(finalEffort, 80),
    confidence,
    automated,
    source: clip(source, 220),
    penalty: rule.penalty ?? 0
  };
}
