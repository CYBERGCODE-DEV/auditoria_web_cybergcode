import dns from 'node:dns/promises';
import tls from 'node:tls';
import { assertPublicUrl, isBlockedIp } from '../security/url-guard.js';
import { createFinding } from '../audit/finding.js';
import { RULES } from '../config/rules.js';

const clean = (value) => String(value ?? '').replace(/\s+/g, ' ').trim();
const flattenTxt = (rows = []) => rows.map((parts) => parts.join('')).filter(Boolean);

async function optionalResolve(fn, fallback = []) {
  try { return await fn(); } catch { return fallback; }
}

async function dnssecProbe(hostname) {
  const query = async (type) => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);
    try {
      const endpoint = `https://dns.google/resolve?name=${encodeURIComponent(hostname)}&type=${encodeURIComponent(type)}&do=1&edns_client_subnet=0.0.0.0/0`;
      const response = await fetch(endpoint, { headers: { accept: 'application/json' }, signal: controller.signal });
      if (!response.ok) throw new Error(`DoH HTTP ${response.status}`);
      return await response.json();
    } finally { clearTimeout(timeout); }
  };
  try {
    const [aResult, dsResult] = await Promise.all([query('A'), query('DS')]);
    const ds = (dsResult.Answer || []).filter((item) => item.type === 43).map((item) => item.data);
    return { status: 'measured', authenticatedData: Boolean(aResult.AD), ds, responseStatus: aResult.Status };
  } catch (error) {
    return { status: 'unavailable', authenticatedData: null, ds: [], error: clean(error?.message || error) };
  }
}

async function tlsProbe(hostname) {
  try {
    const records = await dns.lookup(hostname, { all: true, verbatim: true });
    const publicRecord = records.find((record) => !isBlockedIp(record.address));
    if (!publicRecord) return { status: 'unavailable', error: 'El hostname no resolvió a una IP pública permitida para la prueba TLS.' };
    return await new Promise((resolve) => {
      const socket = tls.connect({ host: publicRecord.address, port: 443, servername: hostname, rejectUnauthorized: false, timeout: 8000 }, () => {
        const cert = socket.getPeerCertificate(true) || {};
        const validTo = cert.valid_to ? new Date(cert.valid_to) : null;
        const validFrom = cert.valid_from ? new Date(cert.valid_from) : null;
        resolve({
          status: 'measured', ip: publicRecord.address, authorized: socket.authorized,
          authorizationError: socket.authorizationError || null,
          protocol: socket.getProtocol(), cipher: socket.getCipher()?.name || null,
          alpnProtocol: socket.alpnProtocol || null, subject: cert.subject || null,
          issuer: cert.issuer || null, subjectaltname: cert.subjectaltname || null,
          fingerprint256: cert.fingerprint256 || null,
          validFrom: validFrom?.toISOString() || null, validTo: validTo?.toISOString() || null,
          daysRemaining: validTo ? Math.floor((validTo.getTime() - Date.now()) / 86400000) : null
        });
        socket.end();
      });
      socket.on('timeout', () => { socket.destroy(); resolve({ status: 'unavailable', error: 'Timeout TLS' }); });
      socket.on('error', (error) => resolve({ status: 'unavailable', error: clean(error?.message || error) }));
    });
  } catch (error) {
    return { status: 'unavailable', error: clean(error?.message || error) };
  }
}

async function probeDkim(hostname) {
  const selectors = ['default', 'google', 'selector1', 'selector2', 'k1', 's1', 's2', 'mail', 'dkim'];
  const probes = await Promise.all(selectors.map(async (selector) => {
    const records = await optionalResolve(() => dns.resolveTxt(`${selector}._domainkey.${hostname}`));
    const values = flattenTxt(records).filter((value) => /v=DKIM1|\bp=/i.test(value));
    return values.length ? { selector, records: values.slice(0, 2) } : null;
  }));
  const found = probes.filter(Boolean);
  return { selectorsTested: selectors, found, status: found.length ? 'found-common-selector' : 'requires-selector' };
}

function finding(rule, title, url, evidence, impact, source = 'DNS/TLS') {
  return createFinding({ rule, category: 'security', title, url, evidence, impact, source });
}

export async function runDomainInfrastructureAudit(target) {
  const safe = await assertPublicUrl(target);
  const hostname = safe.hostname.toLowerCase();
  const url = safe.href;

  const [a, aaaa, ns, mx, txtRows, caa, dnssec, dmarcRows, mtaStsRows, tlsRptRows, tlsInfo, dkim] = await Promise.all([
    optionalResolve(() => dns.resolve4(hostname)),
    optionalResolve(() => dns.resolve6(hostname)),
    optionalResolve(() => dns.resolveNs(hostname)),
    optionalResolve(() => dns.resolveMx(hostname)),
    optionalResolve(() => dns.resolveTxt(hostname)),
    optionalResolve(() => dns.resolveCaa(hostname)),
    dnssecProbe(hostname),
    optionalResolve(() => dns.resolveTxt(`_dmarc.${hostname}`)),
    optionalResolve(() => dns.resolveTxt(`_mta-sts.${hostname}`)),
    optionalResolve(() => dns.resolveTxt(`_smtp._tls.${hostname}`)),
    tlsProbe(hostname),
    probeDkim(hostname)
  ]);

  const txt = flattenTxt(txtRows);
  const spf = txt.filter((record) => /^v=spf1\b/i.test(record));
  const dmarc = flattenTxt(dmarcRows).filter((record) => /^v=DMARC1\b/i.test(record));
  const mtaSts = flattenTxt(mtaStsRows).filter((record) => /^v=STSv1\b/i.test(record));
  const tlsRpt = flattenTxt(tlsRptRows).filter((record) => /^v=TLSRPTv1\b/i.test(record));
  const findings = [];
  const hasMail = mx.length > 0;

  if (tlsInfo.status === 'measured') {
    if (!tlsInfo.authorized) findings.push(finding(RULES.infrastructure.tlsInvalid, 'Certificado TLS no validado correctamente', url, tlsInfo.authorizationError || 'La conexión TLS no fue autorizada.', 'Puede provocar advertencias de navegador o debilitar la confianza en el canal cifrado.'));
    if (Number.isFinite(tlsInfo.daysRemaining) && tlsInfo.daysRemaining < 0) findings.push(finding(RULES.infrastructure.tlsExpired, 'Certificado TLS expirado', url, `El certificado expiró hace ${Math.abs(tlsInfo.daysRemaining)} día(s).`, 'Los navegadores pueden bloquear o advertir sobre la conexión.'));
    else if (Number.isFinite(tlsInfo.daysRemaining) && tlsInfo.daysRemaining <= 30) findings.push(finding(RULES.infrastructure.tlsExpiring, 'Certificado TLS próximo a expirar', url, `Quedan aproximadamente ${tlsInfo.daysRemaining} día(s).`, 'Una renovación tardía puede causar una interrupción de confianza o disponibilidad HTTPS.'));
  }

  if (!caa.length) findings.push(finding(RULES.infrastructure.missingCaa, 'No se detectaron registros CAA', url, '0 registros CAA publicados.', 'CAA permite restringir qué autoridades certificadoras pueden emitir certificados para el dominio.'));
  if (dnssec.status === 'measured' && !dnssec.authenticatedData) findings.push(finding(RULES.infrastructure.missingDnssec, 'DNSSEC no validado para el dominio', url, `Google Public DNS devolvió AD=false; registros DS observados: ${dnssec.ds.length}.`, 'Sin validación DNSSEC no existe una cadena criptográfica validada para las respuestas DNS consultadas.', 'DNS over HTTPS / DNSSEC')); 

  if (hasMail && !spf.length) findings.push(finding(RULES.infrastructure.missingSpf, 'SPF no detectado para el dominio', url, `${mx.length} registro(s) MX y 0 políticas SPF detectadas.`, 'Sin SPF es más difícil indicar qué servidores están autorizados a enviar correo usando el dominio.', 'DNS / email security'));
  if (hasMail && !dmarc.length) findings.push(finding(RULES.infrastructure.missingDmarc, 'DMARC no detectado', url, 'No se encontró una política DMARC en _dmarc.', 'DMARC ayuda a definir tratamiento y reporte para mensajes que no superan autenticación/alineamiento.', 'DNS / email security'));
  if (hasMail && !dkim.found.length) findings.push(createFinding({
    rule: RULES.infrastructure.dkimEvidence,
    category: 'security',
    title: 'DKIM requiere selector o evidencia adicional',
    url,
    evidence: `Se probaron ${dkim.selectorsTested.length} selectores comunes sin encontrar una clave DKIM. Esto no demuestra que DKIM esté ausente.`,
    expected: 'Confirmar al menos un selector DKIM activo utilizado por el proveedor de correo.',
    impact: 'Sin el selector real no puede verificarse automáticamente la firma DKIM del dominio.',
    recommendation: 'Solicitar el selector DKIM al administrador/proveedor de correo o permitir introducirlo manualmente en una auditoría avanzada.',
    solution: 'Verificar que el selector activo publique un registro DKIM válido y que los correos salientes se firmen con ese selector.',
    remediationSteps: ['Obtener el selector DKIM activo.', 'Consultar selector._domainkey.dominio.', 'Confirmar v=DKIM1 y clave pública válida.', 'Enviar un correo de prueba y validar la firma DKIM.'],
    acceptanceCriteria: 'Se verifica el selector real y una muestra de correo confirma DKIM=pass y alineamiento esperado.',
    effort: 'Bajo/Medio',
    source: 'DNS / DKIM selector discovery',
    automated: false,
    type: 'advisory',
    confidence: 0.55
  }));

  return {
    status: 'measured',
    hostname,
    dns: {
      a, aaaa, ns, mx: [...mx].sort((x, y) => x.priority - y.priority),
      txtCount: txt.length, caa, ds: dnssec.ds,
      dnssec: dnssec.status === 'measured' ? (dnssec.authenticatedData ? 'validated' : 'not-validated') : 'unavailable',
      dnssecProbe: dnssec,
      email: { spf, dmarc, dkim, mtaSts, tlsRpt }
    },
    tls: tlsInfo,
    findings
  };
}
