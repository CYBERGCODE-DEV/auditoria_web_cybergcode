import { RULES } from '../config/rules.js';
import { createFinding } from './finding.js';

const normalizeParagraph = (value) => String(value || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9ñ]+/g, ' ').replace(/\s+/g, ' ').trim();

function groupParagraphs(pages) {
  const groups = new Map();
  for (const page of pages) {
    for (const paragraph of page.content?.paragraphs || []) {
      if (paragraph.length < 100) continue;
      const key = normalizeParagraph(paragraph);
      if (key.length < 90) continue;
      if (!groups.has(key)) groups.set(key, { text: paragraph, urls: new Set() });
      groups.get(key).urls.add(page.url);
    }
  }
  return [...groups.values()].filter((group) => group.urls.size >= 2).map((group) => ({ text: group.text, urls: [...group.urls] })).sort((a,b) => b.urls.length - a.urls.length).slice(0, 20);
}

export function buildContentSummary(pages = []) {
  const findings = [];
  const thinPages = pages.filter((page) => (page.content?.wordCount || 0) > 0 && (page.content?.wordCount || 0) < 150);
  const longSentencePages = pages.filter((page) => Number.isFinite(page.content?.averageWordsPerSentence) && page.content.averageWordsPerSentence > 26 && page.content.sentenceCount >= 5);
  const genericAnchorPages = pages.filter((page) => (page.content?.genericAnchors || 0) > 0);
  const lowTitleH1OverlapPages = pages.filter((page) => Number.isFinite(page.content?.titleH1Overlap) && page.content.titleH1Overlap < 0.25 && (page.headings?.find((h) => h.level === 1)?.text || '').length > 8);
  const duplicateParagraphGroups = groupParagraphs(pages);

  for (const page of thinPages) findings.push(createFinding({
    rule: RULES.content.thinContent, category: 'content', title: 'Contenido escaso para revisión', url: page.url,
    evidence: `${page.content.wordCount} palabras visibles detectadas.`, impact: 'Una página con muy poco contenido puede no explicar suficientemente su propósito; el umbral usado es heurístico, no una regla de posicionamiento.',
    recommendation: 'Revisar si la URL responde de forma suficiente a la intención del usuario y ampliar únicamente cuando aporte valor real.', source: 'HTML visible', type: 'advisory', confidence: .9
  }));
  for (const page of longSentencePages) findings.push(createFinding({
    rule: RULES.content.longSentences, category: 'content', title: 'Frases extensas para revisión de legibilidad', url: page.url,
    evidence: `Promedio aproximado: ${page.content.averageWordsPerSentence} palabras por frase; ${page.content.longSentences || 0} frase(s) superan 30 palabras.`,
    impact: 'Frases muy extensas pueden reducir la claridad, especialmente en interfaces y contenidos comerciales.', recommendation: 'Simplificar las frases complejas donde sea posible sin perder precisión.', source: 'Texto visible', type: 'advisory', confidence: .8
  }));
  for (const page of genericAnchorPages) findings.push(createFinding({
    rule: RULES.content.genericAnchors, category: 'content', title: 'Enlaces con texto poco descriptivo', url: page.url,
    evidence: `${page.content.genericAnchors} enlace(s) usan textos genéricos como “ver más”, “aquí” o equivalentes.`, impact: 'Los textos de enlace poco descriptivos aportan menos contexto a usuarios y tecnologías de asistencia.',
    recommendation: 'Usar textos que describan el destino o la acción del enlace.', source: 'HTML links', type: 'advisory', confidence: .95
  }));
  for (const page of lowTitleH1OverlapPages) findings.push(createFinding({
    rule: RULES.content.titleH1Alignment, category: 'content', title: 'Title y H1 con baja coincidencia temática', url: page.url,
    evidence: `Coincidencia léxica aproximada: ${Math.round(page.content.titleH1Overlap * 100)}%. Title: “${page.title}”. H1: “${page.headings.find((h) => h.level === 1)?.text || ''}”.`,
    impact: 'Una desconexión marcada entre title y H1 puede indicar que la página comunica intenciones diferentes; esta comprobación es heurística.', recommendation: 'Confirmar que title y H1 describen la misma intención principal con lenguaje natural.', source: 'HTML title + H1', type: 'advisory', confidence: .78
  }));
  for (const group of duplicateParagraphGroups.slice(0, 8)) findings.push(createFinding({
    rule: RULES.content.duplicateParagraph, category: 'content', title: 'Bloque de texto repetido entre páginas', url: group.urls[0],
    evidence: `El mismo párrafo aparece en ${group.urls.length} URL(s): ${group.urls.slice(0, 5).join(', ')}${group.urls.length > 5 ? '…' : ''}`, impact: 'El contenido repetido puede ser parte de una plantilla válida, pero conviene revisar si páginas distintas necesitan información más específica.',
    recommendation: 'Mantener el texto común solo cuando sea necesario y diferenciar el contenido principal de cada URL.', source: 'Texto visible comparado', type: 'advisory', confidence: .88
  }));

  const topTerms = new Map();
  for (const page of pages) for (const item of page.content?.topTerms || []) topTerms.set(item.term, (topTerms.get(item.term) || 0) + item.count);
  return {
    status: 'measured',
    pages: pages.length,
    wordsTotal: pages.reduce((sum, page) => sum + (page.content?.wordCount || 0), 0),
    sentencesTotal: pages.reduce((sum, page) => sum + (page.content?.sentenceCount || 0), 0),
    paragraphsTotal: pages.reduce((sum, page) => sum + (page.content?.paragraphCount || 0), 0),
    ctasDetected: pages.reduce((sum, page) => sum + (page.content?.ctaCount || 0), 0),
    genericAnchors: pages.reduce((sum, page) => sum + (page.content?.genericAnchors || 0), 0),
    thinPages: thinPages.map((page) => ({ url: page.url, words: page.content.wordCount })),
    longSentencePages: longSentencePages.map((page) => ({ url: page.url, averageWordsPerSentence: page.content.averageWordsPerSentence })),
    lowTitleH1OverlapPages: lowTitleH1OverlapPages.map((page) => ({ url: page.url, overlap: page.content.titleH1Overlap })),
    duplicateParagraphGroups,
    topTerms: [...topTerms.entries()].sort((a,b) => b[1] - a[1]).slice(0, 15).map(([term,count]) => ({ term, count })),
    findings
  };
}
