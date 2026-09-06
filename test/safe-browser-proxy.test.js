import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { startSafeBrowserProxy } from '../lib/security/safe-browser-proxy.js';

function requestThroughProxy(proxyUrl, target) {
  const proxy = new URL(proxyUrl);
  return new Promise((resolve, reject) => {
    const request = http.request({ hostname:proxy.hostname, port:proxy.port, path:target, method:'GET' }, (response) => {
      response.resume();
      response.on('end', () => resolve(response.statusCode));
    });
    request.on('error', reject);
    request.end();
  });
}

test('el proxy de Chromium rechaza destinos privados antes de conectar', async () => {
  const proxy = await startSafeBrowserProxy();
  try {
    assert.equal(await requestThroughProxy(proxy.url, 'http://127.0.0.1/metadata'), 403);
    assert.equal(await requestThroughProxy(proxy.url, 'http://localhost/admin'), 403);
  } finally {
    await proxy.close();
  }
});
