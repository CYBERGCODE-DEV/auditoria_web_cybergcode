import test from 'node:test';
import assert from 'node:assert/strict';
import { isBlockedIp, normalizeUrl } from '../lib/security/url-guard.js';

test('normaliza dominios sin protocolo a https', () => {
  assert.equal(normalizeUrl('example.com').href, 'https://example.com/');
});

test('rechaza esquemas no HTTP', () => {
  assert.throws(() => normalizeUrl('file:///etc/passwd'), /Solo se permiten/);
  assert.throws(() => normalizeUrl('javascript:alert(1)'), /Solo se permiten/);
});

test('identifica rangos IPv4 privados o reservados', () => {
  for (const ip of ['127.0.0.1','10.0.0.1','172.16.0.1','192.168.1.1','169.254.169.254','0.0.0.0']) {
    assert.equal(isBlockedIp(ip), true, ip);
  }
  assert.equal(isBlockedIp('8.8.8.8'), false);
});

test('identifica IPv6 local/private', () => {
  assert.equal(isBlockedIp('::1'), true);
  assert.equal(isBlockedIp('fd00::1'), true);
  assert.equal(isBlockedIp('fe80::1'), true);
});
