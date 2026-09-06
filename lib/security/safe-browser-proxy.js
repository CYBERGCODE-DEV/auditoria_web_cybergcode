import http from 'node:http';
import https from 'node:https';
import net from 'node:net';
import { resolvePublicUrl } from './url-guard.js';

const ALLOWED_PORTS = new Set([80, 443]);
const MAX_RESOURCE_BYTES = 15 * 1024 * 1024;

function targetPort(url) {
  return Number(url.port || (url.protocol === 'https:' ? 443 : 80));
}

function assertAllowedPort(port) {
  if (!ALLOWED_PORTS.has(Number(port))) throw new Error(`Puerto ${port} bloqueado por la política SSRF.`);
}

function cleanHeaders(headers = {}) {
  const next = { ...headers };
  for (const key of ['proxy-authorization','proxy-connection','connection','keep-alive','transfer-encoding','upgrade']) delete next[key];
  return next;
}

async function proxyHttpRequest(request, response) {
  try {
    const { url, records } = await resolvePublicUrl(request.url);
    const port = targetPort(url);
    assertAllowedPort(port);
    const selected = records[0];
    const client = url.protocol === 'https:' ? https : http;
    const upstream = client.request(url, {
      method:request.method,
      headers:{ ...cleanHeaders(request.headers), host:url.host },
      servername:url.hostname,
      lookup:(_hostname, options, callback) => options?.all ? callback(null, [selected]) : callback(null, selected.address, selected.family),
      timeout:30000
    }, (incoming) => {
      response.writeHead(incoming.statusCode || 502, cleanHeaders(incoming.headers));
      let transferred = 0;
      incoming.on('data', (chunk) => {
        transferred += chunk.length;
        if (transferred > MAX_RESOURCE_BYTES) incoming.destroy(new Error('Recurso bloqueado por límite de tamaño.'));
      });
      incoming.pipe(response);
    });
    upstream.on('timeout', () => upstream.destroy(new Error('Timeout del proxy seguro.')));
    upstream.on('error', () => { if (!response.headersSent) response.writeHead(502); response.end(); });
    request.pipe(upstream);
  } catch {
    response.writeHead(403, { 'content-type':'text/plain', connection:'close' });
    response.end('Destino bloqueado por la política SSRF.');
  }
}

async function proxyTunnel(request, clientSocket, head) {
  try {
    const separator = request.url.lastIndexOf(':');
    const hostname = separator > 0 ? request.url.slice(0, separator).replace(/^\[|\]$/g, '') : request.url;
    const port = separator > 0 ? Number(request.url.slice(separator + 1)) : 443;
    assertAllowedPort(port);
    const { records } = await resolvePublicUrl(`https://${hostname}:${port}`);
    const selected = records[0];
    const upstream = net.connect({ host:selected.address, port, timeout:30000 }, () => {
      clientSocket.write('HTTP/1.1 200 Connection Established\r\n\r\n');
      if (head?.length) upstream.write(head);
      upstream.pipe(clientSocket);
      clientSocket.pipe(upstream);
    });
    upstream.on('timeout', () => upstream.destroy());
    upstream.on('error', () => clientSocket.destroy());
    clientSocket.on('error', () => upstream.destroy());
  } catch {
    clientSocket.end('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n');
  }
}

export async function startSafeBrowserProxy() {
  const server = http.createServer((request, response) => void proxyHttpRequest(request, response));
  server.on('connect', (request, socket, head) => void proxyTunnel(request, socket, head));
  server.on('clientError', (_error, socket) => socket.destroy());
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const address = server.address();
  return {
    url:`http://127.0.0.1:${address.port}`,
    close:() => new Promise((resolve) => server.close(() => resolve()))
  };
}
