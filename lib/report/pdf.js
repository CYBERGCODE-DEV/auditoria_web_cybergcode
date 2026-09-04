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

  heading('Puntuaciones medidas');
  for (const [key, value] of Object.entries(audit.scores.categories || {})) {
    if (value !== null) line(key.toUpperCase(), `${value} / 100`);
  }
  y -= 10;

  heading('Hallazgos prioritarios');
  const prioritized = [...audit.findings].sort((a, b) => ({ critical: 4, high: 3, medium: 2, low: 1, info: 0 }[b.severity] - ({ critical: 4, high: 3, medium: 2, low: 1, info: 0 }[a.severity]))).slice(0, 40);
  for (const finding of prioritized) {
    if (y < 135) addPage();
    page.drawText(`${finding.severity.toUpperCase()} · ${finding.category.toUpperCase()} · ${finding.ruleId}`, { x: PAGE.margin, y, size: 8, font: bold, color: accent });
    y -= 16;
    for (const textLine of wrap(finding.title, bold, 11, PAGE.width - PAGE.margin * 2)) {
      page.drawText(textLine, { x: PAGE.margin, y, size: 11, font: bold, color: ink }); y -= 14;
    }
    for (const textLine of wrap(`Evidencia: ${finding.evidence}`, regular, 8.5, PAGE.width - PAGE.margin * 2)) {
      page.drawText(textLine, { x: PAGE.margin, y, size: 8.5, font: regular, color: muted }); y -= 11;
    }
    for (const textLine of wrap(`Recomendación: ${finding.recommendation}`, regular, 8.5, PAGE.width - PAGE.margin * 2)) {
      page.drawText(textLine, { x: PAGE.margin, y, size: 8.5, font: regular, color: ink }); y -= 11;
    }
    y -= 12;
  }

  addPage();
  heading('Aviso metodológico');
  const note = 'Este informe combina comprobaciones automatizadas y métricas técnicas. Esta versión no sustituye una auditoría manual de accesibilidad, una prueba de penetración autorizada ni asesoría jurídica especializada. Los módulos marcados como planned no intervienen en la puntuación.';
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
