import dns from 'node:dns/promises';
import { safeFetch } from '../security/safe-fetch.js';

const clean = (value) => String(value ?? '').replace(/\s+/g, ' ').trim();
let bootstrapCache = null;
let bootstrapExpiresAt = 0;

async function jsonFetch(url, timeoutMs = 8000) {
  const result = await safeFetch(url, { accept:'application/rdap+json,application/json', timeoutMs });
  if (!result.response.ok) throw new Error(`RDAP HTTP ${result.response.status}`);
  return JSON.parse(result.body);
}

async function rdapBootstrap() {
  if (bootstrapCache && bootstrapExpiresAt > Date.now()) return bootstrapCache;
  const data = await jsonFetch('https://data.iana.org/rdap/dns.json');
  bootstrapCache = data;
  bootstrapExpiresAt = Date.now() + 24 * 60 * 60 * 1000;
  return data;
}

function eventDate(events, actions) {
  const wanted = new Set(actions);
  const event = (events || []).find((item) => wanted.has(String(item.eventAction || '').toLowerCase()) && item.eventDate);
  return event?.eventDate || null;
}

function entityName(entity) {
  const card = entity?.vcardArray?.[1] || [];
  const fn = card.find((item) => item?.[0] === 'fn');
  return clean(fn?.[3] || entity?.handle || '');
}

function registrarFrom(entities = []) {
  const entity = entities.find((item) => (item.roles || []).includes('registrar'));
  if (!entity) return null;
  const publicId = (entity.publicIds || []).find((item) => /iana/i.test(item.type || ''));
  return { name:entityName(entity) || null, ianaId:publicId?.identifier || null, handle:entity.handle || null };
}

function daysBetween(future, now = Date.now()) {
  const timestamp = future ? new Date(future).getTime() : NaN;
  return Number.isFinite(timestamp) ? Math.ceil((timestamp - now) / 86400000) : null;
}

function ageDays(created, now = Date.now()) {
  const timestamp = created ? new Date(created).getTime() : NaN;
  return Number.isFinite(timestamp) ? Math.max(0, Math.floor((now - timestamp) / 86400000)) : null;
}

function candidateDomains(hostname) {
  const labels = hostname.toLowerCase().replace(/\.$/, '').split('.').filter(Boolean);
  const result = [];
  for (let index = 0; index <= labels.length - 2; index += 1) result.push(labels.slice(index).join('.'));
  return result;
}

export function parseDomainRdap(data, { domain, hostname = domain, sourceUrl = null, now = Date.now() } = {}) {
  const createdAt = eventDate(data?.events, ['registration']);
  const registryExpiresAt = eventDate(data?.events, ['expiration']);
  const registrarExpiresAt = eventDate(data?.events, ['registrar expiration']);
  const expiresAt = registrarExpiresAt || registryExpiresAt;
  return {
    status:'measured', source:'RDAP', sourceUrl, domain:data?.ldhName || domain,
    queriedHostname:hostname, isApexExact:(data?.ldhName || domain).toLowerCase() === hostname.toLowerCase(),
    createdAt, updatedAt:eventDate(data?.events, ['last changed']), transferredAt:eventDate(data?.events, ['transfer']),
    registryExpiresAt, registrarExpiresAt, expiresAt, daysRemaining:daysBetween(expiresAt, now), ageDays:ageDays(createdAt, now),
    registrar:registrarFrom(data?.entities), statuses:data?.status || [],
    nameservers:(data?.nameservers || []).map((item) => item.ldhName || item.unicodeName).filter(Boolean),
    dnssec:data?.secureDNS?.delegationSigned === true ? 'signed' : data?.secureDNS?.delegationSigned === false ? 'unsigned' : 'unavailable',
    notices:(data?.notices || []).map((item) => clean(item.title)).filter(Boolean).slice(0, 5), measuredAt:new Date(now).toISOString(),
    note:'La fecha de creación RDAP no demuestra cuándo adquirió el dominio su propietario actual.'
  };
}

export async function lookupDomainRegistration(hostname) {
  try {
    const bootstrap = await rdapBootstrap();
    const services = bootstrap.services || [];
    let lastError = null;
    for (const domain of candidateDomains(hostname)) {
      const tld = domain.split('.').at(-1);
      const service = services.find(([tlds]) => (tlds || []).map((item) => String(item).toLowerCase()).includes(tld));
      const base = service?.[1]?.[0];
      if (!base) continue;
      try {
        const endpoint = `${String(base).replace(/\/$/, '')}/domain/${encodeURIComponent(domain)}`;
        const data = await jsonFetch(endpoint, 10000);
        return parseDomainRdap(data, { domain, hostname, sourceUrl:endpoint });
      } catch (error) { lastError = error; }
    }
    return { status:'unavailable', source:'RDAP', domain:hostname, error:clean(lastError?.message || 'No se encontró un servicio RDAP aplicable.'), measuredAt:new Date().toISOString() };
  } catch (error) {
    return { status:'unavailable', source:'RDAP', domain:hostname, error:clean(error?.message || error), measuredAt:new Date().toISOString() };
  }
}

async function cnameChain(hostname) {
  const chain = [];
  const seen = new Set([hostname.toLowerCase()]);
  let current = hostname;
  for (let index = 0; index < 8; index += 1) {
    let records = [];
    try { records = await dns.resolveCname(current); } catch { break; }
    const next = records?.[0]?.replace(/\.$/, '');
    if (!next || seen.has(next.toLowerCase())) break;
    chain.push({ from:current, to:next });
    seen.add(next.toLowerCase());
    current = next;
  }
  return chain;
}

function providerSignals(hostname, chain, headers = {}) {
  const haystack = [hostname, ...chain.flatMap((item) => [item.from, item.to]), headers.server, headers.via, headers['x-powered-by'], headers['cf-ray'], headers['x-vercel-id']].filter(Boolean).join(' ').toLowerCase();
  const patterns = [
    ['Cloudflare', /cloudflare|cf-ray/], ['Vercel', /vercel|vercel-dns/], ['Netlify', /netlify/],
    ['Amazon CloudFront', /cloudfront|amazonaws/], ['Fastly', /fastly/], ['Akamai', /akamai|edgesuite|edgekey/],
    ['Google Cloud', /googleusercontent|googlehosted|gcp/], ['Azure', /azure|azurewebsites|trafficmanager/],
    ['GitHub Pages', /github\.io|github\.com/]
  ];
  return patterns.filter(([, pattern]) => pattern.test(haystack)).map(([name]) => name);
}

async function ipRegistration(ip) {
  try {
    const endpoint = `https://rdap.arin.net/bootstrap/ip/${encodeURIComponent(ip)}`;
    const data = await jsonFetch(endpoint, 9000);
    const organization = (data.entities || []).map(entityName).find(Boolean) || data.name || null;
    return { status:'measured', ip, handle:data.handle || null, name:data.name || null, organization, country:data.country || null, type:data.type || null, startAddress:data.startAddress || null, endAddress:data.endAddress || null, sourceUrl:endpoint };
  } catch (error) { return { status:'unavailable', ip, error:clean(error?.message || error) }; }
}

export async function inspectHosting(hostname, { headers = {} } = {}) {
  const [chain, records] = await Promise.all([
    cnameChain(hostname),
    dns.lookup(hostname, { all:true, verbatim:true }).catch(() => [])
  ]);
  const uniqueIps = [...new Set(records.map((item) => item.address))];
  const registrations = await Promise.all(uniqueIps.slice(0, 4).map(ipRegistration));
  const providers = providerSignals(hostname, chain, headers);
  const registeredNames = registrations.map((item) => `${item.organization || ''} ${item.name || ''}`).join(' ');
  const networkEdge = [/cloudflare/i.test(registeredNames) && 'Cloudflare', /fastly/i.test(registeredNames) && 'Fastly', /akamai/i.test(registeredNames) && 'Akamai'].find(Boolean) || null;
  const edgeProvider = providers[0] || networkEdge;
  return {
    status:uniqueIps.length ? 'measured' : 'unavailable', hostname, cnameChain:chain, ips:uniqueIps,
    ipRegistrations:registrations, edgeProvider,
    originProvider:edgeProvider ? null : registrations.find((item) => item.status === 'measured')?.organization || null,
    originObservable:!edgeProvider,
    confidence:edgeProvider ? 0.95 : registrations.some((item) => item.status === 'measured') ? 0.7 : null,
    classification:edgeProvider ? 'edge-or-cdn-detected' : 'public-ip-owner-observed',
    note:edgeProvider ? `La red pública parece usar ${edgeProvider}; el alojamiento del servidor de origen no es observable.` : 'El propietario del rango IP es evidencia de red, no prueba contractual del proveedor de alojamiento.',
    measuredAt:new Date().toISOString()
  };
}
