const $ = (selector) => document.querySelector(selector);
const form = $('#auditForm');
const hero = $('#hero');
const working = $('#working');
const dashboard = $('#dashboard');
const errorBox = $('#errorBox');
const submitButton = form.querySelector('button[type="submit"]');
let currentAudit = null;
let currentCacheState = '—';
const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

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

function activateDashboardTab(name = 'overview') {
  document.querySelectorAll('.dashboard-tab').forEach((button) => {
    const active = button.dataset.tab === name;
    button.classList.toggle('active', active);
    button.setAttribute('aria-selected', String(active));
  });
  document.querySelectorAll('.analysis-view').forEach((section) => {
    const active = section.dataset.view === name;
    section.classList.toggle('active', active);
    section.hidden = !active;
    if (active) {
      section.querySelectorAll('.panel').forEach((panel, index) => panel.style.setProperty('--delay', `${Math.min(index, 10) * 55}ms`));
    }
  });
}

document.querySelectorAll('.dashboard-tab').forEach((button) => button.addEventListener('click', () => activateDashboardTab(button.dataset.tab)));

function initRevealAnimations() {
  const items = document.querySelectorAll('.reveal');
  if (reduceMotion || !('IntersectionObserver' in window)) { items.forEach((item) => item.classList.add('visible')); return; }
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add('visible');
      observer.unobserve(entry.target);
    });
  }, { threshold: 0.12 });
  items.forEach((item) => observer.observe(item));
}

function view(name) {
  hero.classList.toggle('hidden', name !== 'hero');
  working.classList.toggle('hidden', name !== 'working');
  dashboard.classList.toggle('hidden', name !== 'dashboard');
  errorBox.classList.toggle('hidden', name !== 'error');
  if (name === 'dashboard') activateDashboardTab('overview');
}

initRevealAnimations();

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

function scoreAppearance(score) {
  if (!Number.isFinite(score)) return { color:'var(--muted)', verdict:'Sin puntuación' };
  if (score >= 90) return { color:'var(--success)', verdict:'Excelente' };
  if (score >= 80) return { color:'var(--accent2)', verdict:'Muy bueno' };
  if (score >= 70) return { color:'var(--accent)', verdict:'Bueno' };
  if (score >= 55) return { color:'var(--warn)', verdict:'Mejorable' };
  return { color:'var(--danger)', verdict:'Prioridad alta' };
}

function animateGlobalScore(value) {
  const number = Number(value);
  const scoreNode = $('#globalScore');
  const ring = $('#scoreRing');
  const verdict = $('#scoreVerdict');
  if (!Number.isFinite(number)) {
    scoreNode.textContent = 'N/D'; ring.style.setProperty('--score', 0); verdict.textContent = 'Sin puntuación'; return;
  }
  const appearance = scoreAppearance(number);
  ring.style.setProperty('--score-color', appearance.color);
  verdict.textContent = appearance.verdict;
  if (reduceMotion) { scoreNode.textContent = String(Math.round(number)); ring.style.setProperty('--score', number); return; }
  const started = performance.now();
  const duration = 950;
  const tick = (now) => {
    const progress = Math.min(1, (now - started) / duration);
    const eased = 1 - Math.pow(1 - progress, 3);
    const current = number * eased;
    scoreNode.textContent = String(Math.round(current));
    ring.style.setProperty('--score', current.toFixed(2));
    if (progress < 1) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

function renderScores(audit) {
  animateGlobalScore(audit.scores.global);
  $('#methodology').textContent = audit.scores.methodology;
  $('#scoreCards').innerHTML = Object.entries(audit.scores.categories)
    .map(([key,value], index) => `<article class="panel score-card" style="--delay:${index * 45}ms"><span>${escapeHtml(labels[key] || key)}</span><b>${value === null ? 'N/D' : value}</b><em>${value === null ? 'pendiente' : '/ 100'}</em><div class="score-bar"><i style="--bar:${value === null ? 0 : Math.max(0, Math.min(100, value))}%"></i></div></article>`).join('');
}

function renderStats(audit) {
  const s = audit.summary;
  const stats = [
    [s.severity.critical||0,'Críticos'],[s.severity.high||0,'Altos'],[s.severity.medium||0,'Medios'],[s.severity.low||0,'Bajos'],[s.pagesCrawled,'Páginas'],[s.images,'Imágenes']
  ];
  $('#stats').innerHTML = stats.map(([value,label], index) => `<div class="stat" style="--delay:${index * 45}ms"><b>${value}</b><span>${label}</span></div>`).join('');
}

function renderFindings(audit) {
  const filter = $('#severityFilter').value;
  const findings = [...audit.findings].filter(f => filter === 'all' || f.severity === filter).sort((a,b)=>severityRank[b.severity]-severityRank[a.severity]);
  $('#findingsList').innerHTML = findings.length ? findings.map((f, index) => {
    const steps = Array.isArray(f.remediationSteps) ? f.remediationSteps : [];
    const open = f.severity === 'critical' ? ' open' : '';
    return `
    <details class="finding" style="--delay:${Math.min(index, 12) * 28}ms"${open}>
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
  return rows.map(([label,value,accent], index) => `<div style="--delay:${index * 35}ms"><span>${escapeHtml(label)}</span><b class="${accent || ''}">${escapeHtml(value)}</b></div>`).join('');
}

function renderPageSpeed(audit) {
  const render = (data, selector) => {
    if (!data) { $(selector).innerHTML = '<p class="muted">No disponible en esta ejecución.</p>'; return; }
    const c = data.categories || {}, m = data.metrics || {}, v = data.variability || {};
    const performanceRange = v.performance?.range;
    const lcpRange = v.lcpMs?.range;
    $(selector).innerHTML = metricRows([
      ['Performance', c.performance == null ? 'N/D' : `${Math.round(c.performance)}/100`, 'accent-value'],
      ['Accesibilidad', c.accessibility == null ? 'N/D' : `${Math.round(c.accessibility)}/100`],
      ['SEO Lighthouse', c.seo == null ? 'N/D' : `${Math.round(c.seo)}/100`],
      ['Best Practices', c.bestPractices == null ? 'N/D' : `${Math.round(c.bestPractices)}/100`],
      ['LCP', Number.isFinite(m.lcpMs) ? `${(m.lcpMs/1000).toFixed(2)} s` : 'N/D'],
      ['CLS', Number.isFinite(m.cls) ? m.cls.toFixed(3) : 'N/D'],
      ['TBT', formatMs(m.tbtMs)],
      ['FCP', Number.isFinite(m.fcpMs) ? `${(m.fcpMs/1000).toFixed(2)} s` : 'N/D']
    ]) + `<div class="stability-line"><b>${data.sampleCount || 1} muestra(s) · ${escapeHtml(data.aggregation || 'single-run')}</b><br>Variación Performance: ${Number.isFinite(performanceRange) ? `${Math.round(performanceRange)} pt` : 'N/D'} · LCP: ${Number.isFinite(lcpRange) ? `${Math.round(lcpRange)} ms` : 'N/D'}</div>`;
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



function pathLabel(url) {
  try { const u = new URL(url); return `${u.pathname || '/'}${u.search || ''}`; } catch { return String(url || ''); }
}

function statusPill(value, kind = '') {
  return `<span class="data-pill ${escapeHtml(kind)}">${escapeHtml(value)}</span>`;
}

function renderSeo(audit) {
  const seo = audit.seo;
  if (!seo) {
    $('#seoKpis').innerHTML = '<p class="muted">Resumen SEO no disponible.</p>';
    return;
  }
  const m = seo.metadata || {}, h = seo.headings || {}, c = seo.coverage || {}, links = seo.links || {};
  const kpis = [
    [c.indexable ?? 0, 'Indexables', 'good'],
    [m.missingTitles ?? 0, 'Sin title', (m.missingTitles || 0) ? 'bad' : 'good'],
    [m.duplicateTitleGroups ?? 0, 'Titles duplicados', (m.duplicateTitleGroups || 0) ? 'warn' : 'good'],
    [m.missingDescriptions ?? 0, 'Sin description', (m.missingDescriptions || 0) ? 'warn' : 'good'],
    [h.pagesMissingH1 ?? 0, 'Sin H1', (h.pagesMissingH1 || 0) ? 'bad' : 'good'],
    [h.pagesMultipleH1 ?? 0, 'Múltiples H1', (h.pagesMultipleH1 || 0) ? 'warn' : 'good'],
    [m.missingCanonicals ?? 0, 'Sin canonical', (m.missingCanonicals || 0) ? 'warn' : 'good'],
    [c.noindex ?? 0, 'Noindex', (c.noindex || 0) ? 'info' : 'good']
  ];
  $('#seoKpis').innerHTML = kpis.map(([value,label,state], index) => `<article class="seo-kpi ${state}" style="--delay:${index * 35}ms"><b>${value}</b><span>${escapeHtml(label)}</span></article>`).join('');

  $('#seoDomain').innerHTML = metricRows([
    ['Dominio', new URL(seo.origin).hostname],
    ['URL final', seo.finalUrl || audit.meta.target],
    ['robots.txt', seo.robots?.status == null ? 'N/D' : `HTTP ${seo.robots.status}`],
    ['Sitemaps detectados', String(seo.sitemaps?.declared?.length || 0)],
    ['URLs en sitemap', String(seo.sitemaps?.urlsDiscovered || 0)],
    ['URLs descubiertas', String(c.discovered || 0)],
    ['URLs rastreadas', String(c.crawled || 0)],
    ['Indexables observadas', String(c.indexable || 0)],
    ['Noindex observadas', String(c.noindex || 0)],
    ['Errores de rastreo', String(c.crawlErrors || 0)]
  ]);

  $('#seoLinks').innerHTML = metricRows([
    ['Enlaces internos', String(links.internal || 0)],
    ['Enlaces externos', String(links.external || 0)],
    ['Enlaces totales', String(links.total || 0)],
    ['Internos rotos observados', String(links.brokenInternalObserved || 0), links.brokenInternalObserved ? 'danger-value' : 'accent-value'],
    ['Palabras rastreadas', String(seo.content?.words || 0)],
    ['Páginas < 150 palabras', String(seo.content?.pagesUnder150Words || 0)]
  ]);
  $('#seoSchema').innerHTML = (seo.schemaTypes || []).length ? (seo.schemaTypes || []).map(type => `<span>${escapeHtml(type)}</span>`).join('') : '<span class="muted">Sin tipos Schema detectados.</span>';

  $('#seoMetaTable').innerHTML = (seo.rows || []).map(row => {
    const title = row.title ? `${escapeHtml(row.title)} <small>${row.titleLength} car.</small>` : '<strong class="issue-text">SIN TITLE</strong>';
    const desc = row.description ? `${escapeHtml(row.description)} <small>${row.descriptionLength} car.</small>` : '<strong class="issue-text">SIN DESCRIPTION</strong>';
    const canonical = row.canonical ? `${escapeHtml(pathLabel(row.canonical))}<small>${escapeHtml(row.canonicalType)}</small>` : '<strong class="warn-text">SIN CANONICAL</strong>';
    const robots = row.noindex ? statusPill('NOINDEX','warn') : statusPill(row.robots || 'indexable','good');
    const h1 = row.hCounts?.h1 === 0 ? '<strong class="issue-text">0</strong>' : `${row.hCounts?.h1 || 0}<small>${escapeHtml((row.h1Texts || []).join(' · '))}</small>`;
    return `<tr><td><a href="${escapeHtml(row.url)}" target="_blank" rel="noopener">${escapeHtml(pathLabel(row.url))}</a></td><td>${statusPill(`HTTP ${row.status}`, row.status >= 400 ? 'bad' : 'good')}</td><td>${title}</td><td>${desc}</td><td>${canonical}</td><td>${robots}</td><td>${h1}</td><td>${row.wordCount || 0}</td></tr>`;
  }).join('');

  const sections = [
    ['Titles duplicados', m.duplicateTitles || []],
    ['Descriptions duplicadas', m.duplicateDescriptions || []],
    ['H1 principales repetidos', h.duplicateH1 || []]
  ];
  $('#seoDuplicateGroups').innerHTML = sections.map(([label, groups]) => `<section class="duplicate-section"><h4>${escapeHtml(label)} <span>${groups.length}</span></h4>${groups.length ? groups.map(group => `<details><summary><strong>${escapeHtml(group.value)}</strong><span>${group.urls.length} URLs</span></summary><ul>${group.urls.map(url => `<li>${escapeHtml(pathLabel(url))}</li>`).join('')}</ul></details>`).join('') : '<p class="muted">No se detectaron grupos duplicados.</p>'}</section>`).join('');
}

function renderHeadingPage(audit, pageIndex) {
  const page = audit.pages?.[pageIndex];
  if (!page) return;
  $('#headingPageTitle').textContent = pathLabel(page.url);
  const headings = page.headings || [];
  $('#headingTree').innerHTML = headings.length ? headings.map((heading, index) => `<div class="heading-node h${heading.level}" style="--level:${heading.level};--delay:${Math.min(index,20)*22}ms"><span>H${heading.level}</span><strong>${escapeHtml(heading.text || '(vacío)')}</strong></div>`).join('') : '<div class="empty-core-state"><strong>Sin encabezados H1–H6</strong><p>Esta página no contiene encabezados semánticos detectables en el HTML rastreado.</p></div>';
}

function renderHeadings(audit) {
  const h = audit.seo?.headings || {};
  const totals = h.totals || {};
  const kpis = [
    [totals.h1 || 0,'H1'],[totals.h2 || 0,'H2'],[totals.h3 || 0,'H3'],[totals.h4 || 0,'H4'],[totals.h5 || 0,'H5'],[totals.h6 || 0,'H6'],
    [h.pagesMissingH1 || 0,'Páginas sin H1'],[h.pagesMultipleH1 || 0,'Páginas con +1 H1']
  ];
  $('#headingKpis').innerHTML = kpis.map(([value,label], index) => `<article class="heading-kpi" style="--delay:${index*35}ms"><b>${value}</b><span>${escapeHtml(label)}</span></article>`).join('');
  const select = $('#headingPageSelect');
  select.innerHTML = (audit.pages || []).map((page,index) => `<option value="${index}">${escapeHtml(pathLabel(page.url))}</option>`).join('');
  select.onchange = () => renderHeadingPage(audit, Number(select.value));
  renderHeadingPage(audit, 0);

  $('#headingMatrix').innerHTML = (audit.pages || []).map(page => {
    const counts = {1:0,2:0,3:0,4:0,5:0,6:0};
    (page.headings || []).forEach(hd => { if (counts[hd.level] != null) counts[hd.level] += 1; });
    const h1 = (page.headings || []).filter(hd => hd.level === 1).map(hd => hd.text).filter(Boolean).join(' · ');
    return `<tr><td>${escapeHtml(pathLabel(page.url))}</td>${[1,2,3,4,5,6].map(level => `<td class="num-cell ${level === 1 && counts[level] === 0 ? 'issue-cell':''}">${counts[level]}</td>`).join('')}<td>${h1 ? escapeHtml(h1) : '<strong class="issue-text">SIN H1</strong>'}</td></tr>`;
  }).join('');
}

function renderImages(audit) {
  const items = [];
  for (const page of audit.pages || []) for (const image of page.images || []) items.push({ page: page.url, ...image });
  const missingAlt = items.filter(item => item.alt === null).length;
  const emptyAlt = items.filter(item => item.alt === '').length;
  const missingDimensions = items.filter(item => !item.width || !item.height).length;
  const lazy = items.filter(item => String(item.loading).toLowerCase() === 'lazy').length;
  const responsive = items.filter(item => item.srcset).length;
  const kpis = [[items.length,'Imágenes'],[missingAlt,'Sin atributo ALT'],[emptyAlt,'ALT vacío'],[missingDimensions,'Sin width/height'],[lazy,'Lazy loading'],[responsive,'Con srcset']];
  $('#imageKpis').innerHTML = kpis.map(([value,label], index) => `<article class="image-kpi" style="--delay:${index*35}ms"><b>${value}</b><span>${escapeHtml(label)}</span></article>`).join('');
  $('#imagesTable').innerHTML = items.slice(0, 400).map(item => `<tr><td>${escapeHtml(pathLabel(item.page))}</td><td title="${escapeHtml(item.src || '')}">${escapeHtml(pathLabel(item.src || ''))}</td><td>${item.alt === null ? '<strong class="issue-text">SIN ALT</strong>' : (item.alt === '' ? '<span class="warn-text">alt=""</span>' : escapeHtml(item.alt))}</td><td>${escapeHtml(`${item.width || '—'} × ${item.height || '—'}`)}</td><td>${escapeHtml(item.loading || 'auto')}</td><td>${item.srcset ? statusPill('Sí','good') : 'No'}</td></tr>`).join('');
}

function renderPages(audit) {
  $('#pagesList').innerHTML = (audit.pages || []).map((page,index) => {
    const h1 = (page.headings || []).filter(h => h.level === 1);
    const tree = (page.headings || []).slice(0,40).map(h => `<div class="mini-heading" style="--level:${h.level}"><b>H${h.level}</b><span>${escapeHtml(h.text || '(vacío)')}</span></div>`).join('');
    return `<details class="page-audit-card" ${index === 0 ? 'open':''}><summary><div><strong>${escapeHtml(pathLabel(page.url))}</strong><span>${escapeHtml(page.title || 'Sin title')}</span></div>${statusPill(`HTTP ${page.status}`, page.status >= 400 ? 'bad':'good')}</summary><div class="page-audit-body"><dl><dt>Title</dt><dd>${escapeHtml(page.title || '—')}</dd><dt>Description</dt><dd>${escapeHtml(page.description || '—')}</dd><dt>Canonical</dt><dd>${escapeHtml(page.canonical || '—')}</dd><dt>Robots</dt><dd>${escapeHtml(page.robots || 'index/follow por defecto')}</dd><dt>Idioma</dt><dd>${escapeHtml(page.lang || '—')}</dd><dt>Viewport</dt><dd>${escapeHtml(page.viewport || '—')}</dd><dt>Palabras</dt><dd>${page.content?.wordCount || 0}</dd><dt>Imágenes</dt><dd>${page.imageCount || 0}</dd><dt>Enlaces</dt><dd>${page.linkCount || 0}</dd><dt>Schema</dt><dd>${escapeHtml((page.structuredData?.types || []).join(', ') || '—')}</dd><dt>H1</dt><dd>${h1.length} · ${escapeHtml(h1.map(h=>h.text).join(' | ') || '—')}</dd></dl><div class="mini-heading-tree"><h4>Árbol H1–H6</h4>${tree || '<p class="muted">Sin headings.</p>'}</div></div></details>`;
  }).join('');
}

function renderConsistency(audit) {
  const c = audit.meta?.consistency || {};
  const cacheLabels = { HIT:'Reutilizado · mismo resultado', STORED:'Guardado · 30 min', BYPASS:'Sin caché', '—':'Sin dato' };
  $('#cacheStatus').textContent = cacheLabels[currentCacheState] || currentCacheState;
  const rows = [
    ['Modo', c.mode === 'stable' ? 'Estable' : 'En vivo'],
    ['Perfil', c.profile || audit.browser?.auditProfile?.id || 'N/D'],
    ['Huella', c.fingerprint || 'N/D'],
    ['PageSpeed', c.pageSpeedAggregation || 'N/D'],
    ['Zona horaria', c.timezone || 'N/D'],
    ['Región función', c.functionRegion || 'N/D']
  ];
  $('#consistencyMetrics').innerHTML = rows.map(([label, value]) => `<div class="consistency-item"><span>${escapeHtml(label)}</span><b>${escapeHtml(value)}</b></div>`).join('');
}

function renderAudit(audit) {
  currentAudit = audit;
  $('#targetName').textContent = new URL(audit.meta.target).hostname;
  $('#auditMeta').textContent = `${audit.meta.id} · ${audit.summary.pagesCrawled} páginas · ${audit.summary.findingsTotal ?? audit.findings.length} hallazgos${audit.summary.payloadTruncated ? ` (mostrando ${audit.summary.findingsReturned} prioritarios)` : ''} · ${new Date(audit.meta.finishedAt).toLocaleString('es-PE')}`;
  renderScores(audit); renderStats(audit); renderConsistency(audit); renderSeo(audit); renderHeadings(audit); renderImages(audit); renderPageSpeed(audit); renderBrowser(audit); renderInfrastructure(audit); renderPeru(audit); renderIso(audit); renderEvidenceCenter(audit); renderFindings(audit); renderPages(audit);
  $('#modules').innerHTML = Object.entries(audit.modules).map(([key,value]) => `<div class="module"><b>${escapeHtml(key)}</b><span class="${escapeHtml(value)}">${escapeHtml(value)}</span></div>`).join('');
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  submitButton.disabled = true;
  view('working');
  try {
    const response = await fetch('/api/audit', { method:'POST', headers:{'content-type':'application/json'}, body:JSON.stringify({ url:$('#url').value, maxPages:Number($('#maxPages').value), pageSpeed:$('#pageSpeed').checked, stableMode:$('#stableMode').checked }) });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Error de auditoría.');
    currentCacheState = response.headers.get('x-cybergcode-cache') || '—';
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
      seo: currentAudit.seo,
      pages: currentAudit.pages,
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
