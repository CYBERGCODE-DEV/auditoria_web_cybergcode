import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { COMPANY } from '../config/company.js';

const PAGE = { width: 595.28, height: 841.89, margin: 48 };

function wrap(text, font, size, maxWidth) {
  const words = String(text ?? '').split(/\s+/).filter(Boolean);
  const lines = [];
  let line = '';
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, size) <= maxWidth) line = candidate;
    else { if (line) lines.push(line); line = word; }
  }
  if (line) lines.push(line);
  return lines.length ? lines : [''];
}

export async function buildAuditPdf(audit) {
  const pdf = await PDFDocument.create();
  pdf.setTitle(`Auditoría Web - ${audit?.meta?.target || 'CYBERGCODE'}`);
  pdf.setAuthor(COMPANY.legalName);
  pdf.setCreator(COMPANY.product);
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const dark = rgb(0.06, 0.08, 0.12);
  const ink = rgb(0.12, 0.15, 0.20);
  const accent = rgb(0.05, 0.66, 0.78);
  const muted = rgb(0.42, 0.46, 0.52);

  let page = pdf.addPage([PAGE.width, PAGE.height]);
  page.drawRectangle({ x: 0, y: 0, width: PAGE.width, height: PAGE.height, color: dark });
  page.drawText(COMPANY.brand, { x: 48, y: 740, size: 28, font: bold, color: accent });
  page.drawText('AUDITORÍA WEB INTEGRAL', { x: 48, y: 690, size: 22, font: bold, color: rgb(1, 1, 1) });
  page.drawText(audit.meta.target, { x: 48, y: 640, size: 13, font: regular, color: rgb(0.82, 0.86, 0.9) });
  page.drawText(`Resultado actual: ${audit.scores.global ?? 'N/D'} / 100`, { x: 48, y: 586, size: 18, font: bold, color: rgb(1, 1, 1) });
  page.drawText(`ID: ${audit.meta.id}`, { x: 48, y: 120, size: 9, font: regular, color: rgb(0.66, 0.7, 0.74) });
  page.drawText(`${COMPANY.legalName} · RUC ${COMPANY.ruc}`, { x: 48, y: 90, size: 9, font: regular, color: rgb(0.66, 0.7, 0.74) });
  page.drawText(`${COMPANY.domain} · ${COMPANY.email}`, { x: 48, y: 74, size: 9, font: regular, color: rgb(0.66, 0.7, 0.74) });

  let y = 760;
  const addPage = () => {
    page = pdf.addPage([PAGE.width, PAGE.height]);
    y = 760;
    page.drawText(COMPANY.legalName, { x: PAGE.margin, y: 805, size: 8, font: bold, color: muted });
    page.drawText(`RUC ${COMPANY.ruc} · ${COMPANY.domain}`, { x: 350, y: 805, size: 8, font: regular, color: muted });
    return page;
  };
  addPage();

  const heading = (text) => {
    if (y < 90) addPage();
    page.drawText(text, { x: PAGE.margin, y, size: 17, font: bold, color: ink });
    y -= 28;
  };
  const line = (label, value) => {
    if (y < 70) addPage();
    page.drawText(label, { x: PAGE.margin, y, size: 9, font: bold, color: muted });
    page.drawText(String(value), { x: 220, y, size: 10, font: regular, color: ink });
    y -= 19;
  };
  const paragraph = (label, value, options = {}) => {
    if (value == null || value === '') return;
    const size = options.size || 8.5;
    const color = options.color || ink;
    if (y < 90) addPage();
    if (label) {
      page.drawText(label, { x: PAGE.margin, y, size: 8, font: bold, color: options.labelColor || accent });
      y -= 13;
    }
    for (const textLine of wrap(value, options.font || regular, size, PAGE.width - PAGE.margin * 2)) {
      if (y < 55) addPage();
      page.drawText(textLine, { x: PAGE.margin, y, size, font: options.font || regular, color });
      y -= size + 3;
    }
    y -= 5;
  };

  heading('Resumen ejecutivo');
  line('Puntuación global', `${audit.scores.global ?? 'N/D'} / 100`);
  line('Páginas auditadas', audit.summary.pagesCrawled);
  line('Páginas descubiertas', audit.summary.pagesDiscovered);
  line('Hallazgos', audit.findings.length);
  line('Críticos', audit.summary.severity.critical || 0);
  line('Altos', audit.summary.severity.high || 0);
  line('Medios', audit.summary.severity.medium || 0);
  line('Bajos', audit.summary.severity.low || 0);
  y -= 10;

  if (audit.meta?.consistency) {
    heading('Consistencia del análisis');
    const c = audit.meta.consistency;
    line('Modo', c.mode === 'stable' ? 'Estable' : 'En vivo');
    line('Perfil', c.profile || 'N/D');
    line('Huella', c.fingerprint || 'N/D');
    line('PageSpeed', c.pageSpeedAggregation || 'N/D');
    line('Zona horaria', c.timezone || 'N/D');
    line('Región de función', c.functionRegion || 'N/D');
    line('Caché estable', c.cacheTtlMinutes ? `${c.cacheTtlMinutes} minutos` : 'Desactivada');
    paragraph('Nota metodológica', c.note || '', { size: 8 });
    y -= 6;
  }

  heading('Puntuaciones medidas');
  for (const [key, value] of Object.entries(audit.scores.categories || {})) {
    if (value !== null) line(key.toUpperCase(), `${value} / 100`);
  }
  y -= 10;

  if (audit.performance?.mobile || audit.performance?.desktop) {
    heading('Rendimiento - PageSpeed / Lighthouse');
    const perfLine = (label, data) => {
      if (!data) return;
      const c = data.categories || {};
      const m = data.metrics || {};
      line(`${label} Performance`, c.performance == null ? 'N/D' : `${c.performance} / 100`);
      line(`${label} Accesibilidad`, c.accessibility == null ? 'N/D' : `${c.accessibility} / 100`);
      line(`${label} LCP`, Number.isFinite(m.lcpMs) ? `${(m.lcpMs / 1000).toFixed(2)} s` : 'N/D');
      line(`${label} CLS`, Number.isFinite(m.cls) ? m.cls.toFixed(3) : 'N/D');
      line(`${label} TBT`, Number.isFinite(m.tbtMs) ? `${Math.round(m.tbtMs)} ms` : 'N/D');
      line(`${label} muestras`, data.sampleCount || 1);
      line(`${label} agregación`, data.aggregation || 'single-run');
    };
    perfLine('Movil', audit.performance.mobile);
    perfLine('Desktop', audit.performance.desktop);
    y -= 10;
  }

  if (audit.browser?.moduleStatus === 'measured') {
    heading('DOM renderizado y visual');
    line('Nodos DOM', audit.browser.domNodes ?? 'N/D');
    line('Recursos', audit.browser.performance?.resourceCount ?? 'N/D');
    line('Transferencia', Number.isFinite(audit.browser.performance?.transferBytes) ? `${Math.round(audit.browser.performance.transferBytes / 1024)} KB` : 'N/D');
    line('Contrastes fallidos', audit.browser.contrast?.failed ?? 0);
    line('Overflow movil', audit.browser.responsive?.horizontalOverflow ? 'Detectado' : 'No detectado');
    line('Targets pequenos', audit.browser.responsive?.smallTargets ?? 0);
    if (audit.browser.axe?.moduleStatus === 'measured') {
      line('axe-core violaciones', audit.browser.axe.violations ?? 0);
      line('axe-core nodos afectados', audit.browser.axe.violationNodes ?? 0);
      line('axe-core revisión manual', audit.browser.axe.incomplete ?? 0);
    }
    y -= 10;
  }

  if (audit.infrastructure?.status === 'measured') {
    heading('Infraestructura — DNS, TLS y correo');
    const dns = audit.infrastructure.dns || {};
    const tls = audit.infrastructure.tls || {};
    const email = dns.email || {};
    line('IPv4 / IPv6', `${dns.a?.length || 0} / ${dns.aaaa?.length || 0}`);
    line('Nameservers', dns.ns?.length || 0);
    line('DNSSEC', dns.dnssec === 'validated' ? 'Validado' : (dns.dnssec === 'not-validated' ? 'No validado' : 'N/D')); 
    line('CAA', dns.caa?.length ? `${dns.caa.length} registro(s)` : 'No detectado');
    line('TLS autorizado', tls.status === 'measured' ? (tls.authorized ? 'Sí' : 'No') : 'N/D');
    line('Protocolo TLS', tls.protocol || 'N/D');
    line('Días de vigencia TLS', Number.isFinite(tls.daysRemaining) ? tls.daysRemaining : 'N/D');
    line('MX', dns.mx?.length || 0);
    line('SPF', email.spf?.length ? 'Detectado' : (dns.mx?.length ? 'No detectado' : 'N/A'));
    line('DMARC', email.dmarc?.length ? 'Detectado' : (dns.mx?.length ? 'No detectado' : 'N/A'));
    line('DKIM', email.dkim?.found?.length ? `${email.dkim.found.length} selector(es) común(es)` : (dns.mx?.length ? 'Requiere selector/evidencia' : 'N/A'));
    y -= 8;
  }

  if (audit.browser?.network) {
    heading('Cookies y terceros');
    line('Cookies detectadas', audit.browser.network.cookieCount ?? 0);
    line('Hosts de terceros', audit.browser.network.thirdPartyHosts ?? 0);
    line('Trackers / plataformas', audit.browser.network.trackers?.length ?? 0);
    if (audit.browser.network.trackers?.length) paragraph('TERCEROS DETECTADOS', audit.browser.network.trackers.map((t) => `${t.vendor} (${t.count})`).join(', '), { size: 8 });
    y -= 8;
  }

  if (audit.peru) {
    heading('Cumplimiento y confianza digital — Perú');
    paragraph('ALCANCE', audit.peru.methodology, { size: 8.2, color: muted });
    line('Señales observadas', audit.peru.summary?.observed ?? 0);
    line('Requieren atención', audit.peru.summary?.attention ?? 0);
    line('Revisión manual', audit.peru.summary?.manual ?? 0);
    for (const item of (audit.peru.checks || [])) {
      paragraph(item.status === 'attention' ? 'ALERTA' : 'CONTROL', `${item.title}: ${item.evidence}`, { size: 7.8 });
    }
    y -= 8;
  }

  if (audit.iso) {
    heading('ISO Web Readiness — alineamiento observable');
    line('Puntuación observable', audit.iso.overall?.observableScore == null ? 'N/D' : `${audit.iso.overall.observableScore} / 100`);
    line('Señales alineadas', audit.iso.overall?.passed ?? 0);
    line('Observaciones', audit.iso.overall?.failed ?? 0);
    line('Evidencias internas requeridas', audit.iso.overall?.manual ?? 0);
    paragraph('ALCANCE', audit.iso.disclaimer, { size: 8.5, color: muted });
    const statusLabel = { 'observable-alignment':'Alineado observable', 'partial-alignment':'Parcial + evidencia interna', 'needs-attention':'Requiere acción', 'manual-review':'Requiere evidencia interna' };
    for (const std of (audit.iso.standards || []).slice(0, 14)) {
      if (y < 150) addPage();
      page.drawText(std.reference, { x: PAGE.margin, y, size: 9, font: bold, color: accent });
      y -= 14;
      paragraph(null, `${std.name} — ${statusLabel[std.status] || std.status}${std.observableScore == null ? '' : ` · ${std.observableScore}/100 observable`}`, { size: 9, font: bold });
      paragraph('NOTA', std.note, { size: 7.6, color: muted });
      const relevant = (std.checks || []).filter((c) => c.status !== 'pass').slice(0, 3);
      if (!relevant.length) paragraph('RESULTADO', 'No se detectaron observaciones automáticas en los controles observables evaluados.', { size: 7.8 });
      for (const item of relevant) {
        paragraph(item.status === 'manual' ? 'EVIDENCIA INTERNA REQUERIDA' : 'OBSERVACIÓN', `${item.title}. ${item.evidence}`, { size: 7.8 });
        paragraph('ACCIÓN PARA LEVANTAR', item.action, { size: 7.8 });
        paragraph('CRITERIO DE CIERRE', item.acceptanceCriteria, { size: 7.8 });
      }
      y -= 6;
    }
    y -= 6;
    if (audit.iso.evidenceCenter?.items?.length) {
      heading('ISO Evidence Center');
      const completed = audit.iso.evidenceCenter.items.filter((item) => item.clientStatus === 'evidence-available').length;
      line('Evidencias marcadas disponibles', `${completed} / ${audit.iso.evidenceCenter.items.length}`);
      paragraph('ALCANCE', 'Marcar evidencia como disponible no significa que haya sido validada. La revisión documental debe confirmar suficiencia, vigencia, alcance y trazabilidad.', { size: 8, color: muted });
      for (const item of audit.iso.evidenceCenter.items.slice(0, 20)) {
        const status = item.clientStatus === 'evidence-available' ? 'EVIDENCIA DISPONIBLE' : 'PENDIENTE';
        paragraph(`${status} · ${item.standard}`, `${item.title}. Evidencia: ${item.evidenceRequired}`, { size: 7.8 });
        paragraph('CRITERIO DE VALIDACIÓN', item.acceptanceCriteria, { size: 7.6 });
      }
      y -= 6;
    }
  }

  heading('Hallazgos prioritarios');
  const prioritized = [...audit.findings].sort((a, b) => ({ critical: 4, high: 3, medium: 2, low: 1, info: 0 }[b.severity] - ({ critical: 4, high: 3, medium: 2, low: 1, info: 0 }[a.severity]))).slice(0, 40);
  for (const finding of prioritized) {
    if (y < 160) addPage();
    page.drawText(`${finding.severity.toUpperCase()} · ${finding.category.toUpperCase()} · ${finding.ruleId}`, { x: PAGE.margin, y, size: 8, font: bold, color: accent });
    y -= 16;
    paragraph(null, finding.title, { size: 11, font: bold });
    paragraph('URL / selector', `${finding.url || 'N/D'}${finding.selector ? ` · ${finding.selector}` : ''}`, { size: 7.7, color: muted });
    paragraph('EVIDENCIA', finding.evidence, { color: muted });
    if (finding.expected) paragraph('RESULTADO ESPERADO', finding.expected);
    paragraph('IMPACTO', finding.impact);
    paragraph('QUÉ RECOMENDAMOS HACER', finding.recommendation);
    paragraph('SOLUCIÓN PARA LEVANTAR LA OBSERVACIÓN', finding.solution || finding.recommendation);
    if (Array.isArray(finding.remediationSteps) && finding.remediationSteps.length) {
      paragraph('PASOS RECOMENDADOS', finding.remediationSteps.map((step, index) => `${index + 1}. ${step}`).join('  '));
    }
    paragraph('CRITERIO DE CIERRE / OBSERVACIÓN LEVANTADA', finding.acceptanceCriteria || 'Repetir la auditoría y confirmar que el hallazgo ya no se reproduce.');
    if (finding.codeExample) paragraph('EJEMPLO TÉCNICO / CÓDIGO', finding.codeExample, { size: 7.5 });
    paragraph('TRAZABILIDAD', `Esfuerzo: ${finding.effort || 'Por evaluar'} · Confianza: ${Math.round((finding.confidence || 0) * 100)}% · Fuente: ${finding.source || 'N/D'}`, { size: 7.5, color: muted });
    y -= 10;
  }

  addPage();
  heading('Aviso metodológico');
  const note = 'Este informe combina comprobaciones automatizadas y métricas técnicas. Esta versión no sustituye una auditoría manual de accesibilidad, una prueba de penetración autorizada ni asesoría jurídica especializada. Los módulos marcados como planned no intervienen en la puntuación. Las comprobaciones Perú son alertas de señales visibles y requieren validar aplicabilidad jurídica y vigencia reglamentaria. PageSpeed/Lighthouse, axe-core y las comprobaciones automáticas de accesibilidad no equivalen a una certificación WCAG completa. El módulo ISO Web Readiness evalúa evidencia observable y no constituye certificación ni declaración formal de conformidad ISO; las normas de sistemas de gestión requieren revisión documental y organizativa. Cada criterio de cierre indica cómo validar técnicamente la corrección de la observación automatizada.';
  for (const textLine of wrap(note, regular, 10, PAGE.width - PAGE.margin * 2)) {
    page.drawText(textLine, { x: PAGE.margin, y, size: 10, font: regular, color: ink }); y -= 15;
  }

  const pages = pdf.getPages();
  pages.forEach((p, index) => {
    if (index === 0) return;
    p.drawText(`Auditoría ${audit.meta.id}`, { x: PAGE.margin, y: 28, size: 7, font: regular, color: muted });
    p.drawText(`Página ${index + 1} de ${pages.length}`, { x: 470, y: 28, size: 7, font: regular, color: muted });
  });

  return Buffer.from(await pdf.save());
}
