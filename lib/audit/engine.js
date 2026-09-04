import { COMPANY } from '../config/company.js';
import { crawlSite } from './crawler.js';
import { scoreAudit } from './scoring.js';
import { inspectImageAssets } from './image-assets.js';
import { runBrowserAudit } from '../browser/browser-audit.js';
import { runPageSpeedAudit } from '../performance/pagespeed.js';
import { RULES } from '../config/rules.js';
import { createFinding } from './finding.js';
import { runIsoReadiness } from '../compliance/iso.js';
import { runPeruCompliance } from '../compliance/peru.js';
import { runDomainInfrastructureAudit } from '../infrastructure/domain-audit.js';


function compareRawAndRendered(rawPage, browserData) {
  if (!rawPage || !browserData) return [];
  const findings = [];
  const rawTitle = String(rawPage.title || '').trim();
  const renderedTitle = String(browserData.title || '').trim();
  const rawDescription = String(rawPage.description || '').trim();
  const renderedDescription = String(browserData.description || '').trim();

  if (rawTitle !== renderedTitle || rawDescription !== renderedDescription) {
    findings.push(createFinding({
      rule: RULES.technical.clientRenderedMeta,
      category: 'technical',
      title: 'Metadatos modificados después de ejecutar JavaScript',
      url: browserData.finalUrl || rawPage.url,
      selector: 'head',
      evidence: `Title inicial: "${rawTitle || '(vacío)'}" → renderizado: "${renderedTitle || '(vacío)'}". Description inicial: ${rawDescription ? 'presente' : 'ausente'} → renderizada: ${renderedDescription ? 'presente' : 'ausente'}.`,
      impact: 'Los metadatos dependen del renderizado en cliente; algunos crawlers o integraciones pueden observar primero el HTML inicial.',
      recommendation: 'Cuando sea viable, servir metadatos esenciales desde el HTML inicial o SSR y mantener coherencia con el DOM final.',
      source: 'Raw HTML vs Rendered DOM',
      type: 'advisory',
      confidence: 1
    }));
  }

  const rawHeadings = rawPage.headings?.length || 0;
  const renderedHeadings = browserData.headings?.length || 0;
  if (rawHeadings !== renderedHeadings) {
    findings.push(createFinding({
      rule: RULES.technical.clientRenderedStructure,
      category: 'technical',
      title: 'La estructura de encabezados cambia tras ejecutar JavaScript',
      url: browserData.finalUrl || rawPage.url,
      selector: 'h1,h2,h3,h4,h5,h6',
      evidence: `${rawHeadings} encabezado(s) en HTML inicial → ${renderedHeadings} en DOM renderizado.`,
      impact: 'Parte de la estructura semántica depende de JavaScript y puede variar entre crawlers o estados de carga.',
      recommendation: 'Verificar que el contenido principal y su jerarquía estén disponibles de forma consistente para usuarios y rastreadores.',
      source: 'Raw HTML vs Rendered DOM',
      type: 'advisory',
      confidence: 1
    }));
  }
  return findings;
}

const severityRank = { critical: 4, high: 3, medium: 2, low: 1, info: 0 };

function prioritizeFindings(items, limit = 300) {
  return [...items].sort((a, b) => (severityRank[b.severity] || 0) - (severityRank[a.severity] || 0)).slice(0, limit);
}

const clip = (value, max = 400) => {
  if (value == null) return value;
  const text = String(value);
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
};

function countBy(items, key) {
  return items.reduce((acc, item) => {
    const value = item[key] || 'unknown';
    acc[value] = (acc[value] || 0) + 1;
    return acc;
  }, {});
}

export async function runAudit({ url, maxPages = 12, pageSpeed = true }) {
  const startedAt = new Date();
  const crawl = await crawlSite(url, { maxPages });
  if (!crawl.pages.length) {
    const reason = crawl.errors[0]?.error || 'No se pudo analizar ninguna página HTML.';
    throw new Error(reason);
  }

  const target = crawl.startUrl;
  const [imageInspection, browser, speed, infrastructure] = await Promise.all([
    inspectImageAssets(crawl.pages, 30),
    runBrowserAudit(target),
    runPageSpeedAudit(target, pageSpeed),
    runDomainInfrastructureAudit(target).catch((error) => ({ status: 'unavailable', error: clip(error?.message || error), findings: [] }))
  ]);

  const renderedComparison = compareRawAndRendered(crawl.pages[0], browser.data);
  const baseFindings = [
    ...crawl.pages.flatMap((page) => page.findings),
    ...(browser.findings || []),
    ...(speed.findings || []),
    ...(infrastructure.findings || []),
    ...renderedComparison
  ];
  const [iso, peru] = await Promise.all([
    runIsoReadiness({ target, pages: crawl.pages, browser, performance: speed, findings: baseFindings, infrastructure }),
    Promise.resolve(runPeruCompliance({ target, pages: crawl.pages, browser }))
  ]);
  const findings = [...baseFindings, ...(iso.findings || []), ...(peru.findings || [])];

  const measuredScores = {
    performance: speed.mobile?.categories?.performance,
    accessibility: speed.mobile?.categories?.accessibility,
    accessibilityMeasured: browser.status === 'measured' || speed.status === 'measured',
    compliance: iso.overall?.observableScore,
    complianceMeasured: Number.isFinite(iso.overall?.observableScore)
  };
  const scores = scoreAudit(findings, measuredScores);
  const id = `AUD-${startedAt.toISOString().slice(0, 10).replaceAll('-', '')}-${crypto.randomUUID().slice(0, 6).toUpperCase()}`;

  const summary = {
    severity: countBy(findings, 'severity'),
    category: countBy(findings, 'category'),
    pagesCrawled: crawl.pages.length,
    pagesDiscovered: crawl.discovered,
    errors: crawl.errors.length,
    headings: crawl.pages.reduce((acc, page) => acc + page.headings.length, 0),
    images: crawl.pages.reduce((acc, page) => acc + page.images.length, 0),
    links: crawl.pages.reduce((acc, page) => acc + page.links.length, 0),
    findingsTotal: findings.length,
    findingsReturned: Math.min(findings.length, 300),
    payloadTruncated: findings.length > 300
  };

  return {
    meta: {
      id,
      target,
      startedAt: startedAt.toISOString(),
      finishedAt: new Date().toISOString(),
      engineVersion: COMPANY.engineVersion,
      mode: 'HTTP/HTML + Rendered DOM + PageSpeed',
      security: 'passive'
    },
    company: COMPANY,
    scores,
    summary,
    findings: prioritizeFindings(findings, 300),
    pages: crawl.pages.map((page) => ({
      url: page.url,
      status: page.status,
      title: clip(page.title, 300),
      description: clip(page.description, 500),
      canonical: page.canonical,
      robots: page.robots,
      lang: page.lang,
      headings: page.headings.slice(0, 30).map((h) => ({ ...h, text: clip(h.text, 300) })),
      headingCount: page.headings.length,
      imageCount: page.images.length,
      images: page.images.slice(0, 20).map((img) => ({ ...img, src: clip(img.src, 2048), alt: clip(img.alt, 300), srcset: clip(img.srcset, 700) })),
      linkCount: page.links.length,
      structuredData: page.structuredData,
      complianceSignals: page.complianceSignals,
      redirects: page.redirects,
      headers: {
        'content-type': page.headers['content-type'] || null,
        server: page.headers.server || null,
        'strict-transport-security': page.headers['strict-transport-security'] || null,
        'content-security-policy': page.headers['content-security-policy'] || null,
        'x-content-type-options': page.headers['x-content-type-options'] || null,
        'referrer-policy': page.headers['referrer-policy'] || null,
        'permissions-policy': page.headers['permissions-policy'] || null
      }
    })),
    browser: browser.data ? { ...browser.data, moduleStatus: browser.status } : { moduleStatus: browser.status, error: browser.error },
    performance: { status: speed.status, mobile: speed.mobile, desktop: speed.desktop, error: speed.error },
    infrastructure,
    peru,
    iso,
    crawl: { errors: crawl.errors, limit: crawl.limit, discovery: crawl.discovery, imageInspection },
    modules: {
      http: 'measured', seo: 'measured', headings: 'measured', images: 'partial', security: 'measured', structuredData: 'measured',
      renderedDom: browser.status, cssColors: browser.status === 'measured' ? 'partial' : browser.status,
      responsive: browser.status === 'measured' ? 'partial' : browser.status,
      accessibility: (browser.data?.axe?.moduleStatus === 'measured' || browser.status === 'measured' || speed.status === 'measured') ? 'partial' : 'unavailable',
      axeCore: browser.data?.axe?.moduleStatus || (browser.status === 'measured' ? 'unavailable' : browser.status),
      performance: speed.status, lighthouse: speed.status, screenshots: browser.status,
      dnsTls: infrastructure.status, emailSecurity: infrastructure.status === 'measured' ? 'partial' : infrastructure.status, cookiesTrackers: browser.status === 'measured' ? 'partial' : browser.status,
      isoStandards: 'partial', privacyIso: 'partial', compliancePe: 'partial', isoEvidenceCenter: 'partial', contentAi: 'planned'
    }
  };
}
