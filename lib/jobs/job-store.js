import zlib from 'node:zlib';

const memory = new Map();
export const LARGE_JOB_TTL_SECONDS = 2 * 60 * 60;
export const RUNTIME_CACHE_SAFE_ITEM_BYTES = 1_650_000;
const NAMESPACE_PREFIX = 'cybergcode-large-audit';

function encode(value) {
  const raw = Buffer.from(JSON.stringify(value), 'utf8');
  return { format: 'gzip-base64', data: zlib.gzipSync(raw, { level: 6 }).toString('base64') };
}

function decode(value) {
  if (!value) return null;
  if (value.format !== 'gzip-base64' || typeof value.data !== 'string') return value;
  return JSON.parse(zlib.gunzipSync(Buffer.from(value.data, 'base64')).toString('utf8'));
}

async function runtimeCache() {
  if (!process.env.VERCEL) return null;
  try {
    const { getCache } = await import('@vercel/functions');
    const project = process.env.VERCEL_PROJECT_ID || process.env.VERCEL_PROJECT_PRODUCTION_URL || 'default';
    return getCache({ namespace: `${NAMESPACE_PREFIX}:${project}` });
  } catch (error) {
    console.warn('[job-store] Runtime Cache no disponible:', error?.message || error);
    return null;
  }
}

function memoryGet(key) {
  const item = memory.get(key);
  if (!item) return null;
  if (item.expiresAt <= Date.now()) { memory.delete(key); return null; }
  return decode(item.value);
}

async function get(key) {
  const runtime = await runtimeCache();
  if (runtime) {
    try { return decode(await runtime.get(key)); }
    catch (error) { console.warn('[job-store] lectura:', error?.message || error); }
  }
  return memoryGet(key);
}

async function set(key, value, ttl = LARGE_JOB_TTL_SECONDS) {
  const encoded = encode(value);
  const runtime = await runtimeCache();
  if (runtime) {
    try {
      await runtime.set(key, encoded, { ttl, tags: ['cybergcode-large-jobs'], name: 'CYBERGCODE large audit job' });
      return true;
    } catch (error) { console.warn('[job-store] escritura:', error?.message || error); }
  }
  memory.set(key, { value: encoded, expiresAt: Date.now() + ttl * 1000 });
  return true;
}

const stateKey = (id) => `job:${id}:state`;
const chunkKey = (id, index) => `job:${id}:chunk:${index}`;
const chunkPartKey = (id, index, part) => `job:${id}:chunk:${index}:part:${part}`;
const resultKey = (id) => `job:${id}:result`;
const resultPartKey = (id, part) => `job:${id}:result:part:${part}`;

function encodedBytes(value) {
  const encoded = encode(value);
  return Buffer.byteLength(JSON.stringify(encoded), 'utf8');
}

function compactOversizedPage(page) {
  return {
    ...page,
    headings: Array.isArray(page?.headings) ? page.headings.slice(0, 80) : page?.headings,
    images: Array.isArray(page?.images) ? page.images.slice(0, 120) : page?.images,
    links: Array.isArray(page?.links) ? page.links.slice(0, 500) : page?.links,
    hreflang: Array.isArray(page?.hreflang) ? page.hreflang.slice(0, 30) : page?.hreflang,
    findings: Array.isArray(page?.findings) ? page.findings.slice(0, 250) : page?.findings,
    jobStorage: {
      truncated: true,
      reason: 'runtime-cache-item-limit',
      note: 'El detalle extremadamente grande se limitó para almacenamiento temporal del job; los conteos agregados del rastreo no se rellenan con datos ficticios.'
    }
  };
}

function splitForRuntimeCache(pages) {
  const parts = [];
  let current = [];
  let compactedPages = 0;
  for (const original of pages || []) {
    let page = original;
    if (encodedBytes([page]) > RUNTIME_CACHE_SAFE_ITEM_BYTES) {
      page = compactOversizedPage(page);
      compactedPages += 1;
    }
    const candidate = [...current, page];
    if (current.length && encodedBytes(candidate) > RUNTIME_CACHE_SAFE_ITEM_BYTES) {
      parts.push(current);
      current = [page];
    } else {
      current = candidate;
    }
  }
  if (current.length) parts.push(current);
  return { parts, compactedPages };
}

export async function getJob(id) { return get(stateKey(id)); }
export async function setJob(job) { return set(stateKey(job.id), job); }
export async function setJobChunk(id, index, pages) {
  const { parts, compactedPages } = splitForRuntimeCache(pages);
  if (parts.length <= 1) {
    await set(chunkKey(id, index), parts[0] || []);
    return { split:false, parts:1, compactedPages };
  }
  for (let i = 0; i < parts.length; i += 1) await set(chunkPartKey(id, index, i), parts[i]);
  await set(chunkKey(id, index), { format:'chunk-manifest-v1', parts:parts.length, compactedPages });
  return { split:true, parts:parts.length, compactedPages };
}
export async function getJobChunk(id, index) {
  const value = await get(chunkKey(id, index));
  if (!value || value.format !== 'chunk-manifest-v1') return value;
  const pages = [];
  for (let i = 0; i < Number(value.parts || 0); i += 1) {
    const part = await get(chunkPartKey(id, index, i));
    if (Array.isArray(part)) pages.push(...part);
  }
  return pages;
}
export async function setJobResult(id, result) {
  if (encodedBytes(result) <= RUNTIME_CACHE_SAFE_ITEM_BYTES) {
    await set(resultKey(id), result);
    return { split:false, parts:1 };
  }
  const compressed = zlib.gzipSync(Buffer.from(JSON.stringify(result), 'utf8'), { level:6 }).toString('base64');
  const partSize = 900_000;
  const parts = [];
  for (let offset = 0; offset < compressed.length; offset += partSize) parts.push(compressed.slice(offset, offset + partSize));
  for (let i = 0; i < parts.length; i += 1) await set(resultPartKey(id, i), { format:'result-part-v1', data:parts[i] });
  await set(resultKey(id), { format:'result-manifest-v1', parts:parts.length });
  return { split:true, parts:parts.length };
}
export async function getJobResult(id) {
  const value = await get(resultKey(id));
  if (!value || value.format !== 'result-manifest-v1') return value;
  let payload = '';
  for (let i = 0; i < Number(value.parts || 0); i += 1) {
    const part = await get(resultPartKey(id, i));
    if (!part || part.format !== 'result-part-v1') return null;
    payload += part.data || '';
  }
  return JSON.parse(zlib.gunzipSync(Buffer.from(payload, 'base64')).toString('utf8'));
}

export async function readAllJobPages(job) {
  const pages = [];
  for (let i = 0; i < Number(job.chunkCount || 0); i += 1) {
    const chunk = await getJobChunk(job.id, i);
    if (Array.isArray(chunk)) pages.push(...chunk);
  }
  return pages;
}

export function jobProgress(job) {
  const max = Math.max(1, Number(job.maxPages || 1));
  const processed = Number(job.processedCount || 0);
  const crawlRatio = Math.min(1, processed / max);
  if (job.status === 'completed') return 100;
  if (job.status === 'failed' || job.status === 'cancelled') return Math.min(99, Math.max(1, Math.round(crawlRatio * 85)));
  if (job.status === 'finalizing') return 94;
  if (job.status === 'crawl-complete') return 90;
  return Math.max(1, Math.round(crawlRatio * 88));
}
