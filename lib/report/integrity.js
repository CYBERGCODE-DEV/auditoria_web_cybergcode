import crypto from 'node:crypto';

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().filter((key) => value[key] !== undefined).map((key) => [key, canonical(value[key])]));
  }
  return value;
}

export function buildReportPayload(audit) {
  const meta = { ...(audit?.meta || {}) };
  delete meta.reportAuthorization;
  const browser = audit?.browser?.moduleStatus === 'measured' ? {
    moduleStatus:'measured', domNodes:audit.browser.domNodes, performance:audit.browser.performance,
    contrast:audit.browser.contrast, responsive:audit.browser.responsive, axe:audit.browser.axe, network:audit.browser.network
  } : audit?.browser;
  return canonical({
    meta, company:audit?.company, scores:audit?.scores, summary:audit?.summary,
    findings:(audit?.findings || []).slice(0, 100), performance:audit?.performance || null,
    browser, infrastructure:audit?.infrastructure, seo:audit?.seo, content:audit?.content,
    ux:audit?.ux, imageSummary:audit?.imageSummary, technologies:audit?.technologies,
    technologyProfile:audit?.technologyProfile, css:audit?.css,
    accessibilityManual:audit?.accessibilityManual, pages:audit?.pages, peru:audit?.peru,
    iso:audit?.iso, templateSampling:audit?.templateSampling || null
  });
}

function secret() {
  return String(process.env.CYBERGCODE_REPORT_SECRET || '').trim();
}

function buildSignaturePayload(audit) {
  const payload = buildReportPayload(audit);
  for (const item of payload.accessibilityManual?.items || []) delete item.clientStatus;
  if (payload.iso?.evidenceCenter) {
    delete payload.iso.evidenceCenter.completed;
    for (const item of payload.iso.evidenceCenter.items || []) delete item.clientStatus;
  }
  return payload;
}

function digest(payload) {
  return crypto.createHash('sha256').update(JSON.stringify(canonical(payload))).digest('hex');
}

export function attachReportAuthorization(audit) {
  const configured = secret();
  if (!audit?.meta) return audit;
  if (!configured) {
    audit.meta.reportAuthorization = { status:'unavailable', version:1, reason:'CYBERGCODE_REPORT_SECRET no configurado' };
    return audit;
  }
  const payloadHash = digest(buildSignaturePayload(audit));
  const signature = crypto.createHmac('sha256', configured).update(payloadHash).digest('base64url');
  audit.meta.reportAuthorization = { status:'signed', version:1, algorithm:'HMAC-SHA256', payloadHash, signature };
  return audit;
}

export function verifyReportAuthorization(audit) {
  const configured = secret();
  const authorization = audit?.meta?.reportAuthorization;
  if (!configured) return { ok:false, code:'REPORT_SIGNING_NOT_CONFIGURED', message:'La exportación PDF requiere CYBERGCODE_REPORT_SECRET.' };
  if (authorization?.status !== 'signed' || authorization.version !== 1 || !authorization.signature || !authorization.payloadHash) {
    return { ok:false, code:'UNSIGNED_AUDIT', message:'El resultado no contiene una autorización de reporte válida.' };
  }
  const payloadHash = digest(buildSignaturePayload(audit));
  if (payloadHash !== authorization.payloadHash) return { ok:false, code:'AUDIT_PAYLOAD_CHANGED', message:'Los datos del informe fueron modificados después de la auditoría.' };
  const expected = Buffer.from(crypto.createHmac('sha256', configured).update(payloadHash).digest('base64url'));
  const actual = Buffer.from(String(authorization.signature));
  const ok = expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
  return ok ? { ok:true } : { ok:false, code:'INVALID_REPORT_SIGNATURE', message:'La firma del informe no es válida.' };
}
