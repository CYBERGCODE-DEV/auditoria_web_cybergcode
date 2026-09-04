let sequence = 0;

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
  source,
  confidence = 1,
  automated = true,
  type
}) {
  sequence += 1;
  return {
    id: `${rule.id}-${String(sequence).padStart(4, '0')}`,
    ruleId: rule.id,
    category,
    severity: rule.severity,
    type: type ?? rule.type ?? 'objective',
    title,
    url,
    selector,
    evidence,
    expected,
    impact,
    recommendation,
    confidence,
    automated,
    source,
    penalty: rule.penalty ?? 0
  };
}
