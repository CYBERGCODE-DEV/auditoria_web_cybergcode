import * as cheerio from 'cheerio';
import { safeFetch } from '../security/safe-fetch.js';

const MAX_IMAGE_BYTES = 600_000;

function absolute(value, base) {
  try { return value ? new URL(value, base).href : null; } catch { return null; }
}

function scoreLogoCandidate({ src, alt = '', id = '', className = '', width = 0, height = 0, context = '' }, hostname) {
  const haystack = `${src || ''} ${alt} ${id} ${className} ${context}`.toLowerCase();
  let score = 0;
  if (/logo|brand|marca|header-logo|site-logo|branding/.test(haystack)) score += 14;
  if (/header|navbar|nav|topbar|masthead/.test(context.toLowerCase())) score += 5;
  if (hostname && haystack.includes(hostname.split('.')[0])) score += 5;
  if (/icon|favicon/.test(haystack)) score -= 2;
  if (width && height && width / Math.max(height, 1) >= 1.6) score += 3;
  if (width >= 120) score += 2;
  return score;
}

async function safeFetchImageDataUrl(input) {
  const result = await safeFetch(input, {
    timeoutMs:9000,
    maxBytes:MAX_IMAGE_BYTES,
    accept:'image/avif,image/webp,image/png,image/svg+xml,image/jpeg,image/*;q=0.8,*/*;q=0.2'
  });
  if (!result.response.ok) return null;
  const type = (result.response.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
  if (!type.startsWith('image/')) return null;
  const bytes = result.buffer;
  return { dataUrl:`data:${type};base64,${bytes.toString('base64')}`, contentType:type, bytes:bytes.byteLength, sourceUrl:result.url.href };
}

export async function inspectSiteIdentity(input) {
  const { response, url, body } = await safeFetch(input, { timeoutMs: 12000 });
  const $ = cheerio.load(body || '');
  const hostname = url.hostname.replace(/^www\./, '');
  const title = ($('title').first().text() || '').replace(/\s+/g, ' ').trim();
  const candidates = [];

  $('img').slice(0, 160).each((_, node) => {
    const el = $(node);
    const rawSrc = el.attr('src') || el.attr('data-src') || el.attr('data-lazy-src') || String(el.attr('srcset') || '').split(',')[0]?.trim().split(/\s+/)[0];
    const src = absolute(rawSrc, url);
    if (!src) return;
    const parent = el.closest('header,nav,[role="banner"],.header,.navbar,.topbar,.masthead');
    const candidate = {
      src,
      alt: el.attr('alt') || '',
      id: el.attr('id') || '',
      className: el.attr('class') || '',
      context: `${parent.attr('id') || ''} ${parent.attr('class') || ''} ${parent.attr('role') || ''}`,
      width: Number(el.attr('width') || 0),
      height: Number(el.attr('height') || 0),
      kind: 'image'
    };
    candidate.score = scoreLogoCandidate(candidate, hostname);
    candidates.push(candidate);
  });

  // Logo hints from structured/meta declarations. These are still published by the target site.
  const metaLogo = absolute($('meta[itemprop="logo"]').attr('content') || $('link[rel="logo"]').attr('href'), url);
  if (metaLogo) candidates.push({ src: metaLogo, kind: 'meta-logo', score: 18 });

  $('script[type="application/ld+json"]').slice(0, 30).each((_, node) => {
    try {
      const parsed = JSON.parse($(node).text());
      const stack = Array.isArray(parsed) ? [...parsed] : [parsed];
      while (stack.length) {
        const item = stack.shift();
        if (!item || typeof item !== 'object') continue;
        const logo = typeof item.logo === 'string' ? item.logo : item.logo?.url || item.logo?.contentUrl;
        const src = absolute(logo, url);
        if (src) candidates.push({ src, kind: 'jsonld-logo', score: 22 });
        if (Array.isArray(item['@graph'])) stack.push(...item['@graph']);
      }
    } catch { /* malformed JSON-LD does not block identity detection */ }
  });

  const iconSelectors = ['link[rel~="icon"]','link[rel="shortcut icon"]','link[rel="apple-touch-icon"]'];
  for (const selector of iconSelectors) {
    $(selector).each((_, node) => {
      const src = absolute($(node).attr('href'), url);
      if (src) candidates.push({ src, kind: 'icon', score: selector.includes('apple') ? 5 : 3 });
    });
  }
  const ogImage = absolute($('meta[property="og:image"]').attr('content'), url);
  if (ogImage) candidates.push({ src: ogImage, kind: 'og-image', score: 2 });
  candidates.push({ src: absolute('/favicon.ico', url), kind: 'favicon-fallback', score: 1 });

  candidates.sort((a,b) => b.score - a.score);
  let visual = null;
  for (const candidate of candidates.slice(0, 12)) {
    try {
      visual = await safeFetchImageDataUrl(candidate.src);
      if (visual) { visual.kind = candidate.kind; break; }
    } catch { /* try next candidate */ }
  }

  return {
    status: response.status,
    requestedUrl: String(input),
    finalUrl: url.href,
    hostname,
    title,
    visual,
    provenance: visual ? 'HTML logo/icon discovery + protected image fetch' : 'HTML title + hostname fallback'
  };
}
