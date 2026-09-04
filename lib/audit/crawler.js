import * as cheerio from 'cheerio';
import { safeFetch } from '../security/safe-fetch.js';
import { assertPublicUrl, normalizeUrl } from '../security/url-guard.js';
import { auditPage } from './page-audit.js';
import { discoverFromRobotsAndSitemap } from './discovery.js';

function canonicalKey(url) {
  const u = new URL(url);
  u.hash = '';
  for (const key of [...u.searchParams.keys()]) {
    if (/^(utm_|fbclid|gclid)/i.test(key)) u.searchParams.delete(key);
  }
  return u.href.replace(/\/$/, '') || u.href;
}

function discoverLinks(html, pageUrl, origin) {
  const $ = cheerio.load(html || '');
  const links = [];
  $('a[href]').each((_, node) => {
    try {
      const next = new URL($(node).attr('href'), pageUrl);
      next.hash = '';
      if (!['http:', 'https:'].includes(next.protocol)) return;
      if (next.origin !== origin) return;
      if (/\.(?:jpg|jpeg|png|gif|webp|avif|svg|pdf|zip|mp4|mp3|woff2?|ttf)(?:$|\?)/i.test(next.pathname)) return;
      links.push(next.href);
    } catch { /* ignore malformed URL */ }
  });
  return links;
}

export async function crawlSite(input, { maxPages = 12 } = {}) {
  const start = await assertPublicUrl(normalizeUrl(input));
  let origin = start.origin;
  let discovery = null;
  const queue = [start.href];
  const queued = new Set([canonicalKey(start.href)]);
  const visited = new Set();
  const pages = [];
  const errors = [];
  const limit = Math.min(Math.max(Number(maxPages) || 1, 1), 50);

  while (queue.length && pages.length < limit) {
    const current = queue.shift();
    const key = canonicalKey(current);
    if (visited.has(key)) continue;
    visited.add(key);
    try {
      const result = await safeFetch(current);
      const contentType = result.response.headers.get('content-type') || '';
      const pageUrl = result.url.href;
      if (pages.length === 0) origin = new URL(pageUrl).origin;
      if (!/text\/html|application\/xhtml\+xml/i.test(contentType)) {
        errors.push({ url: current, error: `Content-Type no HTML: ${contentType || 'desconocido'}` });
        continue;
      }
      const page = auditPage({ html: result.body, pageUrl, response: result.response, redirects: result.redirects });
      pages.push(page);

      if (pages.length === 1) {
        discovery = await discoverFromRobotsAndSitemap(origin);
        for (const discoveredUrl of [...discovery.urls].sort((a,b) => a.localeCompare(b)).slice(0, limit * 3)) {
          const dKey = canonicalKey(discoveredUrl);
          if (!queued.has(dKey) && !visited.has(dKey)) { queued.add(dKey); queue.push(discoveredUrl); }
        }
      }

      for (const link of discoverLinks(result.body, pageUrl, origin).sort((a,b) => a.localeCompare(b))) {
        const linkKey = canonicalKey(link);
        if (!queued.has(linkKey) && !visited.has(linkKey) && queue.length < limit * 5) {
          queued.add(linkKey);
          queue.push(link);
        }
      }
    } catch (error) {
      errors.push({ url: current, error: error?.name === 'AbortError' ? 'Tiempo de espera agotado.' : error.message });
    }
  }

  return { startUrl: start.href, pages, errors, discovered: queued.size, limit, discovery };
}
