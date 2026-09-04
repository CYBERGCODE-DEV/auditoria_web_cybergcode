import * as cheerio from 'cheerio';
import { safeFetch } from '../security/safe-fetch.js';
import { assertPublicUrl } from '../security/url-guard.js';

const MAX_IMAGE_BYTES = 600_000;
const MAX_REDIRECTS = 4;

function absolute(value, base) {
  try { return value ? new URL(value, base).href : null; } catch { return null; }
}

function scoreLogoCandidate({ src, alt = '', id = '', className = '', width = 0, height = 0 }, hostname) {
  const haystack = `${src || ''} ${alt} ${id} ${className}`.toLowerCase();
  let score = 0;
  if (/logo|brand|marca|header-logo|site-logo/.test(haystack)) score += 12;
  if (hostname && haystack.includes(hostname.split('.')[0])) score += 5;
  if (/icon|favicon/.test(haystack)) score -= 2;
  if (width && height && width / Math.max(height, 1) >= 1.6) score += 3;
  if (width >= 120) score += 2;
  return score;
}

async function safeFetchImageDataUrl(input) {
  let current = await assertPublicUrl(input);
  for (let i = 0; i <= MAX_REDIRECTS; i += 1) {
    current = await assertPublicUrl(current);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 9000);
    let response;
    try {
      response = await fetch(current, {
        redirect: 'manual',
        signal: controller.signal,
        headers: { 'user-agent': 'CYBERGCODE-Web-Audit/0.8 (+https://cybergcode.com)', accept: 'image/avif,image/webp,image/png,image/svg+xml,image/jpeg,image/*;q=0.8,*/*;q=0.2' }
      });
    } finally { clearTimeout(timeout); }

    if ([301,302,303,307,308].includes(response.status)) {
      const location = response.headers.get('location');
      if (!location) return null;
      current = new URL(location, current);
      continue;
    }
    if (!response.ok) return null;
    const type = (response.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
    if (!type.startsWith('image/')) return null;
    const declared = Number(response.headers.get('content-length') || 0);
    if (declared > MAX_IMAGE_BYTES) return null;
    const bytes = Buffer.from(await response.arrayBuffer());
    if (bytes.byteLength > MAX_IMAGE_BYTES) return null;
    return { dataUrl: `data:${type};base64,${bytes.toString('base64')}`, contentType: type, bytes: bytes.byteLength, sourceUrl: current.href };
  }
  return null;
}

export async function inspectSiteIdentity(input) {
  const { response, url, body } = await safeFetch(input, { timeoutMs: 12000 });
  const $ = cheerio.load(body || '');
  const hostname = url.hostname.replace(/^www\./, '');
  const title = ($('title').first().text() || '').replace(/\s+/g, ' ').trim();
  const candidates = [];

  $('img[src]').slice(0, 120).each((_, node) => {
    const el = $(node);
    const src = absolute(el.attr('src'), url);
    if (!src) return;
    const candidate = {
      src,
      alt: el.attr('alt') || '',
      id: el.attr('id') || '',
      className: el.attr('class') || '',
      width: Number(el.attr('width') || 0),
      height: Number(el.attr('height') || 0),
      kind: 'image'
    };
    candidate.score = scoreLogoCandidate(candidate, hostname);
    candidates.push(candidate);
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
  for (const candidate of candidates.slice(0, 8)) {
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
