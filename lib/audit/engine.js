import { COMPANY } from '../config/company.js';
import { crawlSite } from './crawler.js';
import { scoreAudit } from './scoring.js';
import { inspectImageAssets } from './image-assets.js';
import { runBrowserAudit } from '../browser/browser-audit.js';
import { runPageSpeedAudit } from '../performance/pagespeed.js';
import { runCruxAudit, buildCruxFindings } from '../performance/crux.js';
import { computeBrowserLabScore, buildBrowserLabFindings } from '../performance/browser-lab.js';
import { RULES } from '../config/rules.js';
import { createFinding } from './finding.js';
import { runIsoReadiness } from '../compliance/iso.js';
import { runPeruCompliance } from '../compliance/peru.js';
import { runDomainInfrastructureAudit } from '../infrastructure/domain-audit.js';
import { AUDIT_PROFILE_VERSION, STABLE_CACHE_TTL_SECONDS } from '../cache/audit-cache.js';
import { STABLE_PAGESPEED_SAMPLES } from '../performance/pagespeed.js';
import { buildSeoSummary } from './seo-summary.js';
import { buildContentSummary } from './content-summary.js';
import { buildImageSummary } from './image-summary.js';
import { aggregateTechnologies } from './technology-detection.js';
import { buildUxSummary } from './ux-summary.js';
import { runAiContentReview } from './ai-review.js';
import { resolveAuditConfig, findingAllowed } from '../config/audit-modes.js';
import { buildCssAnalysis } from './css-analysis.js';
import { buildManualAccessibilityChecklist } from './accessibility-manual.js';
import { groupPagesByTemplate } from './template-grouping.js';


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

export async function runAudit({
  url,
  maxPages = 12,
  pageSpeed = true,
  stableMode = true,
  aiReview = false,
  auditMode = 'complete',
  modules = {},
  devices = { mobile: true, desktop: true }
}) {
  const config = resolveAuditConfig({ auditMode, modules, devices, maxPages, pageSpeed, aiReview });
  const crawl = await crawlSite(url, { maxPages: config.maxPages });
  return runAuditFromCrawl({
    crawl, pageSpeed, stableMode, aiReview, auditMode, modules, devices, resolvedConfig: config
  });
}

export async function runAuditFromCrawl({
  crawl,
  pageSpeed = true,
  stableMode = true,
  aiReview = false,
  auditMode = 'complete',
  modules = {},
  devices = { mobile: true, desktop: true },
  resolvedConfig = null,
  startedAt: startedAtInput = null
}) {
  const startedAt = startedAtInput ? new Date(startedAtInput) : new Date();
  const config = resolvedConfig || resolveAuditConfig({
    auditMode, modules, devices, maxPages: crawl?.limit || crawl?.pages?.length || 12, pageSpeed, aiReview
  });
  if (!crawl?.pages?.length) {
    const reason = crawl?.errors?.[0]?.error || 'No se pudo analizar ninguna página HTML.';
    throw new Error(reason);
  }

  const target = crawl.startUrl;
  const skipped = (reason = 'Módulo no seleccionado.') => ({ status: 'skipped', data: null, findings: [], error: null, reason });

  const [imageInspection, browser, speed, infrastructure, crux, aiReviewResult] = await Promise.all([
    config.modules.images ? inspectImageAssets(crawl.pages, 30) : Promise.resolve({ status: 'skipped', assets: [], errors: [], inspected: 0 }),
    config.modules.browser ? runBrowserAudit(target, { devices: config.devices, accessibility: config.modules.accessibility, visual: config.modules.visual }) : Promise.resolve(skipped()),
    config.modules.performance ? runPageSpeedAudit(target, config.pageSpeed, { stableMode, devices: config.devices }) : Promise.resolve({ status:'disabled', mobile:null, desktop:null, findings:[], error:null, stability:null }),
    (config.modules.infrastructure || config.modules.security) ? runDomainInfrastructureAudit(target).catch((error) => ({ status: 'unavailable', error: clip(error?.message || error), findings: [] })) : Promise.resolve({ status:'skipped', findings:[] }),
    config.modules.crux ? runCruxAudit(target, { devices: config.devices, enabled: true }) : Promise.resolve({ status:'disabled', current:null, history:null, availability:{ code:'disabled', detail:'CrUX no fue seleccionado.' } }),
    config.aiReview ? runAiContentReview(crawl.pages, true) : Promise.resolve({ status: config.modules.content ? 'disabled' : 'skipped', reviews: [], note: config.modules.content ? 'Revisión IA no activada.' : 'Contenido no seleccionado.' })
  ]);

  const seo = (config.modules.seo || config.modules.headings) ? buildSeoSummary({ pages: crawl.pages, crawl }) : { status:'skipped', findings:[], pages:[], summary:{} };
  const content = config.modules.content ? buildContentSummary(crawl.pages) : { status:'skipped', findings:[], totals:{}, pages:[], duplicates:[], topTerms:[] };
  const imageSummary = config.modules.images ? buildImageSummary(crawl.pages, imageInspection, browser.data) : { status:'skipped', findings:[], totals:{}, images:[] };
  const technologies = aggregateTechnologies(crawl.pages);
  const ux = config.modules.ux ? buildUxSummary(crawl.pages, seo) : { status:'skipped', score:null, findings:[], pages:[], summary:{} };
  const css = buildCssAnalysis(browser, config.modules.visual);
  const accessibilityManual = buildManualAccessibilityChecklist({ enabled: config.modules.accessibility, browser });
  const templateSampling = groupPagesByTemplate(crawl.pages, { representativeLimit: 8 });
  const browserLabScore = config.modules.performance && browser.status === 'measured' ? computeBrowserLabScore(browser.data?.performance || {}) : null;
  const browserLabFindings = config.modules.performance && speed.status !== 'measured' ? buildBrowserLabFindings(target, browser.data?.performance || {}) : [];
  const cruxFindings = config.modules.crux ? buildCruxFindings(target, crux) : [];
  const renderedComparison = config.modules.browser ? compareRawAndRendered(crawl.pages[0], browser.data) : [];

  const pageFindings = crawl.pages.flatMap((page) => page.findings).filter((finding) => findingAllowed(finding, config.modules));
  const baseFindings = [
    ...pageFindings,
    ...((seo.findings || []).filter((finding) => findingAllowed(finding, config.modules))),
    ...((content.findings || []).filter((finding) => findingAllowed(finding, config.modules))),
    ...((imageSummary.findings || []).filter((finding) => findingAllowed(finding, config.modules))),
    ...((browser.findings || []).filter((finding) => findingAllowed(finding, config.modules))),
    ...((speed.findings || []).filter((finding) => findingAllowed(finding, config.modules))),
    ...browserLabFindings,
    ...cruxFindings,
    ...((ux.findings || []).filter((finding) => findingAllowed(finding, config.modules))),
    ...((css.findings || []).filter((finding) => findingAllowed(finding, config.modules))),
    ...((infrastructure.findings || []).filter((finding) => findingAllowed(finding, config.modules))),
    ...renderedComparison
  ];

  const [iso, peru] = await Promise.all([
    config.modules.iso ? runIsoReadiness({ target, pages: crawl.pages, browser, performance: speed, findings: baseFindings, infrastructure }) : Promise.resolve(null),
    config.modules.compliance ? Promise.resolve(runPeruCompliance({ target, pages: crawl.pages, browser })) : Promise.resolve(null)
  ]);
  const findings = [
    ...baseFindings,
    ...((iso?.findings || []).filter((finding) => findingAllowed(finding, config.modules))),
    ...((peru?.findings || []).filter((finding) => findingAllowed(finding, config.modules)))
  ];

  const enabledCategories = {
    security: Boolean(config.modules.security || config.modules.infrastructure),
    performance: Boolean(config.modules.performance),
    seo: Boolean(config.modules.seo || config.modules.headings),
    content: Boolean(config.modules.content),
    accessibility: Boolean(config.modules.accessibility),
    ux: Boolean(config.modules.ux),
    images: Boolean(config.modules.images),
    technical: true,
    compliance: Boolean(config.modules.compliance || config.modules.iso)
  };
  const measuredScores = {
    performance: config.modules.performance ? (Number.isFinite(speed.mobile?.categories?.performance) ? speed.mobile.categories.performance : (Number.isFinite(speed.desktop?.categories?.performance) ? speed.desktop.categories.performance : browserLabScore)) : null,
    accessibility: config.modules.accessibility ? (speed.mobile?.categories?.accessibility ?? speed.desktop?.categories?.accessibility) : null,
    accessibilityMeasured: config.modules.accessibility && (browser.status === 'measured' || speed.status === 'measured' || speed.status === 'partial'),
    compliance: config.modules.iso ? iso?.overall?.observableScore : null,
    complianceMeasured: config.modules.iso && Number.isFinite(iso?.overall?.observableScore),
    contentMeasured: config.modules.content && content.status === 'measured',
    ux: config.modules.ux ? ux.score : null,
    uxMeasured: config.modules.ux && ux.status === 'measured',
    enabledCategories
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
    templatesObserved: templateSampling.coverage?.groups || 0,
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
      mode: config.label,
      auditConfig: config,
      security: 'passive',
      dataIntegrity: {
        simulated: false,
        policy: 'measured-only',
        note: 'No se crean métricas, hallazgos ni porcentajes para módulos no seleccionados o sin una fuente real disponible.',
        sources: [
          'HTTP responses', 'Raw HTML crawler',
          ...(browser.status === 'measured' ? ['Rendered DOM / Chromium'] : []),
          ...(config.modules.accessibility && browser.data?.axe?.moduleStatus === 'measured' ? ['axe-core'] : []),
          ...(config.modules.visual && browser.status === 'measured' ? ['computed styles / CSSOM / screenshots'] : []),
          ...(['measured','partial'].includes(speed.status) ? ['Google PageSpeed Insights / Lighthouse'] : []),
          ...(browserLabScore != null ? ['Chromium PerformanceObserver / lab fallback'] : []),
          ...(crux.status === 'measured' ? ['Chrome UX Report API / field data'] : []),
          ...(ux.status === 'measured' ? ['Deterministic UX/CRO heuristics'] : []),
          ...(aiReviewResult.status === 'measured' ? ['OpenAI Responses API / heuristic content review'] : []),
          ...(infrastructure.status === 'measured' ? ['DNS / TLS / email security checks'] : [])
        ]
      },
      consistency: {
        mode: stableMode ? 'stable' : 'live',
        profile: AUDIT_PROFILE_VERSION,
        functionRegion: process.env.VERCEL_REGION || 'local/dev',
        locale: 'es-PE',
        timezone: 'America/Lima',
        pageSpeedAggregation: stableMode && config.modules.performance ? `median-${STABLE_PAGESPEED_SAMPLES}` : (config.modules.performance ? 'single-run' : 'not-selected'),
        cacheTtlMinutes: stableMode ? Math.round(STABLE_CACHE_TTL_SECONDS / 60) : 0,
        note: stableMode ? 'Perfil fijo, rastreo determinista, mediana PageSpeed cuando aplica y reutilización temporal del resultado.' : 'Medición en vivo sin reutilizar auditorías anteriores.'
      }
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
      viewport: page.viewport,
      openGraph: page.openGraph,
      twitter: page.twitter,
      hreflang: page.hreflang,
      pagination: page.pagination,
      content: { ...page.content, paragraphs: undefined },
      headings: page.headings.slice(0, 30).map((h) => ({ ...h, text: clip(h.text, 300) })),
      headingCount: page.headings.length,
      imageCount: page.images.length,
      images: page.images.slice(0, 20).map((img) => ({ ...img, src: clip(img.src, 2048), alt: clip(img.alt, 300), srcset: clip(img.srcset, 700) })),
      linkCount: page.links.length,
      linkStats: page.linkStats,
      structuredData: page.structuredData,
      complianceSignals: page.complianceSignals,
      uxSignals: page.uxSignals,
      technologies: page.technologies,
      redirects: page.redirects,
      headers: {
        'content-type': page.headers['content-type'] || null,
        server: page.headers.server || null,
        'strict-transport-security': page.headers['strict-transport-security'] || null,
        'content-security-policy': page.headers['content-security-policy'] || null,
        'x-content-type-options': page.headers['x-content-type-options'] || null,
        'referrer-policy': page.headers['referrer-policy'] || null,
        'permissions-policy': page.headers['permissions-policy'] || null,
        'x-robots-tag': page.headers['x-robots-tag'] || null
      }
    })),
    seo,
    content: { ...content, ai: aiReviewResult },
    ux,
    imageSummary,
    technologies,
    css,
    accessibilityManual,
    templateSampling,
    browser: browser.data ? { ...browser.data, moduleStatus: browser.status } : { moduleStatus: browser.status, error: browser.error },
    performance: { status: speed.status, mobile: speed.mobile, desktop: speed.desktop, browserLabScore, browserLab: browser.data?.performance || null, crux, error: speed.error, availability: speed.availability || null, deviceErrors: speed.deviceErrors || {}, stability: speed.stability },
    infrastructure,
    peru,
    iso,
    crawl: { errors: crawl.errors, limit: crawl.limit, discovery: crawl.discovery, imageInspection },
    modules: {
      http: 'measured',
      seo: config.modules.seo ? 'measured' : 'skipped',
      headings: config.modules.headings ? 'measured' : 'skipped',
      images: config.modules.images ? (imageSummary.status || 'partial') : 'skipped',
      security: config.modules.security ? 'measured' : 'skipped',
      structuredData: config.modules.seo ? 'measured' : 'skipped',
      renderedDom: config.modules.browser ? browser.status : 'skipped',
      cssColors: config.modules.visual ? css.status : 'skipped',
      responsive: config.modules.visual ? (browser.status === 'measured' ? 'partial' : browser.status) : 'skipped',
      accessibility: config.modules.accessibility ? ((browser.data?.axe?.moduleStatus === 'measured' || browser.status === 'measured' || ['measured','partial'].includes(speed.status)) ? 'partial' : 'unavailable') : 'skipped',
      accessibilityManual: config.modules.accessibility ? 'manual-required' : 'skipped',
      axeCore: config.modules.accessibility ? (browser.data?.axe?.moduleStatus || (browser.status === 'measured' ? 'unavailable' : browser.status)) : 'skipped',
      performance: config.modules.performance ? (['measured','partial'].includes(speed.status) ? speed.status : (browserLabScore != null ? 'partial' : speed.status)) : 'skipped',
      lighthouse: config.modules.performance ? speed.status : 'skipped',
      crux: config.modules.crux ? crux.status : 'skipped',
      screenshots: config.modules.visual ? browser.status : 'skipped',
      dnsTls: (config.modules.infrastructure || config.modules.security) ? infrastructure.status : 'skipped',
      emailSecurity: config.modules.infrastructure ? (infrastructure.status === 'measured' ? 'partial' : infrastructure.status) : 'skipped',
      cookiesTrackers: config.modules.browser ? (browser.status === 'measured' ? 'partial' : browser.status) : 'skipped',
      isoStandards: config.modules.iso ? 'partial' : 'skipped',
      privacyIso: config.modules.iso ? 'partial' : 'skipped',
      compliancePe: config.modules.compliance ? 'partial' : 'skipped',
      isoEvidenceCenter: config.modules.iso ? 'partial' : 'skipped',
      content: config.modules.content ? 'measured' : 'skipped',
      contentAi: config.modules.content ? aiReviewResult.status : 'skipped',
      uxCro: config.modules.ux ? ux.status : 'skipped',
      imageAdvanced: config.modules.images ? (imageSummary.status || 'partial') : 'skipped',
      technologies: technologies.length ? 'measured' : 'partial'
    }
  };
}
