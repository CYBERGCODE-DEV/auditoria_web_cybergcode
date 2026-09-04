const $ = (selector) => document.querySelector(selector);
const form = $('#auditForm');
const hero = $('#hero');
const working = $('#working');
const dashboard = $('#dashboard');
const errorBox = $('#errorBox');
const submitButton = form.querySelector('button[type="submit"]');
let currentAudit = null;

const severityRank = { critical: 4, high: 3, medium: 2, low: 1, info: 0 };
const labels = { security:'Seguridad', technical:'Técnico', seo:'SEO', images:'Imágenes', performance:'Rendimiento', content:'Contenido', accessibility:'Accesibilidad', ux:'UX / CRO', compliance:'Cumplimiento' };

function view(name) {
  hero.classList.toggle('hidden', name !== 'hero');
  working.classList.toggle('hidden', name !== 'working');
  dashboard.classList.toggle('hidden', name !== 'dashboard');
  errorBox.classList.toggle('hidden', name !== 'error');
}

function escapeHtml(value='') {
  return String(value).replace(/[&<>"]/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
}

function renderScores(audit) {
  $('#globalScore').textContent = audit.scores.global ?? 'N/D';
  $('#methodology').textContent = audit.scores.methodology;
  $('#scoreCards').innerHTML = Object.entries(audit.scores.categories)
    .map(([key,value]) => `<article class="panel score-card"><span>${escapeHtml(labels[key] || key)}</span><b>${value === null ? 'N/D' : value}</b><em>${value === null ? 'pendiente' : '/ 100'}</em></article>`).join('');
}

function renderStats(audit) {
  const s = audit.summary;
  const stats = [
    [s.severity.critical||0,'Críticos'],[s.severity.high||0,'Altos'],[s.severity.medium||0,'Medios'],[s.severity.low||0,'Bajos'],[s.pagesCrawled,'Páginas'],[s.images,'Imágenes']
  ];
  $('#stats').innerHTML = stats.map(([value,label]) => `<div class="stat"><b>${value}</b><span>${label}</span></div>`).join('');
}

function renderFindings(audit) {
  const filter = $('#severityFilter').value;
  const findings = [...audit.findings].filter(f => filter === 'all' || f.severity === filter).sort((a,b)=>severityRank[b.severity]-severityRank[a.severity]);
  $('#findingsList').innerHTML = findings.length ? findings.map(f => `
    <article class="finding">
      <div class="finding-top"><span class="badge ${f.severity}">${escapeHtml(f.severity)}</span><span class="url">${escapeHtml(f.ruleId)} · confianza ${Math.round((f.confidence||0)*100)}%</span></div>
      <h4>${escapeHtml(f.title)}</h4><div class="url">${escapeHtml(f.url)}</div>
      <dl><dt>Evidencia</dt><dd>${escapeHtml(f.evidence)}</dd><dt>Impacto</dt><dd>${escapeHtml(f.impact)}</dd><dt>Corrección</dt><dd>${escapeHtml(f.recommendation)}</dd></dl>
    </article>`).join('') : '<p class="muted">No hay hallazgos con este filtro.</p>';
}

function renderAudit(audit) {
  currentAudit = audit;
  $('#targetName').textContent = new URL(audit.meta.target).hostname;
  $('#auditMeta').textContent = `${audit.meta.id} · ${audit.summary.pagesCrawled} páginas · ${new Date(audit.meta.finishedAt).toLocaleString('es-PE')}`;
  renderScores(audit); renderStats(audit); renderFindings(audit);
  $('#modules').innerHTML = Object.entries(audit.modules).map(([key,value]) => `<div class="module"><b>${escapeHtml(key)}</b><span class="${value}">${escapeHtml(value)}</span></div>`).join('');
  $('#pagesList').innerHTML = audit.pages.map(page => `<div class="page-row"><span title="${escapeHtml(page.url)}">${escapeHtml(new URL(page.url).pathname || '/')}</span><b>HTTP ${page.status}</b></div>`).join('');
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  submitButton.disabled = true;
  view('working');
  try {
    const response = await fetch('/api/audit', { method:'POST', headers:{'content-type':'application/json'}, body:JSON.stringify({ url:$('#url').value, maxPages:Number($('#maxPages').value) }) });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Error de auditoría.');
    renderAudit(data); view('dashboard');
  } catch (error) {
    $('#errorText').textContent = error.message; view('error');
  } finally { submitButton.disabled = false; }
});

$('#severityFilter').addEventListener('change', () => currentAudit && renderFindings(currentAudit));
$('#newAudit').addEventListener('click', () => { currentAudit = null; view('hero'); $('#url').focus(); });
$('#retryButton').addEventListener('click', () => view('hero'));
$('#exportPdf').addEventListener('click', async () => {
  if (!currentAudit) return;
  const button = $('#exportPdf');
  button.disabled = true; button.textContent = 'Generando…';
  try {
    const response = await fetch('/api/report', { method:'POST', headers:{'content-type':'application/json'}, body:JSON.stringify({ meta: currentAudit.meta, company: currentAudit.company, scores: currentAudit.scores, summary: currentAudit.summary, findings: currentAudit.findings.slice(0, 80) }) });
    if (!response.ok) throw new Error('No se pudo generar el PDF.');
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `${currentAudit.meta.id}.pdf`; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
  } catch (error) { alert(error.message); }
  finally { button.disabled = false; button.textContent = 'Exportar PDF'; }
});
