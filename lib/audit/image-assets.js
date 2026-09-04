import { safeFetch } from '../security/safe-fetch.js';

export async function inspectImageAssets(pages, maxAssets = 30) {
  const urls = [...new Set(pages.flatMap((p) => p.images.map((img) => img.src).filter(Boolean)))].slice(0, maxAssets);
  const results = new Map();
  const concurrency = 4;
  let cursor = 0;

  async function worker() {
    while (cursor < urls.length) {
      const index = cursor++;
      const url = urls[index];
      try {
        const result = await safeFetch(url, { method: 'HEAD', accept: 'image/*,*/*;q=0.2', timeoutMs: 8000 });
        results.set(url, {
          status: result.response.status,
          contentType: result.response.headers.get('content-type') || null,
          contentLength: Number(result.response.headers.get('content-length') || 0) || null,
          finalUrl: result.url.href,
          redirects: result.redirects.length
        });
      } catch (error) {
        results.set(url, { status: null, error: error.message, contentType: null, contentLength: null, finalUrl: null, redirects: 0 });
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, urls.length || 1) }, worker));

  for (const page of pages) {
    for (const image of page.images) Object.assign(image, results.get(image.src) || { status: null, contentType: null, contentLength: null });
  }
  return { inspected: urls.length, totalUnique: [...new Set(pages.flatMap((p) => p.images.map((img) => img.src).filter(Boolean)))].length };
}
