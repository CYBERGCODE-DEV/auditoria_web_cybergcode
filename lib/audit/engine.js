import { COMPANY } from '../config/company.js';
import { crawlSite } from './crawler.js';
import { scoreAudit } from './scoring.js';
import { inspectImageAssets } from './image-assets.js';

function countBy(items, key) {
  return items.reduce((acc, item) => {
    const value = item[key] || 'unknown';
    acc[value] = (acc[value] || 0) + 1;
    return acc;
  }, {});
}

export async function runAudit({ url, maxPages = 12 }) {
  const startedAt = new Date();
  const crawl = await crawlSite(url, { maxPages });
  if (!crawl.pages.length) {
    const reason = crawl.errors[0]?.error || 'No se pudo analizar ninguna página HTML.';
    throw new Error(reason);
  }

  const imageInspection = await inspectImageAssets(crawl.pages, 30);
  const findings = crawl.pages.flatMap((page) => page.findings);
  const scores = scoreAudit(findings);
  const id = `AUD-${startedAt.toISOString().slice(0, 10).replaceAll('-', '')}-${crypto.randomUUID().slice(0, 6).toUpperCase()}`;

  const summary = {
    severity: countBy(findings, 'severity'),
    category: countBy(findings, 'category'),
    pagesCrawled: crawl.pages.length,
    pagesDiscovered: crawl.discovered,
    errors: crawl.errors.length,
    headings: crawl.pages.reduce((acc, page) => acc + page.headings.length, 0),
    images: crawl.pages.reduce((acc, page) => acc + page.images.length, 0),
    links: crawl.pages.reduce((acc, page) => acc + page.links.length, 0)
  };

  return {
    meta: {
      id,
      target: crawl.startUrl,
      startedAt: startedAt.toISOString(),
      finishedAt: new Date().toISOString(),
      engineVersion: COMPANY.engineVersion,
      mode: 'MVP HTTP/HTML',
      security: 'passive'
    },
    company: COMPANY,
    scores,
    summary,
    findings,
    pages: crawl.pages.map((page) => ({
      url: page.url,
      status: page.status,
      title: page.title,
      description: page.description,
      canonical: page.canonical,
      robots: page.robots,
      lang: page.lang,
      headings: page.headings.slice(0, 80),
      headingCount: page.headings.length,
      imageCount: page.images.length,
      images: page.images.slice(0, 40),
      linkCount: page.links.length,
      structuredData: page.structuredData,
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
    crawl: { errors: crawl.errors, limit: crawl.limit, discovery: crawl.discovery, imageInspection },
    modules: {
      http: 'measured', seo: 'measured', headings: 'measured', images: 'partial', security: 'measured', structuredData: 'measured',
      lighthouse: 'planned', performance: 'planned', accessibility: 'planned', cssColors: 'planned', responsive: 'planned', contentAi: 'planned', compliancePe: 'planned'
    }
  };
}
