import test from 'node:test';
import assert from 'node:assert/strict';
import { isBlockedIp, normalizeUrl } from '../lib/security/url-guard.js';

test('bloquea rangos IPv4 privados, locales y reservados', () => {
  for (const ip of ['127.0.0.1','10.0.0.1','172.16.0.1','192.168.1.1','169.254.1.1','100.64.0.1','224.0.0.1']) {
    assert.equal(isBlockedIp(ip), true, ip);
  }
  assert.equal(isBlockedIp('8.8.8.8'), false);
});

test('bloquea IPv6 local y permite una IPv6 pública', () => {
  for (const ip of ['::1','fc00::1','fe80::1','ff02::1','2001:db8::1','::ffff:127.0.0.1']) assert.equal(isBlockedIp(ip), true, ip);
  assert.equal(isBlockedIp('2606:4700:4700::1111'), false);
});

test('normaliza dominios y elimina credenciales y fragmentos', () => {
  const url = normalizeUrl('https://user:pass@example.com/path#secret');
  assert.equal(url.protocol, 'https:');
  assert.equal(url.hostname, 'example.com');
  assert.equal(url.username, '');
  assert.equal(url.password, '');
  assert.equal(url.hash, '');
});

test('rechaza protocolos y hosts locales', () => {
  assert.throws(() => normalizeUrl('file:///etc/passwd'), /HTTP o HTTPS/);
  assert.throws(() => normalizeUrl('http://localhost/admin'), /bloqueado/);
  assert.throws(() => normalizeUrl('http://service.localhost'), /bloqueado/);
});
