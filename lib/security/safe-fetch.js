import http from 'node:http';
import https from 'node:https';
import zlib from 'node:zlib';
import { resolvePublicUrl } from './url-guard.js';

const DEFAULT_TIMEOUT = 12000;
const MAX_REDIRECTS = 5;
const MAX_BYTES = 2_500_000;

function decodeBody(buffer, encoding) {
  const value = String(encoding || '').toLowerCase();
  if (value.includes('gzip')) return zlib.gunzipSync(buffer);
  if (value.includes('br')) return zlib.brotliDecompressSync(buffer);
  if (value.includes('deflate')) return zlib.inflateSync(buffer);
  return buffer;
}

async function pinnedRequest(input, options = {}) {
  const { url, records } = await resolvePublicUrl(input);
  const selected = records[0];
  const client = url.protocol === 'https:' ? https : http;
  const maxBytes = Math.max(1, Number(options.maxBytes || MAX_BYTES));
  return await new Promise((resolve, reject) => {
    const request = client.request(url, {
      method:options.method || 'GET', headers:options.headers, servername:url.hostname,
      lookup:(_hostname, lookupOptions, callback) => lookupOptions?.all
        ? callback(null, [selected])
        : callback(null, selected.address, selected.family),
      timeout:options.timeoutMs
    }, (incoming) => {
      const headers = new Headers();
      for (const [name, value] of Object.entries(incoming.headers)) {
        if (Array.isArray(value)) for (const item of value) headers.append(name, item);
        else if (value != null) headers.set(name, String(value));
      }
      const declared = Number(headers.get('content-length') || 0);
      if ((options.method || 'GET') !== 'HEAD' && declared > maxBytes) { incoming.destroy(); reject(new Error('La respuesta excede el límite de análisis permitido.')); return; }
      const chunks = [];
      let bytes = 0;
      incoming.on('data', (chunk) => {
        bytes += chunk.length;
        if (bytes > maxBytes) { incoming.destroy(new Error('La respuesta excede el límite de análisis permitido.')); return; }
        chunks.push(chunk);
      });
      incoming.on('end', () => {
        try {
          const buffer = decodeBody(Buffer.concat(chunks), headers.get('content-encoding'));
          if (buffer.byteLength > maxBytes) throw new Error('La respuesta descomprimida excede el límite de análisis permitido.');
          resolve({ response:{ status:incoming.statusCode || 0, ok:(incoming.statusCode || 0) >= 200 && (incoming.statusCode || 0) < 300, headers }, url, buffer });
        } catch (error) { reject(error); }
      });
      incoming.on('error', reject);
    });
    request.on('timeout', () => request.destroy(Object.assign(new Error('Tiempo de espera agotado.'), { name:'AbortError' })));
    request.on('error', reject);
    request.end();
  });
}

export async function safeFetch(input, options = {}) {
  let current = input;
  const redirects = [];
  const method = options.method ?? 'GET';
  const headers = {
    'user-agent':'CYBERGCODE-Web-Audit/0.17.1 (+https://cybergcode.com)',
    'accept-language':'es-PE,es;q=0.9,en;q=0.7', 'accept-encoding':'identity',
    accept:options.accept ?? 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8', ...(options.headers ?? {})
  };
  for (let index = 0; index <= MAX_REDIRECTS; index += 1) {
    const result = await pinnedRequest(current, { method, headers, timeoutMs:options.timeoutMs ?? DEFAULT_TIMEOUT, maxBytes:options.maxBytes });
    if ([301,302,303,307,308].includes(result.response.status)) {
      const location = result.response.headers.get('location');
      if (!location) return { ...result, redirects, body:'' };
      const next = new URL(location, result.url);
      redirects.push({ from:result.url.href, to:next.href, status:result.response.status });
      current = next;
      continue;
    }
    return { ...result, redirects, body:method === 'HEAD' ? '' : result.buffer.toString(options.encoding || 'utf8') };
  }
  throw new Error(`Se superó el límite de ${MAX_REDIRECTS} redirecciones.`);
}
