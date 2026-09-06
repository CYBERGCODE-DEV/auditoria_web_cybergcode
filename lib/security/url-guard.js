import dns from 'node:dns/promises';
import net from 'node:net';

const BLOCKED_HOSTNAMES = new Set([
  'localhost',
  'localhost.localdomain',
  'metadata.google.internal',
  'metadata',
  'host.docker.internal'
]);

function isPrivateIPv4(ip) {
  const p = ip.split('.').map(Number);
  if (p.length !== 4 || p.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return true;
  if (p[0] === 10 || p[0] === 127 || p[0] === 0) return true;
  if (p[0] === 169 && p[1] === 254) return true;
  if (p[0] === 172 && p[1] >= 16 && p[1] <= 31) return true;
  if (p[0] === 192 && p[1] === 168) return true;
  if (p[0] === 100 && p[1] >= 64 && p[1] <= 127) return true;
  if (p[0] === 198 && (p[1] === 18 || p[1] === 19)) return true;
  if (p[0] >= 224) return true;
  return false;
}

function isPrivateIPv6(ip) {
  const value = ip.toLowerCase().split('%')[0];
  if (value === '::' || value === '::1') return true;
  if (value.startsWith('fc') || value.startsWith('fd')) return true;
  if (/^fe[89ab]/.test(value)) return true;
  if (value.startsWith('ff')) return true;
  if (value.startsWith('2001:db8')) return true;
  const mapped = value.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  return mapped ? isPrivateIPv4(mapped[1]) : false;
}

export function isBlockedIp(ip) {
  const version = net.isIP(ip);
  if (version === 4) return isPrivateIPv4(ip);
  if (version === 6) return isPrivateIPv6(ip);
  return true;
}

export function normalizeUrl(input) {
  const raw = String(input ?? '').trim();
  if (!raw) throw new Error('Debes indicar un dominio o URL.');
  const schemeMatch = raw.match(/^([a-z][a-z0-9+.-]*):/i);
  if (schemeMatch && !['http', 'https'].includes(schemeMatch[1].toLowerCase())) {
    throw new Error('Solo se permiten URLs HTTP o HTTPS.');
  }
  const candidate = schemeMatch ? raw : `https://${raw}`;
  const url = new URL(candidate);
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error('Solo se permiten URLs HTTP o HTTPS.');
  url.username = '';
  url.password = '';
  url.hash = '';
  if (BLOCKED_HOSTNAMES.has(url.hostname.toLowerCase()) || url.hostname.endsWith('.localhost')) {
    throw new Error('El destino solicitado está bloqueado por seguridad.');
  }
  return url;
}

export async function assertPublicUrl(input) {
  const { url } = await resolvePublicUrl(input);
  return url;
}

export async function resolvePublicUrl(input) {
  const url = input instanceof URL ? input : normalizeUrl(input);
  if (net.isIP(url.hostname)) {
    if (isBlockedIp(url.hostname)) throw new Error('No se permiten redes privadas, locales o reservadas.');
    return { url, records:[{ address:url.hostname, family:net.isIP(url.hostname) }] };
  }
  const records = await dns.lookup(url.hostname, { all: true, verbatim: true });
  if (!records.length) throw new Error('No se pudo resolver el dominio.');
  for (const record of records) {
    if (isBlockedIp(record.address)) throw new Error('El dominio resuelve hacia una red privada, local o reservada.');
  }
  return { url, records };
}
