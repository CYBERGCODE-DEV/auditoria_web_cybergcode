import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSeoSummary } from '../lib/audit/seo-summary.js';

function page(url, overrides = {}) {
  return {
    url, status: 200, title: 'Título repetido', description: 'Descripción repetida', canonical: url,
    robots: '', lang: 'es-PE', viewport: 'width=device-width, initial-scale=1',
    content: { wordCount: 220, paragraphCount: 6 },
    headings: [{ level:1, tag:'h1', text:'H1 repetido' }, { level:2, tag:'h2', text:'Sección' }],
    images: [], links: [], structuredData: { types:['Organization'], count:1 }, headers: {}, ...overrides
  };
}

test('SEO de dominio agrupa duplicados y cuenta H1-H6', () => {
  const pages = [page('https://example.com/'), page('https://example.com/servicio')];
  const crawl = { startUrl:'https://example.com/', discovered:2, errors:[], discovery:{ robots:{status:200,url:'https://example.com/robots.txt',body:'User-agent: *'}, sitemapUrls:['https://example.com/sitemap.xml'], urls:pages.map(p=>p.url) } };
  const seo = buildSeoSummary({ pages, crawl });
  assert.equal(seo.metadata.duplicateTitleGroups, 1);
  assert.equal(seo.metadata.duplicateDescriptionGroups, 1);
  assert.equal(seo.headings.duplicateH1Groups, 1);
  assert.deepEqual(seo.headings.totals, { h1:2,h2:2,h3:0,h4:0,h5:0,h6:0 });
  assert.equal(seo.coverage.indexable, 2);
  assert.ok(seo.findings.some(f => f.ruleId === 'SEO-TITLE-002'));
});

test('SEO detecta páginas sin H1, noindex, lang, viewport y canonical', () => {
  const pages = [page('https://example.com/', { title:'Inicio', description:'', canonical:null, robots:'noindex,follow', lang:'', viewport:'', headings:[] })];
  const crawl = { startUrl:'https://example.com/', discovered:1, errors:[], discovery:{ robots:{status:404,url:'https://example.com/robots.txt',body:''}, sitemapUrls:[], urls:[] } };
  const seo = buildSeoSummary({ pages, crawl });
  assert.equal(seo.coverage.noindex, 1);
  assert.equal(seo.metadata.missingDescriptions, 1);
  assert.equal(seo.metadata.missingCanonicals, 1);
  assert.equal(seo.metadata.missingLang, 1);
  assert.equal(seo.metadata.missingViewport, 1);
  assert.equal(seo.headings.pagesMissingH1, 1);
});
