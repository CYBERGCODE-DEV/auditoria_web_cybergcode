import * as cheerio from 'cheerio';
import { safeFetch } from '../security/safe-fetch.js';

function sameOriginUrl(value, origin) {
  try {
    const url = new URL(value);
    if (url.origin !== origin) return null;
    if (!['http:', 'https:'].includes(url.protocol)) return null;
    url.hash = '';
    return url.href;
  } catch { return null; }
}

async function parseSitemap(url, origin, seen, depth = 0) {
  if (depth > 2 || seen.has(url)) return [];
  seen.add(url);
  try {
    const result = await safeFetch(url, { accept: 'application/xml,text/xml,text/plain,*/*;q=0.5' });
    if (!result.response.ok) return [];
    const $ = cheerio.load(result.body, { xmlMode: true });
    const locs = $('loc').map((_, node) => $(node).text().trim()).get().filter(Boolean);
    const isIndex = $('sitemapindex').length > 0;
    if (isIndex) {
      const nested = [];
      for (const loc of locs.slice(0, 12)) {
        const target = sameOriginUrl(loc, origin);
        if (target) nested.push(...await parseSitemap(target, origin, seen, depth + 1));
      }
      return nested;
    }
    return locs.map((loc) => sameOriginUrl(loc, origin)).filter(Boolean);
  } catch { return []; }
}

export async function discoverFromRobotsAndSitemap(origin) {
  const sitemaps = new Set([new URL('/sitemap.xml', origin).href]);
  let robots = { url: new URL('/robots.txt', origin).href, status: null, body: '' };
  try {
    const result = await safeFetch(robots.url, { accept: 'text/plain,*/*;q=0.2' });
    robots = { url: result.url.href, status: result.response.status, body: result.body };
    for (const line of result.body.split(/\r?\n/)) {
      const match = line.match(/^\s*Sitemap\s*:\s*(\S+)/i);
      if (match) {
        try {
          const candidate = new URL(match[1], origin);
          if (candidate.origin === origin) sitemaps.add(candidate.href);
        } catch { /* ignore */ }
      }
    }
  } catch { /* robots is optional */ }

  const seen = new Set();
  const urls = [];
  for (const sitemap of [...sitemaps].slice(0, 10)) {
    urls.push(...await parseSitemap(sitemap, origin, seen));
  }
  return { robots, sitemapUrls: [...sitemaps], urls: [...new Set(urls)] };
}
