const $ = (selector) => document.querySelector(selector);
const form = $('#auditForm');
const hero = $('#hero');
const working = $('#working');
const dashboard = $('#dashboard');
const errorBox = $('#errorBox');
const submitButton = form.querySelector('button[type="submit"]');
let currentAudit = null;

function syncThemeButton() {
  const button = $('#themeToggle');
  if (!button) return;
  const theme = window.CGAuditTheme?.get?.() || document.documentElement.dataset.theme || 'dark';
  const next = theme === 'dark' ? 'claro' : 'oscuro';
  button.querySelector('.theme-icon').textContent = theme === 'dark' ? '☾' : '☀';
  button.querySelector('.theme-text').textContent = theme === 'dark' ? 'Oscuro' : 'Claro';
  button.setAttribute('aria-label', `Cambiar a tema ${next}`);
  button.setAttribute('title', `Cambiar a tema ${next}`);
}

syncThemeButton();
window.addEventListener('cybergcode-themechange', syncThemeButton);
$('#themeToggle')?.addEventListener('click', () => window.CGAuditTheme?.toggle?.());

const severityRank = { critical: 4, high: 3, medium: 2, low: 1, info: 0 };
const labels = { security:'Seguridad', technical:'Técnico', seo:'SEO', images:'Imágenes', performance:'Rendimiento', content:'Contenido', accessibility:'Accesibilidad', ux:'UX / CRO', compliance:'ISO / Cumplimiento observable' };

function view(name) {
  hero.classList.toggle('hidden', name !== 'hero');
  working.classList.toggle('hidden', name !== 'working');
  dashboard.classList.toggle('hidden', name !== 'dashboard');
  errorBox.classList.toggle('hidden', name !== 'error');
}

function escapeHtml(value='') {
  return String(value).replace(/[&<>"]/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
}

function formatMs(value) { return Number.isFinite(value) ? `${Math.round(value)} ms` : 'N/D'; }
function formatBytes(value) {
  if (!Number.isFinite(value)) return 'N/D';
  if (value >= 1e6) return `${(value/1e6).toFixed(2)} MB`;
  if (value >= 1e3) return `${(value/1e3).toFixed(0)} KB`;
  return `${value} B`;
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
  $('#findingsList').innerHTML = findings.length ? findings.map(f => {
    const steps = Array.isArray(f.remediationSteps) ? f.remediationSteps : [];
    const open = f.severity === 'critical' ? ' open' : '';
    return `
    <details class="finding"${open}>
      <summary>
        <div class="finding-top"><span class="badge ${escapeHtml(f.severity)}">${escapeHtml(f.severity)}</span><span class="url">${escapeHtml(f.ruleId)} · confianza ${Math.round((f.confidence||0)*100)}%</span></div>
        <div class="finding-summary-title"><div><h4>${escapeHtml(f.title)}</h4><div class="url">${escapeHtml(f.url)}</div></div></div>
      </summary>
      <dl>
        <dt>Evidencia</dt><dd>${escapeHtml(f.evidence)}</dd>
        ${f.expected ? `<dt>Esperado</dt><dd>${escapeHtml(f.expected)}</dd>` : ''}
        <dt>Impacto</dt><dd>${escapeHtml(f.impact)}</dd>
        <dt>Fuente</dt><dd>${escapeHtml(f.source)}</dd>
      </dl>
      <section class="finding-remediation">
        <h5>Qué recomendamos hacer</h5><p>${escapeHtml(f.recommendation || 'Revisar y corregir la condición detectada.')}</p>
        <h5>Solución para levantar la observación</h5><p>${escapeHtml(f.solution || f.recommendation || 'Aplicar la corrección y repetir la auditoría.')}</p>
        ${steps.length ? `<h5>Pasos recomendados</h5><ol>${steps.map(step => `<li>${escapeHtml(step)}</li>`).join('')}</ol>` : ''}
        <h5>Criterio de cierre</h5><p class="acceptance">${escapeHtml(f.acceptanceCriteria || 'Repetir la auditoría y confirmar que la observación ya no se reproduce.')}</p>
        ${f.codeExample ? `<h5>Ejemplo técnico / evidencia de código</h5><pre class="code-example">${escapeHtml(f.codeExample)}</pre>` : ''}
        <div class="finding-meta"><span>Esfuerzo: ${escapeHtml(f.effort || 'Por evaluar')}</span><span>${f.automated === false ? 'Revisión manual' : 'Comprobación automática'}</span><span>${escapeHtml(f.type || 'objective')}</span></div>
      </section>
    </details>`;
  }).join('') : '<p class="muted">No hay hallazgos con este filtro.</p>';
}

function metricRows(rows) {
  return rows.map(([label,value,accent]) => `<div><span>${escapeHtml(label)}</span><b class="${accent || ''}">${escapeHtml(value)}</b></div>`).join('');
}

function renderPageSpeed(audit) {
  const render = (data, selector) => {
    if (!data) { $(selector).innerHTML = '<p class="muted">No disponible en esta ejecución.</p>'; return; }
    const c = data.categories || {}, m = data.metrics || {};
    $(selector).innerHTML = metricRows([
      ['Performance', c.performance == null ? 'N/D' : `${c.performance}/100`, 'accent-value'],
      ['Accesibilidad', c.accessibility == null ? 'N/D' : `${c.accessibility}/100`],
      ['SEO Lighthouse', c.seo == null ? 'N/D' : `${c.seo}/100`],
      ['Best Practices', c.bestPractices == null ? 'N/D' : `${c.bestPractices}/100`],
      ['LCP', Number.isFinite(m.lcpMs) ? `${(m.lcpMs/1000).toFixed(2)} s` : 'N/D'],
      ['CLS', Number.isFinite(m.cls) ? m.cls.toFixed(3) : 'N/D'],
      ['TBT', formatMs(m.tbtMs)],
      ['FCP', Number.isFinite(m.fcpMs) ? `${(m.fcpMs/1000).toFixed(2)} s` : 'N/D']
    ]);
  };
  render(audit.performance?.mobile, '#mobileMetrics');
  render(audit.performance?.desktop, '#desktopMetrics');
}

function renderBrowser(audit) {
  const b = audit.browser;
  if (!b || b.moduleStatus !== 'measured') {
    $('#browserMetrics').innerHTML = `<p class="muted">Chromium no disponible: ${escapeHtml(b?.error || 'sin datos')}</p>`;
    $('#visualPanel').classList.add('soft-disabled');
    return;
  }
  $('#visualPanel').classList.remove('soft-disabled');
  $('#browserMetrics').innerHTML = metricRows([
    ['HTTP renderizado', Number.isFinite(b.status) ? `HTTP ${b.status}` : 'N/D'],
    ['DOM nodes', String(b.domNodes ?? 'N/D')],
    ['Recursos', String(b.performance?.resourceCount ?? 'N/D')],
    ['Transferencia', formatBytes(b.performance?.transferBytes)],
    ['Respuesta inicial', formatMs(b.performance?.responseStartMs)],
    ['Load event', formatMs(b.performance?.loadEventMs)],
    ['Errores JS', String(b.console?.pageErrors ?? 0)],
    ['Contrastes fallidos', String(b.contrast?.failed ?? 0)],
    ['axe-core violaciones', b.axe?.moduleStatus === 'measured' ? String(b.axe?.violations ?? 0) : 'N/D'],
    ['axe-core nodos', b.axe?.moduleStatus === 'measured' ? String(b.axe?.violationNodes ?? 0) : 'N/D'],
    ['axe-core revisión', b.axe?.moduleStatus === 'measured' ? String(b.axe?.incomplete ?? 0) : 'N/D']
  ]);

  const colors = b.visual?.desktop?.colors || [];
  $('#palette').innerHTML = colors.length ? colors.map(item => `<div class="swatch"><i style="background:${escapeHtml(item.value)}"></i><span>${escapeHtml(item.value)}</span><small>${item.count}</small></div>`).join('') : '<span class="muted">Sin datos.</span>';
  const fonts = b.visual?.desktop?.fonts || [];
  $('#fonts').innerHTML = fonts.length ? fonts.map(item => `<span>${escapeHtml(item.value)} <small>${item.count}</small></span>`).join('') : '<span class="muted">Sin datos.</span>';

  const desktop = b.screenshots?.desktop;
  const mobile = b.screenshots?.mobile;
  if (desktop?.base64) $('#desktopShot').src = `data:${desktop.mime};base64,${desktop.base64}`;
  if (mobile?.base64) $('#mobileShot').src = `data:${mobile.mime};base64,${mobile.base64}`;
}


function renderInfrastructure(audit) {
  const infra = audit.infrastructure;
  const browser = audit.browser;
  const panel = $('#infrastructurePanel');
  if (!panel) return;
  if (!infra || infra.status !== 'measured') {
    panel.classList.add('soft-disabled');
    $('#infraDns').innerHTML = `<p class="muted">No disponible: ${escapeHtml(infra?.error || 'sin datos')}</p>`;
    $('#infraEmail').innerHTML = '';
    $('#infraBrowser').innerHTML = '';
    return;
  }
  panel.classList.remove('soft-disabled');
  const dns = infra.dns || {}, tls = infra.tls || {}, email = dns.email || {};
  $('#infraDns').innerHTML = metricRows([
    ['IPv4', String(dns.a?.length || 0)], ['IPv6', String(dns.aaaa?.length || 0)], ['Nameservers', String(dns.ns?.length || 0)],
    ['DNSSEC', dns.dnssec === 'validated' ? 'Validado' : (dns.dnssec === 'not-validated' ? 'No validado' : 'N/D')], ['CAA', dns.caa?.length ? `${dns.caa.length} registro(s)` : 'No detectado'],
    ['TLS autorizado', tls.status === 'measured' ? (tls.authorized ? 'Sí' : 'No') : 'N/D', tls.authorized ? 'accent-value' : ''],
    ['Protocolo TLS', tls.protocol || 'N/D'], ['Días certificado', Number.isFinite(tls.daysRemaining) ? String(tls.daysRemaining) : 'N/D']
  ]);
  $('#infraEmail').innerHTML = metricRows([
    ['MX', String(dns.mx?.length || 0)], ['SPF', email.spf?.length ? 'Detectado' : (dns.mx?.length ? 'No detectado' : 'N/A')],
    ['DMARC', email.dmarc?.length ? 'Detectado' : (dns.mx?.length ? 'No detectado' : 'N/A')],
    ['DKIM', email.dkim?.found?.length ? `${email.dkim.found.length} selector(es)` : (dns.mx?.length ? 'Requiere selector' : 'N/A')],
    ['MTA-STS', email.mtaSts?.length ? 'Detectado' : 'No detectado'], ['TLS-RPT', email.tlsRpt?.length ? 'Detectado' : 'No detectado']
  ]);
  const network = browser?.network || {};
  $('#infraBrowser').innerHTML = metricRows([
    ['Cookies', String(network.cookieCount ?? 0)], ['Hosts terceros', String(network.thirdPartyHosts ?? 0)],
    ['Trackers detectados', String(network.trackers?.length ?? 0)], ['Requests totales', String(network.requestCount ?? 0)]
  ]) + ((network.trackers || []).length ? `<div class="tracker-list">${network.trackers.map(t => `<span>${escapeHtml(t.vendor)} · ${t.count}</span>`).join('')}</div>` : '');
}

function renderPeru(audit) {
  const pe = audit.peru;
  const panel = $('#peruPanel');
  if (!panel) return;
  if (!pe) {
    panel.classList.add('soft-disabled');
    $('#peruSummary').innerHTML = '<span>Sin datos</span>';
    $('#peruChecks').innerHTML = '';
    return;
  }
  panel.classList.remove('soft-disabled');
  $('#peruSummary').innerHTML = `<span><b>${pe.summary?.observed || 0}</b> señales observadas</span><span><b>${pe.summary?.attention || 0}</b> requieren atención</span><span><b>${pe.summary?.manual || 0}</b> revisión manual</span>`;
  const labels = { observed:'Señal observada', attention:'Requiere atención', manual:'Revisión manual', not_applicable:'No aplica' };
  const sources = (pe.catalog || []).map(item => `<a class="iso-source" href="${escapeHtml(item.source)}" target="_blank" rel="noopener noreferrer">${escapeHtml(item.reference)} ↗</a>`).join('');
  $('#peruChecks').innerHTML = (pe.checks || []).map(item => `<article class="pe-check ${escapeHtml(item.status)}"><span>${escapeHtml(labels[item.status] || item.status)}</span><strong>${escapeHtml(item.title)}</strong><p>${escapeHtml(item.evidence)}</p></article>`).join('') + `<div class="pe-sources">${sources}</div>`;
}

function evidenceStorageKey(audit) { return `cybergcode-evidence:${audit?.meta?.target || 'unknown'}`; }
function readEvidenceState(audit) {
  try { return JSON.parse(localStorage.getItem(evidenceStorageKey(audit)) || '{}'); } catch { return {}; }
}
function writeEvidenceState(audit, state) { localStorage.setItem(evidenceStorageKey(audit), JSON.stringify(state)); }

function renderEvidenceCenter(audit) {
  const center = audit.iso?.evidenceCenter;
  const panel = $('#evidencePanel');
  if (!panel) return;
  if (!center?.items?.length) {
    panel.classList.add('soft-disabled');
    $('#evidenceProgress').textContent = '0 pendientes';
    $('#evidenceList').innerHTML = '<p class="muted">No hay controles manuales en esta auditoría.</p>';
    return;
  }
  panel.classList.remove('soft-disabled');
  const state = readEvidenceState(audit);
  const completed = center.items.filter(item => state[item.id]?.available).length;
  center.completed = completed;
  center.items.forEach(item => { item.clientStatus = state[item.id]?.available ? 'evidence-available' : 'pending-evidence'; });
  $('#evidenceProgress').textContent = `${completed} / ${center.items.length} con evidencia`;
  $('#evidenceList').innerHTML = center.items.map(item => {
    const checked = state[item.id]?.available ? ' checked' : '';
    return `<article class="evidence-item ${checked ? 'has-evidence' : ''}">
      <label><input type="checkbox" data-evidence-id="${escapeHtml(item.id)}"${checked}><span>Disponible</span></label>
      <div><small>${escapeHtml(item.standard)}</small><strong>${escapeHtml(item.title)}</strong><p><b>Evidencia requerida:</b> ${escapeHtml(item.evidenceRequired)}</p><p><b>Acción:</b> ${escapeHtml(item.recommendedAction || '')}</p><p class="acceptance"><b>Criterio de validación:</b> ${escapeHtml(item.acceptanceCriteria || '')}</p></div>
    </article>`;
  }).join('');
  $('#evidenceList').querySelectorAll('input[data-evidence-id]').forEach(input => input.addEventListener('change', () => {
    const fresh = readEvidenceState(audit);
    fresh[input.dataset.evidenceId] = { available: input.checked, updatedAt: new Date().toISOString() };
    writeEvidenceState(audit, fresh);
    renderEvidenceCenter(audit);
  }));
}

function renderIso(audit) {
  const iso = audit.iso;
  const panel = $('#isoPanel');
  if (!panel) return;
  if (!iso) {
    panel.classList.add('soft-disabled');
    $('#isoSummary').innerHTML = '<p class="muted">Módulo ISO no disponible.</p>';
    $('#isoStandards').innerHTML = '';
    return;
  }
  panel.classList.remove('soft-disabled');
  const o = iso.overall || {};
  $('#isoSummary').innerHTML = `
    <div class="iso-score"><b>${o.observableScore ?? 'N/D'}</b><span>Alineamiento observable / 100</span></div>
    <div class="iso-kpis"><span><b>${o.passed || 0}</b> señales alineadas</span><span><b>${o.failed || 0}</b> observaciones</span><span><b>${o.manual || 0}</b> requieren evidencia interna</span></div>
    <p class="iso-disclaimer">${escapeHtml(iso.disclaimer || '')}</p>`;

  const statusLabel = { 'observable-alignment':'Alineado observable', 'partial-alignment':'Parcial + manual', 'needs-attention':'Requiere acción', 'manual-review':'Evidencia interna' };
  const checkLabel = { pass:'Cumple observablemente', fail:'Observación', manual:'Revisión manual', not_applicable:'No aplica' };
  $('#isoStandards').innerHTML = (iso.standards || []).map(std => `
    <details class="iso-standard">
      <summary>
        <div><strong>${escapeHtml(std.reference)}</strong><span>${escapeHtml(std.name)}</span></div>
        <div class="iso-standard-status ${escapeHtml(std.status)}"><b>${std.observableScore == null ? '—' : std.observableScore}</b><span>${escapeHtml(statusLabel[std.status] || std.status)}</span></div>
      </summary>
      <p class="iso-note">${escapeHtml(std.note || '')}</p>
      <a class="iso-source" href="${escapeHtml(std.source || '#')}" target="_blank" rel="noopener noreferrer">Referencia oficial ISO ↗</a>
      <div class="iso-checks">${(std.checks || []).map(item => `
        <article class="iso-check ${escapeHtml(item.status)}">
          <div class="iso-check-head"><span>${escapeHtml(checkLabel[item.status] || item.status)}</span><strong>${escapeHtml(item.title)}</strong></div>
          <p><b>Evidencia:</b> ${escapeHtml(item.evidence || '')}</p>
          <p><b>Recomendación:</b> ${escapeHtml(item.recommendation || '')}</p>
          <p><b>Acción para levantar:</b> ${escapeHtml(item.action || '')}</p>
          <p class="acceptance"><b>Criterio de cierre:</b> ${escapeHtml(item.acceptanceCriteria || '')}</p>
        </article>`).join('')}</div>
    </details>`).join('');
}

function renderAudit(audit) {
  currentAudit = audit;
  $('#targetName').textContent = new URL(audit.meta.target).hostname;
  $('#auditMeta').textContent = `${audit.meta.id} · ${audit.summary.pagesCrawled} páginas · ${audit.summary.findingsTotal ?? audit.findings.length} hallazgos${audit.summary.payloadTruncated ? ` (mostrando ${audit.summary.findingsReturned} prioritarios)` : ''} · ${new Date(audit.meta.finishedAt).toLocaleString('es-PE')}`;
  renderScores(audit); renderStats(audit); renderPageSpeed(audit); renderBrowser(audit); renderInfrastructure(audit); renderPeru(audit); renderIso(audit); renderEvidenceCenter(audit); renderFindings(audit);
  $('#modules').innerHTML = Object.entries(audit.modules).map(([key,value]) => `<div class="module"><b>${escapeHtml(key)}</b><span class="${escapeHtml(value)}">${escapeHtml(value)}</span></div>`).join('');
  $('#pagesList').innerHTML = audit.pages.map(page => `<div class="page-row"><span title="${escapeHtml(page.url)}">${escapeHtml(new URL(page.url).pathname || '/')}</span><b>HTTP ${page.status}</b></div>`).join('');
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  submitButton.disabled = true;
  view('working');
  try {
    const response = await fetch('/api/audit', { method:'POST', headers:{'content-type':'application/json'}, body:JSON.stringify({ url:$('#url').value, maxPages:Number($('#maxPages').value), pageSpeed:$('#pageSpeed').checked }) });
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
    const payload = {
      meta: currentAudit.meta, company: currentAudit.company, scores: currentAudit.scores, summary: currentAudit.summary,
      findings: currentAudit.findings.slice(0, 100),
      performance: currentAudit.performance ? { status: currentAudit.performance.status, mobile: currentAudit.performance.mobile, desktop: currentAudit.performance.desktop } : null,
      browser: currentAudit.browser?.moduleStatus === 'measured' ? { moduleStatus:'measured', domNodes:currentAudit.browser.domNodes, performance:currentAudit.browser.performance, contrast:currentAudit.browser.contrast, responsive:currentAudit.browser.responsive, axe:currentAudit.browser.axe, network:currentAudit.browser.network } : currentAudit.browser,
      infrastructure: currentAudit.infrastructure,
      peru: currentAudit.peru,
      iso: currentAudit.iso
    };
    const response = await fetch('/api/report', { method:'POST', headers:{'content-type':'application/json'}, body:JSON.stringify(payload) });
    if (!response.ok) throw new Error('No se pudo generar el PDF.');
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `${currentAudit.meta.id}.pdf`; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
  } catch (error) { alert(error.message); }
  finally { button.disabled = false; button.textContent = 'Exportar PDF'; }
});
