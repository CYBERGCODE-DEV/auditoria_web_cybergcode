import { assertPublicUrl } from './url-guard.js';

const DEFAULT_TIMEOUT = 12000;
const MAX_REDIRECTS = 5;
const MAX_BYTES = 2_500_000;

export async function safeFetch(input, options = {}) {
  let current = await assertPublicUrl(input);
  const redirects = [];
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT;

  for (let i = 0; i <= MAX_REDIRECTS; i += 1) {
    current = await assertPublicUrl(current);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    let response;
    try {
      response = await fetch(current, {
        method: options.method ?? 'GET',
        headers: {
          'user-agent': 'CYBERGCODE-Web-Audit/0.6 (+https://cybergcode.com)',
          'accept-language': 'es-PE,es;q=0.9,en;q=0.7',
          accept: options.accept ?? 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          ...(options.headers ?? {})
        },
        redirect: 'manual',
        signal: controller.signal
      });
    } finally {
      clearTimeout(timeout);
    }

    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get('location');
      if (!location) return { response, url: current, redirects, body: '' };
      const next = new URL(location, current);
      redirects.push({ from: current.href, to: next.href, status: response.status });
      current = next;
      continue;
    }

    let body = '';
    if ((options.method ?? 'GET') !== 'HEAD') {
      const contentLength = Number(response.headers.get('content-length') || 0);
      if (contentLength > MAX_BYTES) throw new Error('La respuesta excede el límite de análisis de 2.5 MB.');
      const buffer = Buffer.from(await response.arrayBuffer());
      if (buffer.byteLength > MAX_BYTES) throw new Error('La respuesta excede el límite de análisis de 2.5 MB.');
      body = buffer.toString('utf8');
    }
    return { response, url: current, redirects, body };
  }
  throw new Error(`Se superó el límite de ${MAX_REDIRECTS} redirecciones.`);
}
