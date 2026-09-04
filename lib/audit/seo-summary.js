import { createFinding } from './finding.js';
import { RULES } from '../config/rules.js';

const clean = (value) => String(value ?? '').replace(/\s+/g, ' ').trim();
const normalizeText = (value) => clean(value).toLocaleLowerCase('es');

function groupDuplicates(pages, valueFn, { minLength = 1 } = {}) {
  const map = new Map();
  for (const page of pages) {
    const raw = clean(valueFn(page));
    if (raw.length < minLength) continue;
    const key = normalizeText(raw);
    const current = map.get(key) || { value: raw, urls: [] };
    current.urls.push(page.url);
    map.set(key, current);
  }
  return [...map.values()].filter((group) => group.urls.length > 1).sort((a, b) => b.urls.length - a.urls.length);
}

function countHeadingLevels(pages) {
  const totals = { h1: 0, h2: 0, h3: 0, h4: 0, h5: 0, h6: 0 };
  for (const page of pages) {
    for (const heading of page.headings || []) {
      const key = `h${heading.level}`;
      if (key in totals) totals[key] += 1;
    }
  }
  return totals;
}

function pageSeoRow(page, origin) {
  const hCounts = { h1: 0, h2: 0, h3: 0, h4: 0, h5: 0, h6: 0 };
  for (const heading of page.headings || []) hCounts[`h${heading.level}`] += 1;
  const robots = clean(page.robots).toLowerCase();
  const xRobots = clean(page.headers?.['x-robots-tag']).toLowerCase();
  const noindex = /(^|[,\s])noindex([,\s]|$)/i.test(`${robots} ${xRobots}`);
  const canonicalUrl = page.canonical || null;
  let canonicalType = 'missing';
  if (canonicalUrl) {
    try {
      const canonical = new URL(canonicalUrl);
      const current = new URL(page.url);
      canonicalType = canonical.origin !== origin ? 'external' : (canonical.href.replace(/\/$/, '') === current.href.replace(/\/$/, '') ? 'self' : 'other');
    } catch { canonicalType = 'invalid'; }
  }
  const internalLinks = (page.links || []).filter((link) => {
    try { return new URL(link.href).origin === origin; } catch { return false; }
  }).length;
  const externalLinks = (page.links || []).length - internalLinks;
  return {
    url: page.url,
    status: page.status,
    title: page.title || '',
    titleLength: clean(page.title).length,
    description: page.description || '',
    descriptionLength: clean(page.description).length,
    canonical: canonicalUrl,
    canonicalType,
    robots: page.robots || '',
    xRobotsTag: page.headers?.['x-robots-tag'] || '',
    noindex,
    lang: page.lang || '',
    viewport: page.viewport || '',
    wordCount: page.content?.wordCount || 0,
    paragraphCount: page.content?.paragraphCount || 0,
    hCounts,
    h1Texts: (page.headings || []).filter((h) => h.level === 1).map((h) => h.text).filter(Boolean),
    internalLinks,
    externalLinks,
    images: (page.images || []).length,
    schemaTypes: page.structuredData?.types || []
  };
}

export function buildSeoSummary({ pages, crawl }) {
  const origin = new URL(pages[0]?.url || crawl.startUrl).origin;
  const rows = pages.map((page) => pageSeoRow(page, origin));
  const duplicateTitles = groupDuplicates(pages, (p) => p.title, { minLength: 2 });
  const duplicateDescriptions = groupDuplicates(pages, (p) => p.description, { minLength: 2 });
  const duplicateH1 = groupDuplicates(pages, (p) => (p.headings || []).find((h) => h.level === 1)?.text, { minLength: 2 });
  const findings = [];

  for (const group of duplicateTitles) {
    findings.push(createFinding({
      rule: RULES.seo.duplicateTitle,
      category: 'seo', title: 'Title duplicado entre páginas', url: group.urls[0], selector: 'head > title',
      evidence: `El title “${group.value}” aparece en ${group.urls.length} URLs: ${group.urls.slice(0, 5).join(', ')}${group.urls.length > 5 ? '…' : ''}`,
      impact: 'Varias URLs no se diferencian claramente por su título y pueden competir o resultar menos descriptivas en resultados de búsqueda.',
      recommendation: 'Crear un title específico para la intención y contenido principal de cada URL afectada.', source: 'Domain SEO aggregation'
    }));
  }
  for (const group of duplicateDescriptions) {
    findings.push(createFinding({
      rule: RULES.seo.duplicateDescription,
      category: 'seo', title: 'Meta description duplicada', url: group.urls[0], selector: 'meta[name="description"]',
      evidence: `La misma description aparece en ${group.urls.length} URLs.`,
      impact: 'Las páginas pierden diferenciación editorial en sus descripciones.',
      recommendation: 'Redactar descripciones distintas y alineadas con la intención de cada página.', source: 'Domain SEO aggregation', type: 'advisory'
    }));
  }
  for (const group of duplicateH1) {
    findings.push(createFinding({
      rule: RULES.seo.duplicateH1,
      category: 'seo', title: 'H1 principal repetido entre páginas', url: group.urls[0], selector: 'h1',
      evidence: `El H1 “${group.value}” aparece como H1 principal en ${group.urls.length} URLs.`,
      impact: 'Puede indicar páginas poco diferenciadas o plantillas con encabezado principal genérico.',
      recommendation: 'Revisar que cada página tenga un H1 representativo de su intención y contenido.', source: 'Domain SEO aggregation', type: 'advisory'
    }));
  }

  const missingLang = rows.filter((row) => !row.lang);
  if (missingLang.length) findings.push(createFinding({
    rule: RULES.seo.missingLang,
    category: 'seo', title: 'Atributo lang ausente', url: missingLang[0].url, selector: 'html',
    evidence: `${missingLang.length} página(s) sin atributo lang en <html>.`,
    impact: 'La ausencia del idioma declarado reduce claridad semántica para tecnologías de asistencia y procesamiento lingüístico.',
    recommendation: 'Declarar el idioma principal, por ejemplo <html lang="es">.', source: 'HTML', type: 'advisory'
  }));

  const missingViewport = rows.filter((row) => !row.viewport);
  if (missingViewport.length) findings.push(createFinding({
    rule: RULES.seo.missingViewport,
    category: 'technical', title: 'Meta viewport ausente', url: missingViewport[0].url, selector: 'meta[name="viewport"]',
    evidence: `${missingViewport.length} página(s) sin meta viewport.`,
    impact: 'La representación en dispositivos móviles puede ser incorrecta o poco usable.',
    recommendation: 'Añadir una configuración viewport responsive adecuada.', source: 'HTML'
  }));

  const externalCanonicals = rows.filter((row) => row.canonicalType === 'external');
  if (externalCanonicals.length) findings.push(createFinding({
    rule: RULES.seo.externalCanonical,
    category: 'seo', title: 'Canonical apunta a otro dominio', url: externalCanonicals[0].url, selector: 'link[rel="canonical"]',
    evidence: `${externalCanonicals.length} página(s) declaran canonical fuera del dominio auditado.`,
    impact: 'La URL está indicando otra ubicación como versión preferida; puede ser intencional o un error de configuración.',
    recommendation: 'Confirmar que el canonical externo es deliberado; si no, corregirlo hacia la URL canónica correcta.', source: 'HTML', type: 'advisory'
  }));

  const statusCounts = rows.reduce((acc, row) => { const key = String(row.status); acc[key] = (acc[key] || 0) + 1; return acc; }, {});
  const schemaTypes = [...new Set(rows.flatMap((row) => row.schemaTypes))].sort();
  const languageCounts = rows.reduce((acc, row) => { const key = row.lang || '(sin lang)'; acc[key] = (acc[key] || 0) + 1; return acc; }, {});
  const linkTargets = new Map(rows.map((row) => [row.url.replace(/\/$/, ''), row.status]));
  let brokenInternalLinks = 0;
  for (const page of pages) {
    for (const link of page.links || []) {
      try {
        const u = new URL(link.href);
        if (u.origin !== origin) continue;
        const status = linkTargets.get(u.href.replace(/\/$/, ''));
        if (Number.isFinite(status) && status >= 400) brokenInternalLinks += 1;
      } catch { /* ignore */ }
    }
  }

  const discovery = crawl.discovery || {};
  return {
    target: crawl.startUrl,
    finalUrl: pages[0]?.url || crawl.startUrl,
    origin,
    robots: {
      url: discovery.robots?.url || new URL('/robots.txt', origin).href,
      status: discovery.robots?.status ?? null,
      bytes: discovery.robots?.body?.length || 0
    },
    sitemaps: {
      declared: discovery.sitemapUrls || [],
      urlsDiscovered: discovery.urls?.length || 0
    },
    coverage: {
      discovered: crawl.discovered || 0,
      crawled: pages.length,
      crawlErrors: crawl.errors?.length || 0,
      indexable: rows.filter((row) => row.status >= 200 && row.status < 300 && !row.noindex).length,
      noindex: rows.filter((row) => row.noindex).length
    },
    metadata: {
      missingTitles: rows.filter((row) => !row.title).length,
      duplicateTitleGroups: duplicateTitles.length,
      duplicateTitles,
      missingDescriptions: rows.filter((row) => !row.description).length,
      duplicateDescriptionGroups: duplicateDescriptions.length,
      duplicateDescriptions,
      missingCanonicals: rows.filter((row) => !row.canonical).length,
      selfCanonicals: rows.filter((row) => row.canonicalType === 'self').length,
      otherCanonicals: rows.filter((row) => row.canonicalType === 'other').length,
      externalCanonicals: externalCanonicals.length,
      missingLang: missingLang.length,
      missingViewport: missingViewport.length
    },
    headings: {
      totals: countHeadingLevels(pages),
      pagesMissingH1: rows.filter((row) => row.hCounts.h1 === 0).length,
      pagesMultipleH1: rows.filter((row) => row.hCounts.h1 > 1).length,
      duplicateH1Groups: duplicateH1.length,
      duplicateH1
    },
    links: {
      total: rows.reduce((sum, row) => sum + row.internalLinks + row.externalLinks, 0),
      internal: rows.reduce((sum, row) => sum + row.internalLinks, 0),
      external: rows.reduce((sum, row) => sum + row.externalLinks, 0),
      brokenInternalObserved: brokenInternalLinks
    },
    content: {
      words: rows.reduce((sum, row) => sum + row.wordCount, 0),
      pagesUnder150Words: rows.filter((row) => row.wordCount > 0 && row.wordCount < 150).length
    },
    statusCounts,
    languageCounts,
    schemaTypes,
    rows,
    findings
  };
}
