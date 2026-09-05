import * as cheerio from 'cheerio';
import { safeFetch } from '../security/safe-fetch.js';
import { assertPublicUrl, normalizeUrl } from '../security/url-guard.js';
import { auditPage } from './page-audit.js';
import { discoverFromRobotsAndSitemap } from './discovery.js';
import { canonicalCrawlKey } from './crawl-utils.js';

const SKIP_EXT = /\.(?:jpg|jpeg|png|gif|webp|avif|svg|pdf|zip|rar|7z|mp4|webm|mp3|wav|woff2?|ttf|eot|ico|xml)(?:$|\?)/i;

function internalLinks(html, pageUrl, origin) {
  const $ = cheerio.load(html || '');
  const links = [];
  $('a[href]').each((_, node) => {
    try {
      const next = new URL($(node).attr('href'), pageUrl);
      next.hash = '';
      if (!['http:', 'https:'].includes(next.protocol) || next.origin !== origin || SKIP_EXT.test(next.pathname)) return;
      links.push(next.href);
    } catch { /* malformed URL */ }
  });
  return [...new Set(links)].sort((a,b) => a.localeCompare(b));
}

export async function initializeLargeCrawl(input, { maxPages = 100 } = {}) {
  const start = await assertPublicUrl(normalizeUrl(input));
  const origin = start.origin;
  const discovery = await discoverFromRobotsAndSitemap(origin);
  const max = Math.min(Math.max(Number(maxPages) || 100, 51), 500);
  const candidates = [start.href, ...[...discovery.urls].sort((a,b) => a.localeCompare(b))];
  const queue = [];
  const seen = new Set();
  for (const url of candidates) {
    try {
      const key = canonicalCrawlKey(url);
      if (seen.has(key)) continue;
      seen.add(key);
      queue.push(url);
      if (queue.length >= max * 3) break;
    } catch { /* ignore */ }
  }
  return { startUrl: start.href, origin, maxPages: max, queue, discovery };
}

async function auditOne(url, origin) {
  try {
    const result = await safeFetch(url);
    const contentType = result.response.headers.get('content-type') || '';
    if (!/text\/html|application\/xhtml\+xml/i.test(contentType)) {
      return { ok: false, url, error: `Content-Type no HTML: ${contentType || 'desconocido'}`, links: [] };
    }
    const page = auditPage({ html: result.body, pageUrl: result.url.href, response: result.response, redirects: result.redirects });
    return { ok: true, page, links: internalLinks(result.body, result.url.href, origin) };
  } catch (error) {
    return { ok: false, url, error: error?.name === 'AbortError' ? 'Tiempo de espera agotado.' : String(error?.message || error), links: [] };
  }
}

async function inPool(items, concurrency, worker) {
  const results = new Array(items.length);
  let cursor = 0;
  async function runner() {
    while (cursor < items.length) {
      const index = cursor++;
      results[index] = await worker(items[index], index);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, Math.max(1, items.length)) }, runner));
  return results;
}

export async function processLargeCrawlBatch(job, { batchSize = 20, concurrency = 5 } = {}) {
  const queue = Array.isArray(job.queue) ? [...job.queue] : [];
  const visited = new Set(job.visitedKeys || []);
  const known = new Set([...visited]);
  for (const url of queue) {
    try { known.add(canonicalCrawlKey(url)); } catch { /* ignore */ }
  }

  const selected = [];
  while (queue.length && selected.length < batchSize && Number(job.processedCount || 0) + selected.length < job.maxPages) {
    const candidate = queue.shift();
    let key;
    try { key = canonicalCrawlKey(candidate); } catch { continue; }
    if (visited.has(key)) continue;
    visited.add(key);
    selected.push(candidate);
  }

  const results = await inPool(selected, concurrency, (url) => auditOne(url, job.origin));
  const pages = [];
  const errors = [];
  for (const result of results) {
    if (result?.ok && result.page) pages.push(result.page);
    else if (result) errors.push({ url: result.url, error: result.error });
    for (const link of result?.links || []) {
      if (queue.length >= job.maxPages * 4) break;
      try {
        const key = canonicalCrawlKey(link);
        if (known.has(key)) continue;
        known.add(key);
        queue.push(link);
      } catch { /* ignore */ }
    }
  }

  const processedCount = Number(job.processedCount || 0) + selected.length;
  const successfulCount = Number(job.successfulCount || 0) + pages.length;
  const failedCount = Number(job.failedCount || 0) + errors.length;
  const exhausted = queue.length === 0;
  const reachedLimit = processedCount >= job.maxPages;
  return {
    pages,
    errors,
    next: {
      ...job,
      queue,
      visitedKeys: [...visited].slice(-job.maxPages * 5),
      processedCount,
      successfulCount,
      failedCount,
      discoveredCount: known.size,
      status: (exhausted || reachedLimit) ? 'crawl-complete' : 'crawling',
      updatedAt: new Date().toISOString(),
      crawlCompleteReason: reachedLimit ? 'page-limit' : (exhausted ? 'queue-exhausted' : null)
    }
  };
}
