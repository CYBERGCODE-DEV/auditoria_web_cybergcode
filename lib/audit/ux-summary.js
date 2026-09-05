import { RULES } from '../config/rules.js';
import { createFinding } from './finding.js';

const clean = (value) => String(value ?? '').replace(/\s+/g, ' ').trim();

function pagePath(url) {
  try { return new URL(url).pathname || '/'; } catch { return String(url || ''); }
}

function isUtilityPage(page) {
  const haystack = `${pagePath(page.url)} ${page.title || ''} ${(page.headings || []).find((h) => h.level === 1)?.text || ''}`.toLowerCase();
  return /(privacidad|privacy|cookies?|terminos|términos|condiciones|legal|contacto|contact|reclamaciones)/i.test(haystack);
}

function computeUxScore(findings) {
  const capByRule = new Map();
  for (const finding of findings) {
    const key = finding.ruleId;
    capByRule.set(key, Math.min(15, (capByRule.get(key) || 0) + (finding.penalty || 0)));
  }
  return Math.max(0, 100 - [...capByRule.values()].reduce((sum, value) => sum + value, 0));
}

export function buildUxSummary(pages = [], seo = null) {
  const findings = [];
  const rows = pages.map((page) => ({
    url: page.url,
    path: pagePath(page.url),
    wordCount: page.content?.wordCount || 0,
    ctaCount: page.content?.ctaCount || 0,
    genericAnchors: page.content?.genericAnchors || 0,
    forms: page.uxSignals?.forms || 0,
    fields: page.uxSignals?.fields || 0,
    requiredFields: page.uxSignals?.requiredFields || 0,
    unlabeledFields: page.uxSignals?.unlabeledFields || 0,
    phoneLinks: page.uxSignals?.phoneLinks || 0,
    emailLinks: page.uxSignals?.emailLinks || 0,
    whatsappLinks: page.uxSignals?.whatsappLinks || 0,
    trustLinks: page.uxSignals?.trustLinks || 0,
    ecommerceSignals: Boolean(page.complianceSignals?.ecommerceSignals),
    clickDepth: seo?.rows?.find((row) => row.url === page.url)?.clickDepth ?? null
  }));

  for (const row of rows) {
    if (!isUtilityPage(row) && row.wordCount >= 250 && row.ctaCount === 0) findings.push(createFinding({
      rule: RULES.ux.noPrimaryCta, category: 'ux', title: 'Página con contenido relevante sin CTA detectable', url: row.url,
      evidence: `${row.wordCount} palabras y 0 llamadas a la acción detectables mediante etiquetas de enlace/botón.`,
      impact: 'El usuario puede consumir información sin encontrar con claridad cuál es el siguiente paso.',
      recommendation: 'Revisar la intención de la página y añadir una acción principal clara cuando corresponda.',
      source: 'HTML / heurística UX', type: 'advisory', confidence: 0.75
    }));
    if (row.forms > 0 && row.fields > 8) findings.push(createFinding({
      rule: RULES.ux.longForm, category: 'ux', title: 'Formulario potencialmente extenso', url: row.url,
      evidence: `${row.fields} controles de formulario detectados (${row.requiredFields} obligatorios).`,
      impact: 'Formularios extensos pueden aumentar fricción y abandono, según el contexto del proceso.',
      recommendation: 'Revisar si todos los campos son necesarios; agrupar, posponer o eliminar los que no sean imprescindibles.',
      source: 'HTML / heurística CRO', type: 'advisory', confidence: 0.8
    }));
    if (row.unlabeledFields > 0) findings.push(createFinding({
      rule: RULES.ux.unlabeledFormControls, category: 'ux', title: 'Controles de formulario sin nombre accesible detectable', url: row.url,
      evidence: `${row.unlabeledFields} control(es) sin label asociado, aria-label o aria-labelledby en el HTML analizado.`,
      impact: 'Puede dificultar comprensión del formulario y accesibilidad, además de aumentar errores de interacción.',
      recommendation: 'Asociar etiquetas visibles o nombres accesibles correctos a cada control.',
      source: 'HTML forms', confidence: 0.96
    }));
    if (row.genericAnchors > 0) findings.push(createFinding({
      rule: RULES.ux.genericLinks, category: 'ux', title: 'Enlaces con texto genérico', url: row.url,
      evidence: `${row.genericAnchors} enlace(s) con textos como “aquí”, “ver más” o equivalentes.`,
      impact: 'El destino o propósito puede ser menos claro fuera de contexto.',
      recommendation: 'Usar texto de enlace que describa la acción o destino de forma específica.',
      source: 'HTML anchors / heurística UX', type: 'advisory', confidence: 0.9
    }));
    if (Number.isFinite(row.clickDepth) && row.clickDepth > 3) findings.push(createFinding({
      rule: RULES.ux.deepPage, category: 'ux', title: 'Página profunda dentro de la muestra rastreada', url: row.url,
      evidence: `Profundidad de clic observada: ${row.clickDepth}.`,
      impact: 'Contenido importante demasiado profundo puede ser menos accesible para usuarios y rastreadores.',
      recommendation: 'Revisar arquitectura y enlazado interno si esta URL es prioritaria para negocio o SEO.',
      source: 'Internal link graph / muestra rastreada', type: 'advisory', confidence: 0.8
    }));
  }

  const home = rows[0];
  if (home && (home.ecommerceSignals || home.wordCount > 300) && (home.phoneLinks + home.emailLinks + home.whatsappLinks) === 0) findings.push(createFinding({
    rule: RULES.ux.missingContactChannel, category: 'ux', title: 'No se detectó un canal de contacto directo en la página principal', url: home.url,
    evidence: '0 enlaces tel:, mailto: o WhatsApp detectados en la home.',
    impact: 'En determinados sitios comerciales puede reducir confianza o dificultar contacto inmediato.',
    recommendation: 'Confirmar si el modelo de negocio necesita un canal directo y, si aplica, hacerlo visible y funcional.',
    source: 'HTML links / heurística de confianza', type: 'advisory', confidence: 0.72
  }));

  return {
    status: pages.length ? 'measured' : 'unavailable',
    score: pages.length ? computeUxScore(findings) : null,
    summary: {
      pages: rows.length,
      ctas: rows.reduce((sum, row) => sum + row.ctaCount, 0),
      forms: rows.reduce((sum, row) => sum + row.forms, 0),
      fields: rows.reduce((sum, row) => sum + row.fields, 0),
      unlabeledFields: rows.reduce((sum, row) => sum + row.unlabeledFields, 0),
      genericAnchors: rows.reduce((sum, row) => sum + row.genericAnchors, 0),
      directContactLinks: rows.reduce((sum, row) => sum + row.phoneLinks + row.emailLinks + row.whatsappLinks, 0),
      pagesDepthOver3: rows.filter((row) => Number.isFinite(row.clickDepth) && row.clickDepth > 3).length
    },
    rows,
    findings,
    methodology: 'Heurísticas determinísticas de UX/CRO basadas en HTML y arquitectura observada. No sustituyen investigación con usuarios ni analítica de conversión.'
  };
}
