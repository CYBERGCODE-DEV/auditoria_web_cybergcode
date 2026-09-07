const $ = (selector) => document.querySelector(selector);
const form = $('#auditForm');
const hero = $('#hero');
const working = $('#working');
const dashboard = $('#dashboard');
const errorBox = $('#errorBox');
const submitButton = form.querySelector('button[type="submit"]');
let currentAudit = null;
let currentCacheState = '—';
let workingStartedAt = 0;
let workingTimerHandle = null;
let currentLargeJobId = null;
let currentLargeJobToken = null;
const AUDIT_KEY_SESSION = 'cybergcode:audit-key';

function auditAccessHeaders(extra = {}) {
  let key = '';
  try { key = sessionStorage.getItem(AUDIT_KEY_SESSION) || ''; } catch {}
  return { ...extra, ...(key ? { 'x-cybergcode-audit-key':key } : {}) };
}
let platformState = { status:null, projects:[], history:[], currentProjectId:null };
const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

function syncThemeButton() {
  const theme = window.CGAuditTheme?.get?.() || document.documentElement.dataset.theme || 'dark';
  const next = theme === 'dark' ? 'claro' : 'oscuro';
  [$('#themeToggle'),$('#workspaceThemeToggle')].filter(Boolean).forEach((button)=>{
    button.querySelector('.theme-icon').textContent = theme === 'dark' ? '☾' : '☀';
    button.querySelector('.theme-text').textContent = theme === 'dark' ? 'Oscuro' : 'Claro';
    button.setAttribute('aria-label', `Cambiar a tema ${next}`);
    button.setAttribute('title', `Cambiar a tema ${next}`);
  });
}

syncThemeButton();
window.addEventListener('cybergcode-themechange', syncThemeButton);
$('#themeToggle')?.addEventListener('click', () => window.CGAuditTheme?.toggle?.());
$('#workspaceThemeToggle')?.addEventListener('click', () => window.CGAuditTheme?.toggle?.());

const severityRank = { critical: 4, high: 3, medium: 2, low: 1, info: 0 };
const labels = { security:'Seguridad', technical:'Técnico', seo:'SEO', images:'Imágenes', performance:'Rendimiento', content:'Contenido', accessibility:'Accesibilidad', ux:'UX / CRO', compliance:'ISO / Cumplimiento observable' };

const modeDefaults = {
  quick: { maxPages:'12', pageSpeed:false },
  complete: { maxPages:'25', pageSpeed:true },
  custom: { maxPages:null, pageSpeed:true }
};

function selectedAuditMode() {
  return document.querySelector('input[name="auditMode"]:checked')?.value || 'complete';
}

function collectCustomModules() {
  return Object.fromEntries([...document.querySelectorAll('[data-module]')].map((input) => [input.dataset.module, input.checked]));
}

function syncAuditModeUi({ initial = false } = {}) {
  const mode = selectedAuditMode();
  document.querySelectorAll('.audit-mode-card').forEach((card) => card.classList.toggle('active', card.querySelector('input')?.checked));
  $('#customAuditConfig')?.classList.toggle('hidden', mode !== 'custom');
  const preset = modeDefaults[mode] || modeDefaults.complete;
  if (!initial && preset.maxPages) $('#maxPages').value = preset.maxPages;
  if (mode !== 'custom') $('#pageSpeed').checked = preset.pageSpeed;
  const contentSelected = mode !== 'custom' || collectCustomModules().content !== false;
  const aiAllowed = contentSelected && mode !== 'quick';
  $('#aiReview').disabled = !aiAllowed;
  if (!aiAllowed) $('#aiReview').checked = false;
  const deviceRelevant = mode !== 'quick';
  $('#deviceMobile').disabled = !deviceRelevant;
  $('#deviceDesktop').disabled = !deviceRelevant;
}

document.querySelectorAll('input[name="auditMode"]').forEach((input) => input.addEventListener('change', () => syncAuditModeUi()));
document.querySelectorAll('[data-module]').forEach((input) => input.addEventListener('change', () => syncAuditModeUi({ initial:true })));
$('#selectAllModules')?.addEventListener('click', () => {
  const inputs = [...document.querySelectorAll('[data-module]')];
  const shouldSelect = inputs.some((input) => !input.checked);
  inputs.forEach((input) => { input.checked = shouldSelect; });
  syncAuditModeUi({ initial:true });
});
$('#deviceMobile')?.addEventListener('change', () => { if (!$('#deviceMobile').checked && !$('#deviceDesktop').checked) $('#deviceDesktop').checked = true; });
$('#deviceDesktop')?.addEventListener('change', () => { if (!$('#deviceMobile').checked && !$('#deviceDesktop').checked) $('#deviceMobile').checked = true; });
syncAuditModeUi({ initial:true });

function syncLargeAuditHint() {
  const pages = Number($('#maxPages')?.value || 0);
  const large = pages > 50;
  $('#largeAuditHint')?.toggleAttribute('hidden', !large);
}
$('#maxPages')?.addEventListener('change', syncLargeAuditHint);
syncLargeAuditHint();

function activateDashboardTab(name = 'overview') {
  document.querySelectorAll('.dashboard-tab').forEach((button) => {
    const active = button.dataset.tab === name;
    button.classList.toggle('active', active);
    button.setAttribute('aria-selected', String(active));
    button.tabIndex = active ? 0 : -1;
  });
  const mobileSelect = $('#dashboardTabSelect');
  if (mobileSelect && mobileSelect.value !== name) mobileSelect.value = name;
  document.querySelectorAll('[data-report-tab]').forEach((button) => {
    const active = button.dataset.reportTab === name;
    button.classList.toggle('active', active);
    if (active) button.closest('details')?.setAttribute('open', '');
  });
  document.querySelectorAll('.analysis-view').forEach((section) => {
    const active = section.dataset.view === name;
    section.classList.toggle('active', active);
    section.hidden = !active;
    if (active) {
      section.querySelectorAll('.panel').forEach((panel, index) => panel.style.setProperty('--delay', `${Math.min(index, 10) * 55}ms`));
    }
  });
  syncResponsiveTableLabels();
  if (['project','history','compare'].includes(name)) loadPlatformView(name).catch((error) => console.warn('[platform-view]', error));
}

window.CGAuditOpenPlatform = (name='project') => {
  hero.classList.add('hidden'); working.classList.add('hidden'); errorBox.classList.add('hidden'); dashboard.classList.remove('hidden'); dashboard.classList.add('platform-only');
  $('#reportNavigation')?.classList.add('hidden');
  document.body.dataset.view='dashboard'; $('#targetName').textContent='Espacio de trabajo'; $('#auditMeta').textContent='Proyectos, histórico y comparaciones de tu organización'; $('#exportPdf').classList.add('hidden');
  activateDashboardTab(['project','history','compare'].includes(name)?name:'project');
};
window.CGAuditOpenNew = () => {
  dashboard.classList.add('hidden'); dashboard.classList.remove('platform-only'); $('#reportNavigation')?.classList.add('hidden'); $('#exportPdf').classList.remove('hidden'); hero.classList.remove('hidden'); document.body.dataset.view='hero'; hero.scrollIntoView({behavior:'smooth'});
};

document.querySelectorAll('.dashboard-tab').forEach((button) => {
  const name = button.dataset.tab;
  const panel = document.querySelector(`.analysis-view[data-view="${name}"]`);
  button.id = `audit-tab-${name}`;
  button.setAttribute('aria-controls', `audit-panel-${name}`);
  button.tabIndex = button.classList.contains('active') ? 0 : -1;
  if (panel) { panel.id = `audit-panel-${name}`; panel.setAttribute('aria-labelledby', button.id); }
  button.addEventListener('click', () => activateDashboardTab(name));
  button.addEventListener('keydown', (event) => {
    if (!['ArrowLeft','ArrowRight','Home','End'].includes(event.key)) return;
    const tabs = [...document.querySelectorAll('.dashboard-tab:not([hidden])')];
    const current = tabs.indexOf(button);
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : (current + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
    event.preventDefault(); activateDashboardTab(tabs[next].dataset.tab); tabs[next].focus();
  });
});
$('#dashboardTabSelect')?.addEventListener('change', (event) => activateDashboardTab(event.target.value));

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

function syncResponsiveTableLabels() {
  document.querySelectorAll('.audit-table').forEach((table) => {
    const headers = [...table.querySelectorAll('thead th')].map((cell) => cell.textContent.trim());
    table.querySelectorAll('tbody tr').forEach((row) => {
      [...row.children].forEach((cell, index) => {
        if (cell.tagName !== 'TD') return;
        const label = headers[index] || `Columna ${index + 1}`;
        cell.setAttribute('data-label', label);
      });
    });
  });
}

function syncDashboardTabAvailability() {
  const select = $('#dashboardTabSelect');
  if (!select) return;
  [...select.options].forEach((option) => {
    const button = document.querySelector(`.dashboard-tab[data-tab="${option.value}"]`);
    option.hidden = !!button?.hidden;
    option.disabled = !!button?.hidden;
  });
}

function view(name) {
  document.body.dataset.view = name;
  hero.classList.toggle('hidden', name !== 'hero');
  working.classList.toggle('hidden', name !== 'working');
  dashboard.classList.toggle('hidden', name !== 'dashboard');
  errorBox.classList.toggle('hidden', name !== 'error');
  $('#reportNavigation')?.classList.toggle('hidden', name !== 'dashboard' || !currentAudit);
  if (name === 'dashboard') activateDashboardTab('overview');
}

function formatElapsed(ms) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${String(minutes).padStart(2,'0')}:${String(seconds).padStart(2,'0')}`;
}

function startWorkingTimer() {
  stopWorkingTimer();
  workingStartedAt = Date.now();
  const node = $('#workingElapsed');
  if (node) node.textContent = '00:00';
  workingTimerHandle = window.setInterval(() => {
    if (node) node.textContent = formatElapsed(Date.now() - workingStartedAt);
  }, 1000);
}

function stopWorkingTimer() {
  if (workingTimerHandle) window.clearInterval(workingTimerHandle);
  workingTimerHandle = null;
}

function setWorkingStep(id, state = '') {
  const step = $(id);
  if (!step) return;
  step.classList.remove('active','done');
  if (state) step.classList.add(state);
}

const workingModuleMap = {
  seo:'seo', dom:'renderedDom', images:'images', accessibility:'accessibility',
  security:'security', peru:'compliancePe', iso:'isoStandards', report:'report'
};

function setWorkingText(message, status = '') {
  const activity = $('#workingActivity');
  const current = $('#workingCurrentStatus');
  const strip = $('#workingStripStatus');
  if (activity && message) activity.textContent = message;
  if (current && status) current.textContent = status;
  if (strip && status) strip.textContent = status;
}

function setLiveTask(id, state = '') {
  const row = $(id);
  if (!row) return;
  row.classList.remove('active','done');
  if (state) row.classList.add(state);
}

function setOrbitState(module, state = 'pending', label = '') {
  const node = document.querySelector(`.orbit-node[data-module="${module}"]`);
  if (!node) return;
  node.classList.remove('orbit-node-active','orbit-node-done','orbit-node-skipped','orbit-node-unavailable');
  if (state === 'active') node.classList.add('orbit-node-active');
  if (state === 'done') node.classList.add('orbit-node-done');
  if (state === 'skipped') node.classList.add('orbit-node-skipped');
  if (state === 'unavailable') node.classList.add('orbit-node-unavailable');
  const text = node.querySelector('small');
  if (text) text.textContent = label || ({ active:'Procesando', done:'Completado', skipped:'No seleccionado', unavailable:'No disponible', pending:'En espera' }[state] || 'En espera');
}

function requestedWorkingModules(payload = {}) {
  if (payload.auditMode === 'quick') return new Set(['seo','images','security']);
  if (payload.auditMode !== 'custom') return new Set(['seo','dom','images','accessibility','security','peru','iso']);
  const selected = payload.modules || {};
  const modules = new Set();
  if (selected.seo || selected.headings || selected.content || selected.ux) modules.add('seo');
  if (selected.performance || selected.accessibility || selected.visual) modules.add('dom');
  if (selected.images) modules.add('images');
  if (selected.accessibility) modules.add('accessibility');
  if (selected.security || selected.infrastructure) modules.add('security');
  if (selected.compliance) modules.add('peru');
  if (selected.iso) modules.add('iso');
  return modules;
}

function resetWorkingProgress(payload = {}) {
  document.querySelectorAll('.working-step').forEach((step) => step.classList.remove('active','done'));
  ['#liveConnection','#liveAnalysis','#liveConsolidate'].forEach((id) => setLiveTask(id));
  Object.keys(workingModuleMap).forEach((module) => setOrbitState(module));
  setOrbitState('report', 'pending');
  const modeLabels = { quick:'Rápida', complete:'Completa', custom:'Personalizada' };
  if ($('#workingMode')) $('#workingMode').textContent = modeLabels[payload.auditMode] || 'Completa';
  if ($('#workingPages')) $('#workingPages').textContent = `${payload.maxPages || Number($('#maxPages')?.value) || 25} páginas`;
  const devices = payload.devices || { mobile:$('#deviceMobile')?.checked, desktop:$('#deviceDesktop')?.checked };
  if ($('#workingDevices')) $('#workingDevices').textContent = devices.mobile && devices.desktop ? 'Móvil + escritorio' : devices.mobile ? 'Móvil' : 'Escritorio';
}

function beginServerAudit(payload) {
  const requested = requestedWorkingModules(payload);
  for (const module of Object.keys(workingModuleMap)) {
    if (module === 'report') continue;
    setOrbitState(module, requested.has(module) ? 'pending' : 'skipped', requested.has(module) ? 'Tras el rastreo' : 'No seleccionado');
  }
  setOrbitState('seo', requested.has('seo') ? 'active' : 'skipped', requested.has('seo') ? 'Iniciando rastreo' : 'No seleccionado');
  setWorkingStep('#workingStepAudit', 'active');
  setLiveTask('#liveAnalysis', 'active');
  setWorkingText('El servidor está creando el trabajo y comenzará a informar cada URL realmente procesada.', 'Preparando rastreo');
}

function completeServerAudit(audit) {
  const measured = new Set(['measured','partial','manual-required']);
  for (const [module, resultKey] of Object.entries(workingModuleMap)) {
    if (module === 'report') continue;
    const status = audit?.modules?.[resultKey];
    if (status === 'skipped') setOrbitState(module, 'skipped');
    else if (measured.has(status)) setOrbitState(module, 'done', status === 'partial' ? 'Medición parcial' : 'Completado');
    else if (status) setOrbitState(module, 'unavailable');
    else setOrbitState(module, 'done');
  }
  setWorkingStep('#workingStepAudit', 'done');
  setWorkingStep('#workingStepValidation', 'done');
  setLiveTask('#liveAnalysis', 'done');
  setWorkingStep('#workingStepConsolidate', 'active');
  setLiveTask('#liveConsolidate', 'active');
  setOrbitState('report', 'active', 'Construyendo');
  setWorkingText('Las verificaciones terminaron. Estamos organizando la evidencia y las prioridades del informe.', 'Consolidando informe');
}

function completeWorkingReport() {
  setWorkingStep('#workingStepConsolidate', 'done');
  setLiveTask('#liveConsolidate', 'done');
  setOrbitState('report', 'done');
  setWorkingText('Informe preparado con los resultados recibidos.', 'Completado');
}

initRevealAnimations();
window.addEventListener('resize', syncResponsiveTableLabels);
window.addEventListener('orientationchange', syncResponsiveTableLabels);
window.addEventListener('load', syncResponsiveTableLabels);

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
    const progress = Math.max(0, Math.min(1, (now - started) / duration));
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
  const measured = Object.entries(audit.scores.categories).filter(([,value]) => Number.isFinite(value));
  $('#scoreCards').innerHTML = measured.length ? measured
    .map(([key,value], index) => `<article class="panel score-card" style="--delay:${index * 45}ms"><span>${escapeHtml(labels[key] || key)}</span><b>${value}</b><em>/ 100</em><div class="score-bar"><i style="--bar:${Math.max(0, Math.min(100, value))}%"></i></div></article>`).join('')
    : '<div class="source-unavailable"><strong>Sin categorías puntuables</strong>No se recibió una fuente suficiente para calcular puntuaciones.</div>';
}

function renderStats(audit) {
  const s = audit.summary;
  const stats = [
    [s.severity.critical||0,'Críticos'],[s.severity.high||0,'Altos'],[s.severity.medium||0,'Medios'],[s.severity.low||0,'Bajos']
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
    if (!data) {
      const deviceName = selector.includes('mobile') ? 'mobile' : 'desktop';
      const availability = audit.performance?.deviceErrors?.[deviceName] || audit.performance?.availability;
      const detail = availability?.detail || audit.performance?.error || 'PageSpeed/Lighthouse no devolvió datos válidos en esta ejecución.';
      const action = availability?.action ? `<small><b>Acción:</b> ${escapeHtml(availability.action)}</small>` : '';
      $(selector).innerHTML = `<div class="source-unavailable"><strong>Fuente no disponible</strong>${escapeHtml(detail)}<br>${action}<small>No se asigna una puntuación ficticia.</small></div>`;
      return;
    }
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

function renderFieldPerformance(audit) {
  const crux = audit.performance?.crux;
  const node = $('#cruxMetrics');
  if (!node) return;
  if (!crux || crux.status !== 'measured') {
    node.innerHTML = `<div class="source-unavailable"><strong>${crux?.status === 'disabled' ? 'CrUX no configurado' : 'CrUX sin datos'}</strong>${escapeHtml(crux?.availability?.detail || 'No existe una muestra pública suficiente para esta URL/origen.')}${crux?.status === 'disabled' ? '<br><small>Configura CRUX_API_KEY para consultar datos reales de usuarios.</small>' : ''}</div>`;
  } else {
    const phone = crux.current?.phone; const desktop = crux.current?.desktop;
    const row = (label, rec) => { const m=rec?.metrics||{}; return [`${label} CWV`, rec ? `${Number.isFinite(m.lcp?.p75)?`LCP ${Math.round(m.lcp.p75)}ms · `:''}${Number.isFinite(m.inp?.p75)?`INP ${Math.round(m.inp.p75)}ms · `:''}${Number.isFinite(m.cls?.p75)?`CLS ${m.cls.p75.toFixed(3)}`:''}` : 'Sin muestra']; };
    const trend = (series, unit='ms') => {
      const values = (series || []).filter(Number.isFinite); if (values.length < 2) return 'N/D';
      const first=values[0], last=values[values.length-1], delta=last-first;
      const fmt=(v)=>unit==='cls'?Number(v).toFixed(3):`${Math.round(v)}ms`;
      return `${fmt(first)} → ${fmt(last)} (${delta===0?'=':(delta>0?'+':'')}${unit==='cls'?Number(delta).toFixed(3):Math.round(delta)+(unit||'')})`;
    };
    const ph = crux.history?.phone?.metrics || {};
    node.innerHTML = metricRows([row('Móvil',phone),row('Desktop',desktop),['Scope móvil',phone?.scope||'N/D'],['Scope desktop',desktop?.scope||'N/D'],['Histórico móvil LCP',trend(ph.lcp?.p75s)],['Histórico móvil INP',trend(ph.inp?.p75s)],['Histórico móvil CLS',trend(ph.cls?.p75s,'cls')]]);
  }
  const resources = audit.browser?.performance?.topSlowResources || [];
  $('#slowResources').innerHTML = resources.length ? resources.map((r)=>`<div class="resource-row"><strong title="${escapeHtml(r.name)}">${escapeHtml(pathLabel(r.name))}</strong><span>${formatMs(r.durationMs)}</span><small>${escapeHtml(r.type)} · ${formatBytes(r.transferBytes)}</small></div>`).join('') : '<p class="muted">No se recibieron Resource Timing utilizables.</p>';
}

function renderBrowser(audit) {
  const b = audit.browser;
  if (!b || b.moduleStatus !== 'measured') {
    $('#browserMetrics').innerHTML = `<div class="source-unavailable"><strong>Chromium no disponible</strong>${escapeHtml(b?.error || 'No se recibió un resultado del navegador headless.')}</div>`;
    $('#visualPanel').classList.remove('soft-disabled');
    $('#palette').innerHTML = '<span class="muted">Paleta no disponible sin DOM renderizado.</span>';
    $('#fonts').innerHTML = '<span class="muted">Tipografías no disponibles sin DOM renderizado.</span>';
    const technologies = audit.technologies || [];
    $('#technologyList').innerHTML = technologies.length ? technologies.map((item) => `<article><strong>${escapeHtml(item.name)}</strong><span>${escapeHtml(item.category || 'Tecnología')}</span><small>${Math.round((item.confidence || 0) * 100)}% confianza · ${item.pages || 1} pág.</small><p>${escapeHtml(item.evidence || '')}</p></article>`).join('') : '<p class="muted">No se detectaron tecnologías con evidencia suficiente.</p>';
    return;
  }
  $('#visualPanel').classList.remove('soft-disabled');
  $('#browserMetrics').innerHTML = metricRows([
    ['HTTP renderizado', Number.isFinite(b.status) ? `HTTP ${b.status}` : 'N/D'],
    ['DOM nodes', String(b.domNodes ?? 'N/D')],
    ['CYBERGCODE Lab Score', Number.isFinite(audit.performance?.browserLabScore) ? `${audit.performance.browserLabScore}/100` : 'N/D'],
    ['LCP lab', Number.isFinite(b.performance?.lcpMs) ? `${(b.performance.lcpMs/1000).toFixed(2)} s` : 'N/D'],
    ['CLS lab', Number.isFinite(b.performance?.cls) ? b.performance.cls.toFixed(3) : 'N/D'],
    ['FCP lab', formatMs(b.performance?.fcpMs)],
    ['TTFB lab', formatMs(b.performance?.ttfbMs)],
    ['Long tasks', `${b.performance?.longTaskCount ?? 0} · ${formatMs(b.performance?.longTaskTotalMs)}`],
    ['Recursos', String(b.performance?.resourceCount ?? 'N/D')],
    ['Transferencia', formatBytes(b.performance?.transferBytes)],
    ['Scripts bloqueantes observados', String(b.performance?.renderBlockingScripts ?? 'N/D')],
    ['Load event', formatMs(b.performance?.loadEventMs)],
    ['Errores JS', String(b.console?.pageErrors ?? 0)],
    ['Contrastes fallidos', String(b.contrast?.failed ?? 0)],
    ['axe-core violaciones', b.axe?.moduleStatus === 'measured' ? String(b.axe?.violations ?? 0) : 'N/D'],
    ['axe-core nodos', b.axe?.moduleStatus === 'measured' ? String(b.axe?.violationNodes ?? 0) : 'N/D'],
    ['axe-core revisión', b.axe?.moduleStatus === 'measured' ? String(b.axe?.incomplete ?? 0) : 'N/D']
  ]);

  const visualSource = b.visual?.desktop || b.visual?.mobile || {};
  const colors = visualSource.colors || [];
  $('#palette').innerHTML = colors.length ? colors.map(item => `<div class="swatch"><i style="background:${escapeHtml(item.value)}"></i><span>${escapeHtml(item.value)}</span><small>${item.count}</small></div>`).join('') : '<span class="muted">Sin datos.</span>';
  const fonts = visualSource.fonts || [];
  $('#fonts').innerHTML = fonts.length ? fonts.map(item => `<span>${escapeHtml(item.value)} <small>${item.count}</small></span>`).join('') : '<span class="muted">Sin datos.</span>';
  const technologies = audit.technologies || [];
  $('#technologyList').innerHTML = technologies.length ? technologies.map((item) => `<article><strong>${escapeHtml(item.name)}</strong><span>${escapeHtml(item.category || 'Tecnología')}</span><small>${Math.round((item.confidence || 0) * 100)}% confianza · ${item.pages || 1} pág.</small><p>${escapeHtml(item.evidence || '')}</p></article>`).join('') : '<p class="muted">No se detectaron tecnologías con evidencia suficiente en las páginas rastreadas.</p>';

  const desktop = b.screenshots?.desktop;
  const mobile = b.screenshots?.mobile;
  const desktopFigure = $('#desktopShot')?.closest('figure');
  const mobileFigure = $('#mobileShot')?.closest('figure');
  if (desktop?.base64) { $('#desktopShot').src = `data:${desktop.mime};base64,${desktop.base64}`; if (desktopFigure) desktopFigure.hidden=false; } else if (desktopFigure) desktopFigure.hidden=true;
  if (mobile?.base64) { $('#mobileShot').src = `data:${mobile.mime};base64,${mobile.base64}`; if (mobileFigure) mobileFigure.hidden=false; } else if (mobileFigure) mobileFigure.hidden=true;
}


function renderCssAnalysis(audit) {
  const css = audit.css;
  const summary = css?.summary;
  if (!summary || css?.status !== 'measured') {
    $('#cssSummary').innerHTML = `<div class="source-unavailable"><strong>CSS avanzado ${css?.status === 'skipped' ? 'no seleccionado' : 'no disponible'}</strong>${escapeHtml(css?.status === 'skipped' ? 'El modo de auditoría no incluyó Diseño/CSS.' : 'Se requiere un DOM renderizado válido para analizar CSSOM y estilos computados.')}</div>`;
    $('#cssTokens').innerHTML = '';
    $('#unusedCssSamples').innerHTML = '<span class="muted">Sin muestra disponible.</span>';
    return;
  }
  $('#cssSummary').innerHTML = metricRows([
    ['Hojas CSS', String(summary.stylesheets ?? 0)],
    ['Hojas accesibles por CSSOM', String(summary.accessibleStylesheets ?? 0)],
    ['Hojas cross-origin/inaccesibles', String(summary.inaccessibleStylesheets ?? 0)],
    ['Selectores estáticos evaluados', String(summary.accessibleSelectors ?? 0)],
    ['Sin coincidencia observable', String(summary.unusedSelectors ?? 0)],
    ['Ratio observable sin coincidencia', Number.isFinite(summary.unusedSelectorRatio) ? `${Math.round(summary.unusedSelectorRatio*100)}%` : 'N/D'],
    ['Elementos con style inline', String(summary.inlineStyleElements ?? 0)],
    ['Ratio inline en muestra', Number.isFinite(summary.inlineStyleRatio) ? `${Math.round(summary.inlineStyleRatio*100)}%` : 'N/D'],
    ['Custom properties declaradas', String(summary.customPropertyDeclarations ?? 0)]
  ]);
  const tokenGroup = (title, items=[]) => `<section><strong>${escapeHtml(title)}</strong><div class="chip-list">${items.length ? items.slice(0,12).map((item)=>`<span>${escapeHtml(item.value)} <small>${item.count}</small></span>`).join('') : '<span class="muted">Sin datos</span>'}</div></section>`;
  const states = summary.states || {};
  $('#cssTokens').innerHTML = tokenGroup('Spacing observado', summary.spacingValues) + tokenGroup('Border radius', summary.borderRadii) + tokenGroup('Tamaños tipográficos', summary.fontSizes) + tokenGroup('Pesos tipográficos', summary.fontWeights) + `<section><strong>Estados CSS observados</strong><div class="state-badges"><span class="${states.hover?'ok':''}">:hover</span><span class="${states.focus?'ok':''}">:focus</span><span class="${states.focusVisible?'ok':''}">:focus-visible</span><span class="${states.disabled?'ok':''}">:disabled</span><span class="${states.checked?'ok':''}">:checked</span></div></section>`;
  $('#unusedCssSamples').innerHTML = (summary.unusedSelectorSamples || []).length ? summary.unusedSelectorSamples.map((value)=>`<span>${escapeHtml(value)}</span>`).join('') : '<span class="muted">No se obtuvieron selectores estáticos sin coincidencia en la muestra accesible.</span>';
}

function a11yStorageKey(audit) { return `cybergcode-a11y-manual:${audit?.meta?.id || audit?.meta?.target || 'unknown'}`; }
function readA11yState(audit) { try { return JSON.parse(localStorage.getItem(a11yStorageKey(audit)) || '{}'); } catch { return {}; } }
function renderAccessibility(audit) {
  const manual = audit.accessibilityManual;
  const browser = audit.browser || {};
  if (!manual || manual.status === 'skipped') {
    $('#a11yKpis').innerHTML = '<div class="source-unavailable"><strong>Accesibilidad no seleccionada</strong>Este modo de auditoría no ejecutó el módulo.</div>';
    $('#a11yAutomated').innerHTML = '';
    $('#a11yManualProgress').innerHTML = '';
    $('#a11yManualList').innerHTML = '';
    return;
  }
  const axeMeasured = browser.axe?.moduleStatus === 'measured';
  const state = readA11yState(audit);
  (manual.items || []).forEach((item)=>{ item.clientStatus = state[item.id]?.reviewed ? 'reviewed' : 'pending-human-review'; });
  const completed = (manual.items || []).filter((item)=>item.clientStatus === 'reviewed').length;
  const total = manual.items?.length || 0;
  const kpis = [
    [axeMeasured ? (browser.axe?.violations ?? 0) : 'N/D','Violaciones axe-core'],
    [browser.contrast ? (browser.contrast.failed ?? 0) : 'N/D','Contrastes fallidos'],
    [browser.responsive ? (browser.responsive.smallTargets ?? 0) : 'N/D','Targets pequeños'],
    [completed,`Manual revisados / ${total}`]
  ];
  $('#a11yKpis').innerHTML = kpis.map(([value,label],index)=>`<article class="seo-kpi" style="--delay:${index*35}ms"><b>${value}</b><span>${escapeHtml(label)}</span></article>`).join('');
  $('#a11yAutomated').innerHTML = metricRows([
    ['axe-core', axeMeasured ? 'Medido' : 'No disponible'],
    ['Violaciones', axeMeasured ? String(browser.axe?.violations ?? 0) : 'N/D'],
    ['Nodos afectados', axeMeasured ? String(browser.axe?.violationNodes ?? 0) : 'N/D'],
    ['Requieren revisión axe', axeMeasured ? String(browser.axe?.incomplete ?? 0) : 'N/D'],
    ['Contraste computado', browser.contrast ? `${browser.contrast.checked ?? 0} revisados` : 'N/D']
  ]);
  $('#a11yManualProgress').innerHTML = metricRows([
    ['Estado', 'Revisión humana requerida'],
    ['Criterios', String(total)],
    ['Marcados revisados', String(completed)],
    ['Pendientes', String(Math.max(0,total-completed))]
  ]);
  $('#a11yManualList').innerHTML = (manual.items || []).map((item)=>{
    const checked = state[item.id]?.reviewed ? ' checked' : '';
    return `<article class="manual-check-item ${checked?'reviewed':''}"><label><input type="checkbox" data-a11y-id="${escapeHtml(item.id)}"${checked}><span>Revisado</span></label><div><small>${escapeHtml(item.standard)}</small><strong>${escapeHtml(item.title)}</strong><p><b>Cómo probar:</b> ${escapeHtml(item.instructions)}</p><p><b>Evidencia:</b> ${escapeHtml(item.evidenceRequired)}</p><p class="acceptance"><b>Criterio de cierre:</b> ${escapeHtml(item.acceptanceCriteria)}</p></div></article>`;
  }).join('');
  $('#a11yManualList').querySelectorAll('[data-a11y-id]').forEach((input)=>input.addEventListener('change',()=>{
    const fresh=readA11yState(audit); fresh[input.dataset.a11yId]={reviewed:input.checked,updatedAt:new Date().toISOString()}; localStorage.setItem(a11yStorageKey(audit),JSON.stringify(fresh)); renderAccessibility(audit);
  }));
}

function applyAuditTabAvailability(audit) {
  const m = audit.modules || {};
  const available = {
    overview:true, seo:m.seo !== 'skipped', headings:m.headings !== 'skipped', content:m.content !== 'skipped', ux:m.uxCro !== 'skipped', pages:true, coverage:true,
    images:m.images !== 'skipped', performance:m.performance !== 'skipped', accessibility:m.accessibility !== 'skipped', visual:m.cssColors !== 'skipped' || m.screenshots !== 'skipped',
    technology:m.technologies !== 'skipped' || m.frontendComposition !== 'skipped', infrastructure:m.security !== 'skipped' || m.dnsTls !== 'skipped',
    domain:m.domainRegistration !== 'skipped' || m.hosting !== 'skipped', peru:m.compliancePe !== 'skipped', iso:m.isoStandards !== 'skipped', findings:true,
    project:true, history:true, compare:true
  };
  document.querySelectorAll('.dashboard-tab').forEach((button)=>{ button.hidden = available[button.dataset.tab] === false; });
  syncDashboardTabAvailability();
}

function renderTechnologyProfile(audit) {
  const profile = audit.technologyProfile || { status:'unavailable', technologies:audit.technologies || [], frontendComposition:[] };
  $('#technologySummary').innerHTML = metricRows([
    ['Estado', profile.status || 'N/D'], ['Páginas HTML', String(profile.coverage?.crawledHtmlPages ?? audit.pages?.length ?? 0)],
    ['Páginas Chromium', String(profile.coverage?.browserPages ?? 0)], ['Código observable', formatBytes(profile.totalObservedCodeBytes)],
    ['Recursos sin tamaño', String(profile.resourcesWithUnavailableSize || 0)], ['Backend', 'No observable desde URL']
  ]);
  $('#frontendComposition').innerHTML = (profile.frontendComposition || []).map((item) => `<div class="composition-row"><strong>${escapeHtml(item.language)}</strong><div class="composition-track" role="img" aria-label="${escapeHtml(item.language)} ${item.percentage ?? 0}%"><div class="composition-fill" style="width:${Math.max(0, Math.min(100, Number(item.percentage || 0)))}%"></div></div><small>${item.percentage ?? 'N/D'}% · ${formatBytes(item.bytes)}</small></div>`).join('') || '<p class="muted">No hubo suficientes tamaños públicos para calcular la composición.</p>';
  $('#technologyEvidence').innerHTML = (profile.technologies || []).map((item) => `<article><strong>${escapeHtml(item.name)}</strong><span>${escapeHtml(item.category || 'Tecnología')}</span><small>${item.confidencePercent ?? Math.round((item.confidence || 0) * 100)}% confianza · ${escapeHtml(item.state || 'detectada')} · ${item.pages || 1} pág.</small><p>${escapeHtml(item.evidence || '')}</p></article>`).join('') || '<p class="muted">No se detectaron tecnologías con evidencia suficiente.</p>';
}

function renderDomainProfile(audit) {
  const registration = audit.infrastructure?.registration;
  const hosting = audit.infrastructure?.hosting;
  const date = (value) => value ? new Date(value).toLocaleDateString('es-PE', { dateStyle:'long', timeZone:'UTC' }) : 'No publicado';
  $('#domainRegistration').innerHTML = registration?.status === 'measured' ? metricRows([
    ['Dominio registrado', registration.domain || 'N/D'], ['Creación registrada', date(registration.createdAt)],
    ['Última actualización', date(registration.updatedAt)], ['Vencimiento', date(registration.expiresAt)],
    ['Días restantes', Number.isFinite(registration.daysRemaining) ? String(registration.daysRemaining) : 'No publicado'],
    ['Antigüedad', Number.isFinite(registration.ageDays) ? `${Math.floor(registration.ageDays / 365)} años (${registration.ageDays} días)` : 'No publicada'],
    ['Registrador', registration.registrar?.name || 'No publicado'], ['IANA ID', registration.registrar?.ianaId || 'No publicado'],
    ['DNSSEC RDAP', registration.dnssec || 'N/D'], ['Fuente', `RDAP · ${registration.isApexExact ? 'dominio exacto' : 'dominio registrable'}`]
  ]) : `<div class="source-unavailable"><strong>RDAP no disponible</strong>${escapeHtml(registration?.error || 'El registro no publicó datos utilizables.')}</div>`;
  $('#hostingSummary').innerHTML = hosting?.status === 'measured' ? metricRows([
    ['Red frontal / CDN', hosting.edgeProvider || 'No detectada'], ['Origen observable', hosting.originObservable ? 'Sí, parcialmente' : 'No'],
    ['Proveedor de origen', hosting.originProvider || 'No observable'], ['Clasificación', hosting.classification || 'N/D'],
    ['Confianza', Number.isFinite(hosting.confidence) ? `${Math.round(hosting.confidence * 100)}%` : 'N/D'], ['IPs públicas', String(hosting.ips?.length || 0)]
  ]) : '<div class="source-unavailable"><strong>Alojamiento no disponible</strong>No se resolvieron IP públicas utilizables.</div>';
  const chain = (hosting?.cnameChain || []).map((item) => `<article><strong>CNAME</strong><span>${escapeHtml(item.from)}</span><p>→ ${escapeHtml(item.to)}</p></article>`);
  const ips = (hosting?.ipRegistrations || []).map((item) => `<article><strong>${escapeHtml(item.ip)}</strong><span>${escapeHtml(item.organization || item.name || 'Propietario no publicado')}</span><small>${escapeHtml(item.handle || '')}${item.country ? ` · ${escapeHtml(item.country)}` : ''}</small><p>${item.status === 'measured' ? 'Propietario del rango IP observado mediante RDAP; no prueba una relación contractual de hosting.' : escapeHtml(item.error || 'Sin datos RDAP')}</p></article>`);
  $('#hostingEvidence').innerHTML = [...chain, ...ips].join('') || '<p class="muted">No se recibió evidencia de red.</p>';
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
    ['Páginas < 150 palabras', String(seo.content?.pagesUnder150Words || 0)],
    ['Profundidad máx. observada', String(seo.architecture?.maxObservedDepth ?? 0)],
    ['Sin enlaces entrantes en muestra', String(seo.architecture?.zeroInboundWithinSample?.length || 0)],
    ['Open Graph completo', `${seo.social?.openGraphComplete || 0}/${seo.coverage?.crawled || 0}`],
    ['Hreflang detectado', String(seo.social?.hreflangPages || 0)]
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

function renderContent(audit) {
  const content = audit.content;
  if (!content || content.status !== 'measured') {
    $('#contentKpis').innerHTML = '<div class="source-unavailable"><strong>Contenido no disponible</strong>No se recibió análisis textual medido.</div>';
    return;
  }
  const avgWords = content.pages ? Math.round(content.wordsTotal / content.pages) : 0;
  const kpis = [
    [content.wordsTotal || 0, 'Palabras rastreadas'], [avgWords, 'Promedio por página'], [content.paragraphsTotal || 0, 'Párrafos'],
    [content.sentencesTotal || 0, 'Frases'], [content.ctasDetected || 0, 'CTAs detectados'], [content.genericAnchors || 0, 'Enlaces genéricos']
  ];
  $('#contentKpis').innerHTML = kpis.map(([value,label], index) => `<article class="seo-kpi" style="--delay:${index*35}ms"><b>${value}</b><span>${escapeHtml(label)}</span></article>`).join('');
  $('#contentTerms').innerHTML = (content.topTerms || []).length ? content.topTerms.map((item) => `<span>${escapeHtml(item.term)} <small>${item.count}</small></span>`).join('') : '<span class="muted">Sin frecuencia léxica disponible.</span>';
  $('#contentSignals').innerHTML = metricRows([
    ['Páginas < 150 palabras', String(content.thinPages?.length || 0)],
    ['Promedio de frase elevado', String(content.longSentencePages?.length || 0)],
    ['Baja coincidencia title ↔ H1', String(content.lowTitleH1OverlapPages?.length || 0)],
    ['Bloques repetidos', String(content.duplicateParagraphGroups?.length || 0)],
    ['Enlaces genéricos', String(content.genericAnchors || 0)],
    ['CTAs observados', String(content.ctasDetected || 0)]
  ]);
  $('#contentTable').innerHTML = (audit.pages || []).map((page) => {
    const c = page.content || {};
    const overlap = Number.isFinite(c.titleH1Overlap) ? `${Math.round(c.titleH1Overlap * 100)}%` : 'N/D';
    return `<tr><td>${escapeHtml(pathLabel(page.url))}</td><td>${c.wordCount || 0}</td><td>${c.sentenceCount || 0}</td><td>${Number.isFinite(c.averageWordsPerSentence) ? c.averageWordsPerSentence : 'N/D'}</td><td>${c.ctaCount || 0}</td><td>${c.genericAnchors || 0}</td><td>${overlap}</td></tr>`;
  }).join('');
  const groups = content.duplicateParagraphGroups || [];
  $('#contentDuplicates').innerHTML = groups.length ? groups.map((group) => `<section class="duplicate-section"><h4>Texto repetido <span>${group.urls.length} URLs</span></h4><details><summary><strong>${escapeHtml(group.text.slice(0,180))}${group.text.length>180?'…':''}</strong><span>Ver URLs</span></summary><ul>${group.urls.map((url) => `<li>${escapeHtml(pathLabel(url))}</li>`).join('')}</ul></details></section>`).join('') : '<p class="muted">No se detectaron bloques largos repetidos entre las páginas rastreadas.</p>';
  const ai = content.ai;
  if (!ai || ai.status === 'disabled') $('#contentAi').innerHTML = '<div class="source-unavailable"><strong>Revisión IA no ejecutada</strong>Actívala antes de iniciar la auditoría. No afecta la puntuación técnica.</div>';
  else if (ai.status !== 'measured' || !ai.review) $('#contentAi').innerHTML = `<div class="source-unavailable"><strong>IA no disponible</strong>${escapeHtml(ai.note || 'No se generaron sugerencias.')}</div>`;
  else {
    const cards = (ai.review.pages || []).flatMap((page) => (page.observations || []).map((item) => ({ ...item, url: page.url })));
    $('#contentAi').innerHTML = `<div class="ai-card"><span>Resumen IA · ${escapeHtml(ai.model || '')}</span><strong>Análisis heurístico</strong><p>${escapeHtml(ai.review.summary || '')}</p><p class="ai-suggestion">No es un error técnico y no modifica el score.</p></div>` + cards.slice(0,12).map((item) => `<article class="ai-card"><span>${escapeHtml(item.type)} · confianza ${Math.round((item.confidence || 0)*100)}%</span><strong>${escapeHtml(item.title)}</strong><p>${escapeHtml(pathLabel(item.url))}</p><p>${escapeHtml(item.analysis)}</p><p class="ai-suggestion">${escapeHtml(item.suggestion)}</p></article>`).join('');
  }
}

function renderUx(audit) {
  const ux = audit.ux;
  if (!ux || ux.status !== 'measured') { $('#uxKpis').innerHTML = '<div class="source-unavailable"><strong>UX/CRO no disponible</strong>No existe evidencia suficiente.</div>'; return; }
  const sum = ux.summary || {};
  const kpis = [[ux.score ?? 'N/D','Score heurístico'],[sum.ctas||0,'CTAs'],[sum.forms||0,'Formularios'],[sum.fields||0,'Campos'],[sum.unlabeledFields||0,'Sin label'],[sum.directContactLinks||0,'Contacto directo']];
  $('#uxKpis').innerHTML = kpis.map(([value,label],index)=>`<article class="seo-kpi" style="--delay:${index*35}ms"><b>${value}</b><span>${escapeHtml(label)}</span></article>`).join('');
  $('#uxSignals').innerHTML = metricRows([['Enlaces genéricos',String(sum.genericAnchors||0)],['Páginas profundidad > 3',String(sum.pagesDepthOver3||0)],['Campos sin label',String(sum.unlabeledFields||0)],['Canales directos',String(sum.directContactLinks||0)]]);
  $('#uxMethodology').textContent = ux.methodology || '';
  $('#uxTable').innerHTML = (ux.rows || []).map((row)=>`<tr><td>${escapeHtml(pathLabel(row.url))}</td><td>${row.ctaCount||0}</td><td>${row.forms||0}</td><td>${row.fields||0}</td><td>${row.unlabeledFields||0}</td><td>${(row.phoneLinks||0)+(row.emailLinks||0)+(row.whatsappLinks||0)}</td><td>${Number.isFinite(row.clickDepth)?row.clickDepth:'N/D'}</td></tr>`).join('');
}

function renderImages(audit) {
  const items = [];
  for (const page of audit.pages || []) for (const image of page.images || []) items.push({ page: page.url, ...image });
  const summary = audit.imageSummary || {};
  const missingAlt = items.filter(item => item.alt === null).length;
  const emptyAlt = items.filter(item => item.alt === '').length;
  const missingDimensions = items.filter(item => !item.width || !item.height).length;
  const lazy = items.filter(item => String(item.loading).toLowerCase() === 'lazy').length;
  const responsive = items.filter(item => item.srcset).length;
  const kpis = [[items.length,'Referencias'],[summary.uniqueAssets ?? new Set(items.map(i=>i.src).filter(Boolean)).size,'Recursos únicos'],[missingAlt,'Sin atributo ALT'],[missingDimensions,'Sin width/height'],[summary.oversized || 0,'> 500 KB'],[summary.broken || 0,'Con error HTTP'],[lazy,'Lazy loading'],[responsive,'Con srcset']];
  $('#imageKpis').innerHTML = kpis.map(([value,label], index) => `<article class="image-kpi" style="--delay:${index*35}ms"><b>${value}</b><span>${escapeHtml(label)}</span></article>`).join('');
  $('#imageTransfer').innerHTML = metricRows([
    ['Assets inspeccionados', String(summary.inspectedAssets ?? audit.crawl?.imageInspection?.inspected ?? 0)],
    ['Cobertura HEAD', summary.inspectionCoverage ? `${summary.inspectionCoverage.inspected}/${summary.inspectionCoverage.totalUnique}${summary.inspectionCoverage.complete ? ' · completa' : ' · parcial'}` : 'N/D'],
    ['Peso conocido acumulado', formatBytes(summary.knownBytes)],
    ['Imágenes > 500 KB', String(summary.oversized || 0)],
    ['Formatos tradicionales pesados', String(summary.legacyLarge || 0)],
    ['Sin fuente responsive', String(summary.noResponsiveSource || 0)],
    ['Con sizes', String(summary.withSizes || 0)],
    ['Con <picture>', String(summary.withPictureSources || 0)],
    ['Decoding async', String(summary.asyncDecoding || 0)],
    ['Resolución sobredimensionada', String(summary.renderedOversize || 0)],
    ['Imágenes medidas en DOM', String(summary.renderedMeasured || 0)],
    ['Fondos CSS observados', String(summary.backgroundImagesObserved || 0)],
    ['Candidata LCP', summary.lcpCandidate ? pathLabel(summary.lcpCandidate) : 'N/D'],
    ['ALT vacío decorativo/candidato', String(emptyAlt)]
  ]);
  const formats = Object.entries(summary.byFormat || {});
  $('#imageFormats').innerHTML = formats.length ? formats.map(([format,count]) => `<span>${escapeHtml(format)} <small>${count}</small></span>`).join('') : '<span class="muted">Sin Content-Type/formato disponible.</span>';
  $('#largestImagesTable').innerHTML = (summary.largest || []).map(item => `<tr><td title="${escapeHtml(item.url || '')}">${escapeHtml(pathLabel(item.url || ''))}</td><td>${escapeHtml(pathLabel(item.pageUrl || ''))}</td><td>${escapeHtml(item.contentType || 'N/D')}</td><td>${formatBytes(item.bytes)}</td><td>${item.status == null ? 'N/D' : statusPill(`HTTP ${item.status}`, item.status >= 400 ? 'bad':'good')}</td></tr>`).join('') || '<tr><td colspan="5" class="muted">El servidor no declaró Content-Length para recursos inspeccionados o no hubo datos disponibles.</td></tr>';
  $('#imagesTable').innerHTML = items.slice(0, 400).map(item => `<tr><td>${escapeHtml(pathLabel(item.page))}</td><td title="${escapeHtml(item.src || '')}">${escapeHtml(pathLabel(item.src || ''))}</td><td>${item.alt === null ? '<strong class="issue-text">SIN ALT</strong>' : (item.alt === '' ? '<span class="warn-text">alt=""</span>' : escapeHtml(item.alt))}</td><td>${escapeHtml(`${item.width || '—'} × ${item.height || '—'}`)}</td><td>${escapeHtml(item.loading || 'auto')}</td><td>${item.srcset ? statusPill('Sí','good') : 'No'}</td></tr>`).join('');
}

function fullPageDetailMarkup(page) {
  const h1 = (page.headings || []).filter((h) => h.level === 1);
  const tree = (page.headings || []).slice(0, 120).map((h) => `<div class="mini-heading" style="--level:${h.level}"><b>H${h.level}</b><span>${escapeHtml(h.text || '(vacío)')}</span></div>`).join('');
  const images = (page.images || []).slice(0, 40).map((img) => `<li><code>${escapeHtml(pathLabel(img.src || ''))}</code> · ALT: ${escapeHtml(img.alt == null ? 'AUSENTE' : (img.alt || '(vacío)'))}</li>`).join('');
  return `<div class="large-page-detail"><h4>Detalle completo almacenado</h4><p><b>Headings:</b> ${page.headings?.length || 0} · <b>Imágenes:</b> ${page.images?.length || 0} · <b>Enlaces:</b> ${page.links?.length || 0}</p><div class="mini-heading-tree">${tree || '<p class="muted">Sin headings.</p>'}</div>${images ? `<details><summary>Imágenes de esta URL</summary><ul>${images}</ul></details>` : ''}</div>`;
}

async function loadLargePageDetail(button) {
  const id = button.dataset.jobId;
  const url = button.dataset.pageUrl;
  const target = document.getElementById(button.dataset.targetId);
  if (!id || !url || !target) return;
  button.disabled = true;
  button.textContent = 'Cargando…';
  try {
    const response = await fetch(`/api/jobs/page?id=${encodeURIComponent(id)}&url=${encodeURIComponent(url)}`, { headers:jobAccessHeaders() });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'No se pudo cargar el detalle.');
    target.innerHTML = fullPageDetailMarkup(data.page);
    button.remove();
  } catch (error) {
    target.innerHTML = `<p class="warn-text">${escapeHtml(error.message)}</p>`;
    button.disabled = false;
    button.textContent = 'Reintentar detalle';
  }
}

function renderPages(audit) {
  const largeJobId = audit.meta?.largeAudit?.jobId || null;
  $('#pagesList').innerHTML = (audit.pages || []).map((page,index) => {
    const h1 = (page.headings || []).filter(h => h.level === 1);
    const tree = (page.headings || []).slice(0,40).map(h => `<div class="mini-heading" style="--level:${h.level}"><b>H${h.level}</b><span>${escapeHtml(h.text || '(vacío)')}</span></div>`).join('');
    const seoRow = audit.seo?.rows?.[index] || {};
    const social = page.openGraph?.title || page.openGraph?.description || page.openGraph?.image ? 'Open Graph detectado' : 'Sin Open Graph completo';
    const tech = (page.technologies || []).map((item) => item.name).join(', ') || '—';
    const detailId = `page-detail-${index}`;
    const detailButton = largeJobId ? `<button type="button" class="mini-action load-page-detail" data-job-id="${escapeHtml(largeJobId)}" data-page-url="${escapeHtml(page.url)}" data-target-id="${detailId}">Cargar detalle completo</button><div id="${detailId}"></div>` : '';
    return `<details class="page-audit-card" ${index === 0 ? 'open':''}><summary><div><strong>${escapeHtml(pathLabel(page.url))}</strong><span>${escapeHtml(page.title || 'Sin title')}</span></div>${statusPill(`HTTP ${page.status}`, page.status >= 400 ? 'bad':'good')}</summary><div class="page-audit-body"><dl><dt>Title</dt><dd>${escapeHtml(page.title || '—')}</dd><dt>Description</dt><dd>${escapeHtml(page.description || '—')}</dd><dt>Canonical</dt><dd>${escapeHtml(page.canonical || '—')}</dd><dt>Robots</dt><dd>${escapeHtml(page.robots || 'index/follow por defecto')}</dd><dt>Idioma</dt><dd>${escapeHtml(page.lang || '—')}</dd><dt>Viewport</dt><dd>${escapeHtml(page.viewport || '—')}</dd><dt>Profundidad</dt><dd>${Number.isFinite(seoRow.clickDepth) ? seoRow.clickDepth : 'No alcanzable desde la muestra'}</dd><dt>Entrantes internos</dt><dd>${seoRow.inboundInternal ?? 0}</dd><dt>Social</dt><dd>${escapeHtml(social)}</dd><dt>Hreflang</dt><dd>${page.hreflang?.length || 0}</dd><dt>Paginación</dt><dd>${page.pagination?.prev || page.pagination?.next ? `${page.pagination?.prev ? 'prev ' : ''}${page.pagination?.next ? 'next' : ''}` : '—'}</dd><dt>Palabras</dt><dd>${page.content?.wordCount || 0}</dd><dt>Frases</dt><dd>${page.content?.sentenceCount || 0}</dd><dt>CTAs</dt><dd>${page.content?.ctaCount || 0}</dd><dt>Imágenes</dt><dd>${page.imageCount || 0}</dd><dt>Enlaces</dt><dd>${page.linkCount || 0}</dd><dt>Schema</dt><dd>${escapeHtml((page.structuredData?.types || []).join(', ') || '—')}</dd><dt>Tecnologías</dt><dd>${escapeHtml(tech)}</dd><dt>H1</dt><dd>${h1.length} · ${escapeHtml(h1.map(h=>h.text).join(' | ') || '—')}</dd></dl><div class="mini-heading-tree"><h4>Árbol H1–H6${largeJobId ? ' (resumen)' : ''}</h4>${tree || '<p class="muted">Sin headings.</p>'}</div>${detailButton}</div></details>`;
  }).join('');
  document.querySelectorAll('.load-page-detail').forEach((button) => button.addEventListener('click', () => loadLargePageDetail(button)));
}

function renderCoverage(audit) {
  const sampling = audit.templateSampling || {};
  const templates = sampling.templates || [];
  const reps = sampling.representatives || [];
  const browserSamples = sampling.browserSamples?.samples || [];
  const large = audit.meta?.largeAudit || null;
  const discovered = audit.summary?.pagesDiscovered ?? audit.seo?.coverage?.discovered ?? 0;
  const crawled = audit.summary?.pagesCrawled ?? 0;
  const groups = sampling.coverage?.groups ?? templates.length;
  const kpis = [[crawled,'Páginas HTML'],[discovered,'URLs descubiertas'],[groups,'Plantillas observadas'],[reps.length,'Representantes']];
  $('#coverageKpis').innerHTML = kpis.map(([value,label],index)=>`<article class="seo-kpi" style="--delay:${index*35}ms"><b>${value}</b><span>${escapeHtml(label)}</span></article>`).join('');
  $('#coverageMetrics').innerHTML = metricRows([
    ['Modo', large ? 'Job por lotes' : 'Auditoría directa'],
    ['Límite solicitado', String(large?.requestedPages ?? audit.crawl?.limit ?? crawled)],
    ['URLs procesadas', String(large?.processedUrls ?? crawled)],
    ['HTML correctos', String(large?.successfulPages ?? crawled)],
    ['URLs fallidas', String(large?.failedUrls ?? audit.summary?.errors ?? 0)],
    ['Fin de rastreo', large?.crawlCompleteReason || 'límite/directo'],
    ['Almacenamiento', large?.detailStorage || 'resultado directo'],
    ['Método plantillas', sampling.method || 'URL + estructura']
  ]);
  $('#templateGroups').innerHTML = templates.length ? templates.map((item)=>`<article class="template-card"><span>${escapeHtml(item.id || '')} · confianza ${Math.round((item.confidence || 0)*100)}%</span><strong>${escapeHtml(item.label || item.type || 'Plantilla')}</strong><b>${item.count || 0}</b><small>páginas · mediana ${item.medianWords || 0} palabras</small><code title="${escapeHtml(item.representativeUrl || '')}">${escapeHtml(pathLabel(item.representativeUrl || '—'))}</code></article>`).join('') : '<p class="muted">No se generó agrupación de plantillas.</p>';
  const rows = reps.map((rep) => {
    const sample = browserSamples.find((x) => x.templateId === rep.templateId);
    const state = sample?.status || (audit.meta?.largeAudit ? 'pendiente/no requerido' : 'representante');
    const cls = sample?.status === 'measured' ? 'measured' : sample?.status === 'unavailable' ? 'unavailable' : '';
    const perf = sample?.performance ? [Number.isFinite(sample.performance.ttfbMs) ? `TTFB ${Math.round(sample.performance.ttfbMs)} ms` : null, Number.isFinite(sample.performance.lcpMs) ? `LCP ${Math.round(sample.performance.lcpMs)} ms` : null].filter(Boolean).join(' · ') : '';
    return `<article class="representative-item ${cls}"><span>${escapeHtml(rep.templateId)}</span><div><strong>${escapeHtml(rep.label)}</strong><small title="${escapeHtml(rep.url)}">${escapeHtml(pathLabel(rep.url))} · representa ${rep.count} página(s)${perf ? ` · ${escapeHtml(perf)}` : ''}</small></div><b>${escapeHtml(state)}</b></article>`;
  });
  $('#representativeSamples').innerHTML = rows.length ? rows.join('') : '<p class="muted">Sin muestra representativa disponible.</p>';
}

function renderActionPlan(audit) {
  const findings = [...(audit.findings || [])].sort((a,b) => (severityRank[b.severity]||0) - (severityRank[a.severity]||0));
  const immediate = findings.filter((item) => ['critical','high'].includes(item.severity)).slice(0,8);
  const quick = findings.filter((item) => ['high','medium'].includes(item.severity) && /baja/i.test(item.effort || '')).slice(0,8);
  const kpis = [
    [findings.filter((item)=>item.severity==='critical').length,'Críticos'],
    [findings.filter((item)=>item.severity==='high').length,'Altos'],
    [quick.length,'Quick wins visibles'],
    [findings.filter((item)=>/alta/i.test(item.effort || '')).length,'Esfuerzo alto/mixto']
  ];
  $('#actionPlanKpis').innerHTML = kpis.map(([value,label],index)=>`<article class="seo-kpi" style="--delay:${index*35}ms"><b>${value}</b><span>${escapeHtml(label)}</span></article>`).join('');
  const cards = (items, empty) => items.length ? items.map((item,index)=>`<article class="action-item"><span>${String(index+1).padStart(2,'0')}</span><div><strong>${escapeHtml(item.title)}</strong><small>${escapeHtml(item.category)} · ${escapeHtml(item.effort || 'Por evaluar')}</small><p>${escapeHtml(item.recommendation || '')}</p></div></article>`).join('') : `<p class="muted">${escapeHtml(empty)}</p>`;
  $('#priorityActions').innerHTML = cards(immediate, 'No hay hallazgos críticos o altos en la muestra devuelta.');
  $('#quickWins').innerHTML = cards(quick, 'No se identificaron quick wins con esfuerzo bajo entre hallazgos altos/medios.');
  const lowEffort = (item) => /baja/i.test(item.effort || '');
  const highImpact = (item) => ['critical','high'].includes(item.severity);
  const buckets = [
    ['Alto impacto · bajo esfuerzo', findings.filter((item)=>highImpact(item)&&lowEffort(item))],
    ['Alto impacto · mayor esfuerzo', findings.filter((item)=>highImpact(item)&&!lowEffort(item))],
    ['Mejora · bajo esfuerzo', findings.filter((item)=>!highImpact(item)&&lowEffort(item))],
    ['Mejora · mayor esfuerzo', findings.filter((item)=>!highImpact(item)&&!lowEffort(item))]
  ];
  $('#actionMatrix').innerHTML = buckets.map(([label,items],index)=>`<section class="action-quadrant q${index+1}"><strong>${escapeHtml(label)}</strong><b>${items.length}</b><div>${items.slice(0,4).map((item)=>`<span title="${escapeHtml(item.title)}">${escapeHtml(item.ruleId)}</span>`).join('') || '<small>Sin hallazgos</small>'}</div></section>`).join('');
}

function renderConsistency(audit) {
  const c = audit.meta?.consistency || {};
  const cacheLabels = { HIT:'Reutilizado · mismo resultado', STORED:'Guardado · 30 min', BYPASS:'Sin caché', JOB:'Job por lotes', '—':'Sin dato' };
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
  dashboard.classList.remove('platform-only'); $('#exportPdf').classList.remove('hidden');
  $('#targetName').textContent = new URL(audit.meta.target).hostname;
  $('#auditMeta').textContent = `${audit.meta.id} · ${audit.summary.pagesCrawled} páginas · ${audit.summary.findingsTotal ?? audit.findings.length} hallazgos${audit.summary.payloadTruncated ? ` (mostrando ${audit.summary.findingsReturned} prioritarios)` : ''} · ${new Date(audit.meta.finishedAt).toLocaleString('es-PE')}`;
  applyAuditTabAvailability(audit); renderScores(audit); renderStats(audit); renderConsistency(audit); renderActionPlan(audit); renderSeo(audit); renderHeadings(audit); renderContent(audit); renderUx(audit); renderImages(audit); renderPageSpeed(audit); renderFieldPerformance(audit); renderBrowser(audit); renderCssAnalysis(audit); renderAccessibility(audit); renderTechnologyProfile(audit); renderInfrastructure(audit); renderDomainProfile(audit); renderPeru(audit); renderIso(audit); renderEvidenceCenter(audit); renderFindings(audit); renderPages(audit); renderCoverage(audit); renderOverview(audit);
  syncResponsiveTableLabels();
  $('#modules').innerHTML = Object.entries(audit.modules).map(([key,value]) => `<div class="module"><b>${escapeHtml(key)}</b><span class="${escapeHtml(value)}">${escapeHtml(value)}</span></div>`).join('');
  syncCurrentProjectFromAudit(audit);
  $('#reportNavigation')?.classList.remove('hidden');
  if ($('#reportFindingCount')) $('#reportFindingCount').textContent = String(audit.summary?.findingsTotal ?? audit.findings?.length ?? 0);
}



function severityLabel(value) {
  return ({ critical:'CRÍTICO', high:'ALTO', medium:'MEDIO', low:'BAJO', info:'INFO' }[value] || String(value || '').toUpperCase());
}

function renderOverview(audit) {
  const seo = audit.seo || {};
  const m = seo.metadata || {}, h = seo.headings || {}, c = seo.coverage || {}, links = seo.links || {};
  if (audit.modules?.seo === 'skipped') {
    $('#overviewSeoSnapshot').innerHTML = '<div class="source-unavailable"><strong>SEO no seleccionado</strong>El modo personalizado no incluyó este módulo.</div>';
  } else {
    $('#overviewSeoSnapshot').innerHTML = metricRows([
      ['Indexables', String(c.indexable ?? 0)], ['Sin title', String(m.missingTitles ?? 0)], ['Titles duplicados', String(m.duplicateTitleGroups ?? 0)],
      ['Sin description', String(m.missingDescriptions ?? 0)], ['Sin H1', String(h.pagesMissingH1 ?? 0)], ['Múltiples H1', String(h.pagesMultipleH1 ?? 0)],
      ['Sin canonical', String(m.missingCanonicals ?? 0)], ['robots.txt', seo.robots?.status == null ? 'N/D' : `HTTP ${seo.robots.status}`],
      ['URLs descubiertas', String(c.discovered ?? 0)], ['URLs rastreadas', String(c.crawled ?? 0)], ['Enlaces internos', String(links.internal ?? 0)], ['Enlaces externos', String(links.external ?? 0)]
    ]);
  }
  const totals = h.totals || {};
  if (audit.modules?.headings === 'skipped') {
    $('#overviewHeadingSnapshot').innerHTML = '<div class="source-unavailable"><strong>H1–H6 no seleccionado</strong>Sin puntuación ni observaciones de headings.</div>';
    $('#overviewHeadingNote').textContent = '';
  } else {
    $('#overviewHeadingSnapshot').innerHTML = [1,2,3,4,5,6].map(level => `<div><b>${totals[`h${level}`] || 0}</b><span>H${level}</span></div>`).join('');
    const dup = (m.duplicateDescriptions || []).length;
    $('#overviewHeadingNote').textContent = `${h.pagesMissingH1 || 0} página(s) sin H1 · ${h.pagesMultipleH1 || 0} con múltiples H1${dup ? ` · ${dup} grupo(s) de descriptions duplicadas` : ''}.`;
  }

  $('#overviewPagesTable').innerHTML = audit.modules?.headings === 'skipped' ? '<tr><td colspan="8" class="muted">La matriz H1–H6 no fue seleccionada en esta auditoría.</td></tr>' : (audit.pages || []).slice(0,8).map(page => {
    const counts = {1:0,2:0,3:0,4:0,5:0,6:0};
    (page.headings || []).forEach(x => { if (counts[x.level] != null) counts[x.level] += 1; });
    const h1 = (page.headings || []).find(x => x.level === 1)?.text || '—';
    return `<tr><td>${escapeHtml(pathLabel(page.url))}</td>${[1,2,3,4,5,6].map(level => `<td class="num-cell">${counts[level]}</td>`).join('')}<td>${escapeHtml(h1)}</td></tr>`;
  }).join('');

  const findings = [...(audit.findings || [])].sort((a,b) => (severityRank[b.severity]||0)-(severityRank[a.severity]||0)).slice(0,7);
  $('#topFindings').innerHTML = findings.length ? findings.map(f => `<article class="top-finding"><span class="badge ${escapeHtml(f.severity)}">${severityLabel(f.severity)}</span><div><strong>${escapeHtml(f.title)}</strong><small>${escapeHtml(f.ruleId || '')}</small></div></article>`).join('') : '<div class="empty-rail">No se recibieron observaciones priorizadas.</div>';

  const unmeasured = Object.entries(audit.modules || {}).filter(([,v]) => ['unavailable','planned'].includes(v)).map(([k]) => k);
  $('#auditInfo').innerHTML = metricRows([
    ['ID', audit.meta?.id || '—'], ['Dominio', new URL(audit.meta.target).hostname], ['Modo', audit.meta?.auditConfig?.label || audit.meta?.mode || '—'], ['Dispositivos', `${audit.meta?.auditConfig?.devices?.mobile ? 'Móvil' : ''}${audit.meta?.auditConfig?.devices?.mobile && audit.meta?.auditConfig?.devices?.desktop ? ' + ' : ''}${audit.meta?.auditConfig?.devices?.desktop ? 'Escritorio' : ''}` || 'N/D'], ['Páginas', String(audit.summary?.pagesCrawled ?? 0)], ['Hallazgos', String(audit.summary?.findingsTotal ?? audit.findings?.length ?? 0)],
    ['Motor', `CYBERGCODE ${audit.meta?.engineVersion || '0.21.0'}`], ['Región', audit.meta?.consistency?.functionRegion || 'N/D'], ['Política de datos', audit.meta?.dataIntegrity?.simulated === false ? 'Medidos · sin simulación' : 'N/D'], ['Módulos no medidos', unmeasured.length ? unmeasured.join(', ') : 'Ninguno']
  ]);
}

function prepareWorkingIdentity(raw, payload = {}) {
  let host = raw.replace(/^https?:\/\//i,'').split('/')[0] || raw || 'sitio';
  host = host.replace(/^www\./i, '');
  resetWorkingProgress(payload);
  $('#workingDomain').textContent = host;
  $('#identityHost').textContent = host;
  $('#identitySource').textContent = 'Pendiente';
  const logo = $('#workingSiteLogo');
  logo.hidden = true;
  logo.removeAttribute('src');
  $('#workingSiteFallback').hidden = false;
  $('#workingSiteFallback').textContent = host.split('.')[0].slice(0,3).toUpperCase();
  const status = $('#identityStatus');
  status.classList.remove('ready','fallback');
  status.querySelector('span').textContent = 'Buscando logo real del dominio…';
  setWorkingStep('#workingStepConnection', 'active');
  setLiveTask('#liveConnection', 'active');
  setWorkingText('Preparando una conexión segura con el dominio.', 'Conectando');
}

function visualSourceLabel(visual) {
  if (!visual) return 'No publicado / no accesible';
  const labels = {
    'image': 'Logo / imagen de marca en HTML',
    'inline-svg': 'Logo SVG inline del HTML',
    'jsonld-logo': 'Logo declarado en Schema/JSON-LD',
    'meta-logo': 'Logo declarado en metadatos',
    'icon': 'Icono del sitio',
    'og-image': 'Imagen Open Graph',
    'favicon-fallback': 'Favicon del dominio'
  };
  return labels[visual.kind] || 'Recurso visual publicado por el sitio';
}

async function showDetectedSiteLogo(data) {
  if (!data?.visual?.dataUrl) return false;
  const img = $('#workingSiteLogo');
  img.src = data.visual.dataUrl;
  try { await img.decode?.(); } catch { /* load event fallback below */ }
  img.hidden = false;
  $('#workingSiteFallback').hidden = true;
  return true;
}

async function loadSiteIdentity(raw) {
  setWorkingStep('#workingStepIdentity', 'active');
  try {
    const response = await fetch('/api/identity', { method:'POST', headers:auditAccessHeaders({'content-type':'application/json'}), body:JSON.stringify({ url: raw }) });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Sin identidad visual');
    if (data.hostname) {
      $('#workingDomain').textContent = data.hostname;
      $('#identityHost').textContent = data.hostname;
    }
    const hasVisual = await showDetectedSiteLogo(data);
    const status = $('#identityStatus');
    status.classList.add(hasVisual ? 'ready' : 'fallback');
    status.querySelector('span').textContent = hasVisual ? 'Logo real detectado y cargado' : 'El sitio no publicó un logo utilizable; se muestra fallback textual';
    $('#identitySource').textContent = visualSourceLabel(data.visual);
    setWorkingStep('#workingStepConnection', 'done');
    setWorkingStep('#workingStepIdentity', 'done');
    setLiveTask('#liveConnection', 'done');
    return data;
  } catch (error) {
    const status = $('#identityStatus');
    status.classList.add('fallback');
    status.querySelector('span').textContent = 'No fue posible obtener un logo público de forma segura';
    $('#identitySource').textContent = 'Fallback textual del dominio';
    setWorkingStep('#workingStepConnection', 'done');
    setWorkingStep('#workingStepIdentity', 'done');
    setLiveTask('#liveConnection', 'done');
    return null;
  }
}

function updateLargeJobProgress(job) {
  const panel = $('#jobProgressPanel');
  if (!panel || !job) return;
  panel.hidden = false;
  const processed = Number(job.processedCount || 0);
  const max = Math.max(1, Number(job.maxPages || 1));
  const denominator = job.crawlCompleteReason === 'queue-exhausted' ? Math.max(1, processed) : max;
  const ratio = job.status === 'crawl-complete' || job.status === 'finalizing' || job.status === 'completed' ? 100 : Math.min(100, Math.round((processed / denominator) * 100));
  const phase = job.status === 'finalizing' ? 'Consolidando resultados' : job.status === 'crawl-complete' ? 'Rastreo HTML completado' : job.status === 'completed' ? 'Auditoría completada' : 'Rastreo por lotes';
  $('#jobProgressPhase').textContent = phase;
  $('#jobProgressCount').textContent = job.crawlCompleteReason === 'queue-exhausted' ? `${processed} URLs procesadas · cola agotada antes del límite ${max}` : `${processed} / ${max} URLs procesadas · ${job.successfulCount || 0} HTML · ${job.failedCount || 0} fallidas`;
  $('#jobProgressBar').style.width = `${ratio}%`;
  const orchestration = job.orchestration?.mode === 'queue' ? 'Cola autónoma Vercel' : 'Procesamiento desde cliente';
  const retries = Number(job.retryCount || 0) + Number(job.finalizeRetryCount || 0);
  const lastEvent = job.events?.length ? job.events[job.events.length - 1]?.message : '';
  $('#jobProgressDetail').textContent = `Descubiertas: ${job.discoveredCount || 0} · Cola URL: ${job.queueRemaining || 0} · Lotes: ${job.chunkCount || 0} · ${orchestration}${retries ? ` · Reintentos: ${retries}` : ''}${lastEvent ? ` · ${lastEvent}` : ''}.`;
  if (job.status === 'crawling') {
    setOrbitState('seo', 'active', `${processed} URL${processed === 1 ? '' : 's'}`);
    setWorkingText(`Rastreo confirmado: ${processed} URL${processed === 1 ? '' : 's'} procesada${processed === 1 ? '' : 's'} de un máximo de ${max}.`, 'Rastreando páginas');
  }
  if (job.status === 'crawl-complete') {
    setOrbitState('seo', 'done', `${processed} URL${processed === 1 ? '' : 's'}`);
    setWorkingStep('#workingStepAudit', 'done');
    setWorkingStep('#workingStepValidation', 'active');
    setWorkingText(`El rastreo terminó con ${processed} URL${processed === 1 ? '' : 's'}. El servidor está validando los módulos restantes.`, 'Validando resultados');
  }
  if (job.status === 'finalizing') {
    setWorkingStep('#workingStepValidation', 'active');
    setWorkingStep('#workingStepConsolidate', 'active');
    setLiveTask('#liveConsolidate', 'active');
    setOrbitState('report', 'active', 'Construyendo');
    const requested = requestedWorkingModules({ auditMode:job.config?.mode, modules:job.config?.modules });
    for (const module of requested) if (module !== 'seo') setOrbitState(module, 'active', 'Validando');
    setWorkingText('El servidor está consolidando la evidencia obtenida durante el rastreo.', 'Consolidando informe');
  }
  if (job.status === 'completed') completeWorkingReport();
}

const LARGE_JOB_STORAGE_KEY = 'cybergcode:active-large-job';

function jobAccessHeaders(extra = {}) {
  return { ...extra, ...(currentLargeJobToken ? { 'x-cybergcode-job-token':currentLargeJobToken } : {}) };
}

function saveLargeJobReference(job, target) {
  if (!job?.id) return;
  localStorage.setItem(LARGE_JOB_STORAGE_KEY, JSON.stringify({ id:job.id, token:currentLargeJobToken, target:target || job.target, savedAt:new Date().toISOString() }));
}

function clearLargeJobReference() {
  localStorage.removeItem(LARGE_JOB_STORAGE_KEY);
  $('#resumeJob')?.classList.add('hidden');
}

function readLargeJobReference() {
  try { return JSON.parse(localStorage.getItem(LARGE_JOB_STORAGE_KEY) || 'null'); } catch { return null; }
}

async function getLargeJobStatus(id) {
  const response = await fetch(`/api/jobs/status?id=${encodeURIComponent(id)}`, { headers:jobAccessHeaders() });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'No se pudo consultar el job.');
  return data.job;
}

async function getLargeJobResult(id) {
  const response = await fetch(`/api/jobs/result?id=${encodeURIComponent(id)}`, { headers:jobAccessHeaders() });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'No se pudo recuperar el resultado del job.');
  return data;
}

const sleepMs = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function waitForAutonomousJob(job, target) {
  let current = job;
  while (current && !['completed','failed','cancelled'].includes(current.status)) {
    saveLargeJobReference(current, target || current.target);
    updateLargeJobProgress(current);
    await sleepMs(1400);
    current = await getLargeJobStatus(current.id);
  }
  if (!current) throw new Error('El job dejó de estar disponible antes de completar.');
  updateLargeJobProgress(current);
  if (current.status === 'failed') { clearLargeJobReference(); throw new Error(current.error || 'El job de auditoría falló.'); }
  if (current.status === 'cancelled') { clearLargeJobReference(); throw new Error('La auditoría grande fue cancelada.'); }
  const stored = await getLargeJobResult(current.id);
  if (!stored?.result) throw new Error('El job finalizó pero el resultado aún no está disponible.');
  clearLargeJobReference();
  return stored.result;
}

async function processClientJobStep(job) {
  let attempts = 0;
  while (attempts < 5) {
    const response = await fetch('/api/jobs/process', { method:'POST', headers:jobAccessHeaders({'content-type':'application/json'}), body:JSON.stringify({ id:job.id }) });
    const data = await response.json();
    if (response.ok) return data.job;
    if (!data.retryable) throw new Error(data.error || 'Falló un lote del rastreo.');
    attempts += 1;
    if (data.job) updateLargeJobProgress(data.job);
    await sleepMs(Math.min(6000, 700 * (2 ** attempts)));
    job = await getLargeJobStatus(job.id);
  }
  throw new Error('El lote agotó los reintentos disponibles desde el navegador.');
}

async function finalizeClientJob(job) {
  let attempts = 0;
  while (attempts < 4) {
    const response = await fetch('/api/jobs/finalize', { method:'POST', headers:jobAccessHeaders({'content-type':'application/json'}), body:JSON.stringify({ id:job.id }) });
    const data = await response.json();
    if (response.ok) return data;
    if (!data.retryable) throw new Error(data.error || 'No se pudo consolidar la auditoría grande.');
    attempts += 1;
    if (data.job) updateLargeJobProgress(data.job);
    await sleepMs(Math.min(9000, 1000 * (2 ** attempts)));
  }
  throw new Error('La consolidación agotó sus reintentos disponibles desde el navegador.');
}

async function runLargeAudit(payload = null, { resumeId = null, resumeTarget = null, resumeToken = null } = {}) {
  let job;
  let orchestrationMode = null;
  const target = resumeTarget || payload?.url || '';

  if (resumeId) {
    currentLargeJobToken = resumeToken;
    job = await getLargeJobStatus(resumeId);
    currentLargeJobId = job.id;
    orchestrationMode = job.orchestration?.mode || 'client';
    updateLargeJobProgress(job);
    if (job.status === 'completed') {
      const stored = await getLargeJobResult(job.id);
      clearLargeJobReference();
      return stored.result;
    }
  } else {
    const startResponse = await fetch('/api/jobs/start', { method:'POST', headers:auditAccessHeaders({'content-type':'application/json'}), body:JSON.stringify(payload) });
    const startData = await startResponse.json();
    if (!startResponse.ok) throw new Error(startData.error || 'No se pudo iniciar el job de auditoría.');
    job = startData.job;
    currentLargeJobToken = startData.accessToken;
    orchestrationMode = startData.orchestration?.mode || job.orchestration?.mode || 'client';
    currentLargeJobId = job.id;
    saveLargeJobReference(job, target || job.target);
    updateLargeJobProgress(job);
  }

  if (orchestrationMode === 'queue' || job.orchestration?.mode === 'queue') {
    currentCacheState = 'JOB AUTÓNOMO';
    return waitForAutonomousJob(job, target || job.target);
  }

  currentCacheState = 'JOB CLIENTE';
  while (job.status === 'crawling') {
    job = await processClientJobStep(job);
    saveLargeJobReference(job, target || job.target);
    updateLargeJobProgress(job);
    if (job?.busy) await sleepMs(900);
    else await sleepMs(120);
  }

  if (job.status === 'failed') { clearLargeJobReference(); throw new Error(job.error || 'El job de auditoría falló.'); }
  if (job.status === 'cancelled') { clearLargeJobReference(); throw new Error('La auditoría grande fue cancelada.'); }
  if (job.status !== 'crawl-complete' && job.status !== 'finalizing') throw new Error(`Estado de job inesperado: ${job.status}`);
  updateLargeJobProgress({ ...job, status:'finalizing' });
  const finalData = await finalizeClientJob(job);
  updateLargeJobProgress(finalData.job);
  clearLargeJobReference();
  return finalData.result;
}

async function discoverResumableJob() {
  const ref = readLargeJobReference();
  if (!ref?.id) return;
  try {
    const job = await getLargeJobStatus(ref.id);
    if (!job || job.status === 'failed' || job.status === 'cancelled') { clearLargeJobReference(); return; }
    const box = $('#resumeJob');
    box.classList.remove('hidden');
    const status = job.status === 'completed' ? 'resultado listo' : `${job.processedCount || 0}/${job.maxPages || '?'} URLs procesadas`;
    $('#resumeJobText').textContent = `${ref.target || job.target} · ${status} · job ${job.id}`;
    $('#resumeJobButton').textContent = job.status === 'completed' ? 'Ver resultado' : 'Reanudar';
    $('#resumeJobButton').dataset.jobId = job.id;
    $('#resumeJobButton').dataset.target = ref.target || job.target || '';
  } catch { clearLargeJobReference(); }
}

$('#resumeJobButton')?.addEventListener('click', async (event) => {
  const button = event.currentTarget;
  const id = button.dataset.jobId;
  const target = button.dataset.target;
  if (!id) return;
  button.disabled = true;
  submitButton.disabled = true;
  view('working');
  startWorkingTimer();
  prepareWorkingIdentity(target);
  loadSiteIdentity(target).catch(() => null);
  currentCacheState = 'JOB';
  try {
    const ref = readLargeJobReference();
    const result = await runLargeAudit(null, { resumeId:id, resumeTarget:target, resumeToken:ref?.token || null });
    completeServerAudit(result);
    completeWorkingReport();
    stopWorkingTimer();
    renderAudit(result);
    view('dashboard');
  } catch (error) {
    stopWorkingTimer();
    $('#errorText').textContent = error.message;
    view('error');
  } finally {
    button.disabled = false;
    submitButton.disabled = false;
  }
});

$('#discardJobButton')?.addEventListener('click', async () => {
  const ref = readLargeJobReference();
  if (ref?.id) {
    try {
      currentLargeJobToken = ref.token || null;
      await fetch('/api/jobs/cancel', { method:'POST', headers:jobAccessHeaders({'content-type':'application/json'}), body:JSON.stringify({ id:ref.id }) });
    } catch { /* el TTL del job también limpia el estado temporal */ }
  }
  clearLargeJobReference();
});
discoverResumableJob();

function platformDate(value) {
  if (!value) return '—';
  try { return new Date(value).toLocaleString('es-PE', { dateStyle:'medium', timeStyle:'short' }); } catch { return String(value); }
}

const PLATFORM_KEY_SESSION = 'cybergcode:platform-key';
function platformKey() { try { return sessionStorage.getItem(PLATFORM_KEY_SESSION) || ''; } catch { return ''; } }
function platformHeaders(extra = {}) {
  const key = platformKey();
  return { ...extra, ...(key ? { 'x-cybergcode-platform-key':key } : {}) };
}
function platformFetch(url, options = {}) { return fetch(url, { ...options, headers:platformHeaders(options.headers || {}) }); }

function setPlatformBadge(state) {
  const badge = $('#platformDbBadge');
  if (!badge) return;
  const dbReady = state?.database?.ready === true;
  const authorized = state?.access?.authorized === true;
  const ready = dbReady && authorized;
  badge.classList.toggle('ready', ready);
  badge.classList.toggle('protected', dbReady && !authorized);
  badge.classList.toggle('offline', !dbReady);
  badge.querySelector('span').textContent = ready ? 'Histórico activo' : (dbReady ? 'Histórico protegido' : 'Histórico local');
  badge.title = ready ? 'Base SQL conectada y acceso administrativo autorizado.' : (dbReady ? 'Base SQL conectada; introduce la clave de plataforma para consultar el histórico.' : (state?.database?.reason || 'Base SQL no configurada.'));
}

async function fetchPlatformStatus({ force = false } = {}) {
  if (platformState.status && !force) return platformState.status;
  try {
    const response = await platformFetch('/api/platform?resource=status', { cache:'no-store' });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || `No se pudo consultar la plataforma (HTTP ${response.status}).`);
    platformState.status = data;
    platformState.projects = data.recentProjects || platformState.projects;
    setPlatformBadge(data);
    return data;
  } catch (error) {
    platformState.status = { database:{ configured:false, ready:false, reason:String(error?.message || error) } };
    setPlatformBadge(platformState.status);
    return platformState.status;
  }
}

function syncCurrentProjectFromAudit(audit) {
  const project = audit?.meta?.platform?.project || null;
  if (project?.id) {
    platformState.currentProjectId = project.id;
    const name = $('#currentProjectName'); if (name) name.textContent = project.name || project.domain;
    const nameInput = $('#projectNameInput'); if (nameInput) nameInput.value = project.name || project.domain || '';
    const descInput = $('#projectDescriptionInput'); if (descInput) descInput.value = project.description || '';
  }
  const status = audit?.meta?.platform?.status;
  if (status === 'stored') {
    $('#platformDbBadge')?.classList.add('ready');
    const label = $('#platformDbBadge span'); if (label) label.textContent = 'Histórico activo';
  }
}

async function refreshProjects({ selectCurrent = true } = {}) {
  const status = await fetchPlatformStatus();
  if (!status?.database?.ready || !status?.access?.authorized) {
    platformState.projects = [];
    renderPlatformUnavailable(status?.database?.ready ? 'Acceso administrativo requerido para consultar proyectos.' : status?.database?.reason);
    return [];
  }
  const response = await platformFetch('/api/platform?resource=projects&limit=100', { cache:'no-store' });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'No se pudieron cargar los proyectos.');
  platformState.projects = data.projects || [];
  if (selectCurrent && !platformState.currentProjectId) {
    const host = currentAudit?.meta?.target ? new URL(currentAudit.meta.target).hostname.replace(/^www\./,'') : null;
    platformState.currentProjectId = platformState.projects.find((project) => project.domain === host)?.id || platformState.projects[0]?.id || null;
  }
  renderProjectList();
  fillProjectSelectors();
  return platformState.projects;
}

function renderPlatformUnavailable(reason = '') {
  const pill = $('#platformStatusPill'); if (pill) { pill.textContent = 'No configurado'; pill.classList.remove('pass'); }
  const metrics = $('#platformStatusMetrics');
  if (metrics) metrics.innerHTML = `<div class="source-unavailable platform-diagnostic"><strong>Histórico persistente desactivado</strong><span>${escapeHtml(reason || 'Configura DB_PROVIDER=postgres y SUPABASE_DB_URL con la cadena del pooler de Supabase.')}</span><small>Las claves SUPABASE_URL y SUPABASE_ANON_KEY autentican usuarios, pero no sustituyen la conexión SQL del histórico.</small></div>`;
  const projectList = $('#projectList'); if (projectList) projectList.innerHTML = '<div class="source-unavailable"><strong>Sin base de datos</strong>El auditor sigue funcionando normalmente; solo la persistencia histórica está desactivada.</div>';
  const history = $('#historyList'); if (history) history.innerHTML = '<div class="source-unavailable"><strong>Histórico no disponible</strong>No se inventan ejecuciones pasadas.</div>';
}

function renderProjectList() {
  const node = $('#projectList'); if (!node) return;
  if (!platformState.projects.length) {
    node.innerHTML = '<div class="source-unavailable"><strong>Aún no hay proyectos</strong>Completa una auditoría con la base SQL conectada para crear el proyecto automáticamente.</div>';
    return;
  }
  node.innerHTML = platformState.projects.map((project) => `<button class="project-card ${project.id === platformState.currentProjectId ? 'active' : ''}" type="button" data-project-id="${escapeHtml(project.id)}"><span><strong>${escapeHtml(project.name || project.domain)}</strong><small>${escapeHtml(project.domain)}</small></span><span class="project-card-metrics"><b>${project.auditCount}</b><small>auditorías</small><b>${project.lastScore ?? '—'}</b><small>último score</small></span><em>${escapeHtml(platformDate(project.lastAuditAt))}</em></button>`).join('');
  node.querySelectorAll('[data-project-id]').forEach((button) => button.addEventListener('click', async () => {
    platformState.currentProjectId = button.dataset.projectId;
    renderProjectList(); fillProjectSelectors(); await loadProjectHistory(platformState.currentProjectId); renderCurrentProjectPanel();
  }));
}

function renderCurrentProjectPanel() {
  const project = platformState.projects.find((item) => item.id === platformState.currentProjectId) || currentAudit?.meta?.platform?.project || null;
  if (!project) {
    $('#currentProjectName').textContent = 'Sin proyecto persistente';
    $('#currentProjectMetrics').innerHTML = '<div class="source-unavailable"><strong>Proyecto no disponible</strong>Ejecuta una auditoría con DATABASE_URL configurada.</div>';
    $('#projectEditForm')?.classList.add('hidden');
    return;
  }
  $('#projectEditForm')?.classList.remove('hidden');
  $('#currentProjectName').textContent = project.name || project.domain;
  $('#projectNameInput').value = project.name || project.domain || '';
  $('#projectDescriptionInput').value = project.description || '';
  $('#currentProjectMetrics').innerHTML = metricRows([
    ['ID', project.id], ['Dominio', project.domain], ['Auditorías', String(project.auditCount ?? 0)], ['Última auditoría', platformDate(project.lastAuditAt)], ['Último score', project.lastScore ?? '—']
  ]);
}

function fillProjectSelectors() {
  const historySelect = $('#historyProjectSelect');
  if (historySelect) {
    historySelect.innerHTML = platformState.projects.map((project) => `<option value="${escapeHtml(project.id)}" ${project.id === platformState.currentProjectId ? 'selected' : ''}>${escapeHtml(project.name || project.domain)}</option>`).join('');
  }
}

async function renderProjectView() {
  const status = await fetchPlatformStatus();
  const ready = status?.database?.ready;
  const authorized = status?.access?.authorized === true;
  const pill = $('#platformStatusPill');
  if (pill) { pill.textContent = !ready ? 'No configurado' : (authorized ? 'Conectado' : 'Protegido'); pill.classList.toggle('pass', ready && authorized); }
  if (!ready) { renderPlatformUnavailable(status?.database?.reason); return; }
  $('#platformStatusMetrics').innerHTML = metricRows([
    ['Proveedor', status.database.label || status.database.provider || 'SQL'], ['Dialecto', status.database.dialect || 'N/D'], ['Driver', status.database.driver || 'N/D'], ['Servidor', status.database.serverVersion || 'N/D'], ['Base de datos', 'Conectada'], ['Acceso', authorized ? 'Autorizado' : (status.access?.configured ? 'Clave requerida' : 'CYBERGCODE_PLATFORM_KEY no configurada')], ['Última comprobación', platformDate(status.database.serverTime)]
  ]);
  if (!authorized) {
    $('#projectList').innerHTML = '<div class="source-unavailable"><strong>Histórico protegido</strong>Introduce la clave administrativa configurada en Vercel para consultar proyectos y auditorías.</div>';
    return;
  }
  await refreshProjects();
  renderCurrentProjectPanel();
}

async function loadProjectHistory(projectId = platformState.currentProjectId) {
  if (!projectId) { platformState.history = []; renderHistory(); return []; }
  const response = await platformFetch(`/api/platform?resource=history&projectId=${encodeURIComponent(projectId)}&limit=60`, { cache:'no-store' });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'No se pudo cargar el histórico.');
  platformState.history = data.audits || [];
  renderHistory();
  fillComparisonSelectors();
  return platformState.history;
}

function renderHistory() {
  const summary = $('#historySummary');
  const list = $('#historyList');
  if (!summary || !list) return;
  const rows = platformState.history || [];
  if (!rows.length) {
    summary.innerHTML = '';
    list.innerHTML = '<div class="source-unavailable"><strong>Sin auditorías persistidas</strong>Las nuevas auditorías aparecerán aquí automáticamente.</div>';
    return;
  }
  const scores = rows.map((audit) => audit.globalScore).filter(Number.isFinite);
  const latest = rows[0];
  summary.innerHTML = `<span><b>${rows.length}</b><small>auditorías cargadas</small></span><span><b>${latest?.globalScore ?? '—'}</b><small>último score</small></span><span><b>${scores.length ? Math.min(...scores) : '—'}</b><small>mínimo</small></span><span><b>${scores.length ? Math.max(...scores) : '—'}</b><small>máximo</small></span>`;
  list.innerHTML = rows.map((audit, index) => `<article class="history-item"><div class="history-score"><strong>${audit.globalScore ?? '—'}</strong><small>/100</small></div><div><strong>${escapeHtml(platformDate(audit.completedAt))}</strong><small>${escapeHtml(audit.id)} · ${audit.pagesCrawled} páginas · ${audit.findingsTotal} hallazgos</small><span>${escapeHtml(audit.mode || 'Auditoría')}</span></div><div class="history-actions"><button type="button" class="mini-action" data-compare-before="${escapeHtml(audit.id)}">Antes</button><button type="button" class="mini-action" data-compare-after="${escapeHtml(audit.id)}">Después</button>${audit.resultStored ? `<button type="button" class="mini-action" data-load-audit="${escapeHtml(audit.id)}">Abrir</button>` : ''}</div></article>`).join('');
  list.querySelectorAll('[data-compare-before]').forEach((button) => button.addEventListener('click', () => { activateDashboardTab('compare'); $('#compareBefore').value = button.dataset.compareBefore; }));
  list.querySelectorAll('[data-compare-after]').forEach((button) => button.addEventListener('click', () => { activateDashboardTab('compare'); $('#compareAfter').value = button.dataset.compareAfter; }));
  list.querySelectorAll('[data-load-audit]').forEach((button) => button.addEventListener('click', async () => {
    const response = await platformFetch(`/api/platform?resource=audit-record&id=${encodeURIComponent(button.dataset.loadAudit)}&result=1`, { cache:'no-store' });
    const data = await response.json();
    if (!response.ok || !data.audit?.result) return alert(data.error || 'El resultado completo no está almacenado.');
    renderAudit(data.audit.result); view('dashboard');
  }));
}

function fillComparisonSelectors() {
  const before = $('#compareBefore'), after = $('#compareAfter');
  if (!before || !after) return;
  const options = (platformState.history || []).map((audit) => `<option value="${escapeHtml(audit.id)}">${escapeHtml(platformDate(audit.completedAt))} · ${audit.globalScore ?? '—'}/100</option>`).join('');
  before.innerHTML = options; after.innerHTML = options;
  if (platformState.history.length >= 2) {
    before.value = platformState.history[platformState.history.length - 1].id;
    after.value = platformState.history[0].id;
  }
}

async function renderHistoryView() {
  const status = await fetchPlatformStatus();
  if (!status?.database?.ready || !status?.access?.authorized) { renderPlatformUnavailable(status?.database?.ready ? 'Acceso administrativo requerido.' : status?.database?.reason); return; }
  await refreshProjects();
  if (platformState.currentProjectId) await loadProjectHistory(platformState.currentProjectId);
}

function deltaClass(item) {
  if (!item || item.unchanged) return 'neutral';
  return item.improved ? 'improved' : 'worsened';
}
function deltaText(item, unit = '') {
  if (!item) return 'N/D';
  const sign = item.change > 0 ? '+' : '';
  const decimals = Math.abs(item.change) < 1 && item.change !== 0 ? 3 : 0;
  return `${item.before}${unit} → ${item.after}${unit} (${sign}${Number(item.change).toFixed(decimals)}${unit})`;
}
function comparisonRows(items) {
  return Object.entries(items).map(([label,item]) => `<div class="comparison-row ${deltaClass(item)}"><span>${escapeHtml(label)}</span><b>${escapeHtml(deltaText(item))}</b></div>`).join('');
}

async function runComparisonRequest() {
  const before = $('#compareBefore').value, after = $('#compareAfter').value;
  if (!before || !after || before === after) { $('#comparisonHint').textContent = 'Selecciona dos auditorías diferentes.'; return; }
  $('#comparisonHint').textContent = 'Calculando deltas sobre datos persistidos…';
  const response = await platformFetch(`/api/platform?resource=comparison&before=${encodeURIComponent(before)}&after=${encodeURIComponent(after)}`, { cache:'no-store' });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'No se pudo comparar.');
  const c = data.comparison;
  $('#comparisonResult').classList.remove('hidden');
  const global = c.scores?.global;
  const totalFindings = c.findings?.total;
  $('#comparisonKpis').innerHTML = `<article class="comparison-kpi ${deltaClass(global)}"><span>Score global</span><strong>${global?.after ?? '—'}</strong><small>${global ? `${global.change > 0 ? '+' : ''}${global.change} puntos` : 'N/D'}</small></article><article class="comparison-kpi ${deltaClass(totalFindings)}"><span>Hallazgos</span><strong>${totalFindings?.after ?? '—'}</strong><small>${totalFindings ? `${totalFindings.change > 0 ? '+' : ''}${totalFindings.change}` : 'N/D'}</small></article><article class="comparison-kpi"><span>Antes</span><strong>${escapeHtml(platformDate(c.before?.completedAt))}</strong><small>${escapeHtml(c.before?.id || '')}</small></article><article class="comparison-kpi"><span>Después</span><strong>${escapeHtml(platformDate(c.after?.completedAt))}</strong><small>${escapeHtml(c.after?.id || '')}</small></article>`;
  $('#comparisonScores').innerHTML = comparisonRows(Object.fromEntries(Object.entries(c.scores?.categories || {}).filter(([,v]) => v)));
  $('#comparisonFindings').innerHTML = comparisonRows({ 'Total':c.findings?.total, 'Críticos':c.findings?.critical, 'Altos':c.findings?.high, 'Medios':c.findings?.medium });
  $('#comparisonSeo').innerHTML = comparisonRows({ 'Sin title':c.seo?.missingTitle, 'Titles duplicados':c.seo?.duplicateTitles, 'Sin description':c.seo?.missingDescription, 'Sin canonical':c.seo?.missingCanonical, 'Sin H1':c.seo?.missingH1, 'Enlaces rotos':c.seo?.brokenInternalLinks });
  const perf = c.performance || {};
  $('#comparisonPerformance').innerHTML = comparisonRows({ 'Mobile score':perf.mobile?.score, 'Mobile LCP':perf.mobile?.lcp, 'Mobile CLS':perf.mobile?.cls, 'Mobile INP':perf.mobile?.inp, 'Desktop score':perf.desktop?.score, 'Desktop LCP':perf.desktop?.lcp, 'Desktop CLS':perf.desktop?.cls, 'Desktop INP':perf.desktop?.inp });
  $('#comparisonHint').textContent = 'Comparación completada con snapshots persistidos.';
}

async function renderCompareView() {
  const status = await fetchPlatformStatus();
  if (!status?.database?.ready || !status?.access?.authorized) { renderPlatformUnavailable(status?.database?.ready ? 'Acceso administrativo requerido.' : status?.database?.reason); return; }
  await refreshProjects();
  if (platformState.currentProjectId) await loadProjectHistory(platformState.currentProjectId);
}

async function loadPlatformView(name) {
  if (name === 'project') return renderProjectView();
  if (name === 'history') return renderHistoryView();
  if (name === 'compare') return renderCompareView();
}

$('#platformAccessForm')?.addEventListener('submit', async (event) => {
  event.preventDefault();
  const key = $('#platformAccessKey')?.value || '';
  try { sessionStorage.setItem(PLATFORM_KEY_SESSION, key); } catch {}
  platformState.status = null;
  const status = await fetchPlatformStatus({ force:true });
  if (!status?.access?.authorized) {
    $('#platformStatusPill').textContent = status?.access?.configured ? 'Clave inválida' : 'Clave no configurada';
    return;
  }
  await renderProjectView();
});

$('#refreshProjects')?.addEventListener('click', () => renderProjectView().catch((error) => alert(error.message)));
$('#createProjectToggle')?.addEventListener('click', () => $('#projectCreateForm')?.classList.toggle('hidden'));
$('#projectCreateForm')?.addEventListener('submit', async (event) => {
  event.preventDefault();
  const response = await platformFetch('/api/platform?resource=projects', {
    method:'POST',
    headers:{'content-type':'application/json'},
    body:JSON.stringify({ domain:$('#newProjectDomain').value, name:$('#newProjectName').value, description:$('#newProjectDescription').value })
  });
  const data = await response.json();
  if (!response.ok) return alert(data.error || 'No se pudo crear el proyecto.');
  platformState.currentProjectId = data.project?.id || null;
  event.currentTarget.reset();
  event.currentTarget.classList.add('hidden');
  await refreshProjects({ selectCurrent:false });
  renderCurrentProjectPanel();
});
$('#historyProjectSelect')?.addEventListener('change', async (event) => { platformState.currentProjectId = event.target.value; renderProjectList(); await loadProjectHistory(event.target.value); renderCurrentProjectPanel(); });
$('#runComparison')?.addEventListener('click', () => runComparisonRequest().catch((error) => { $('#comparisonHint').textContent = error.message; }));
$('#projectEditForm')?.addEventListener('submit', async (event) => {
  event.preventDefault();
  const id = platformState.currentProjectId;
  if (!id) return;
  const response = await platformFetch(`/api/platform?resource=project&id=${encodeURIComponent(id)}`, { method:'PATCH', headers:{'content-type':'application/json'}, body:JSON.stringify({ name:$('#projectNameInput').value, description:$('#projectDescriptionInput').value }) });
  const data = await response.json();
  if (!response.ok) return alert(data.error || 'No se pudo guardar el proyecto.');
  await refreshProjects({ selectCurrent:false }); renderCurrentProjectPanel();
});
$('#archiveProject')?.addEventListener('click', async () => {
  const id = platformState.currentProjectId;
  if (!id || !window.confirm('¿Archivar este proyecto? Las auditorías se conservarán y un administrador podrá recuperarlo.')) return;
  const project = platformState.projects.find((item) => item.id === id);
  const response = await platformFetch(`/api/platform?resource=project&id=${encodeURIComponent(id)}`, { method:'PATCH', headers:{'content-type':'application/json'}, body:JSON.stringify({ name:project?.name, description:project?.description, archived:true }) });
  const data = await response.json();
  if (!response.ok) return alert(data.error || 'No se pudo archivar el proyecto.');
  platformState.currentProjectId = null;
  await refreshProjects();
  renderCurrentProjectPanel();
});

fetchPlatformStatus().catch(() => null);
try { $('#auditAccessKey').value = sessionStorage.getItem(AUDIT_KEY_SESSION) || ''; } catch {}
$('#auditAccessKey')?.addEventListener('change', (event) => { try { sessionStorage.setItem(AUDIT_KEY_SESSION, event.target.value.trim()); } catch {} });

document.querySelectorAll('[data-open-tab]').forEach(button => button.addEventListener('click', () => activateDashboardTab(button.dataset.openTab)));
document.querySelectorAll('[data-report-tab]').forEach(button => button.addEventListener('click', () => {
  activateDashboardTab(button.dataset.reportTab);
  if (window.innerWidth <= 896) document.body.classList.remove('sidebar-open');
  document.querySelector('.dashboard-head')?.scrollIntoView({ behavior:reduceMotion ? 'auto' : 'smooth', block:'start' });
}));
document.querySelectorAll('[data-jump-tab]').forEach(button => button.addEventListener('click', () => { if (!currentAudit) return; activateDashboardTab(button.dataset.jumpTab); document.querySelector('.dashboard-nav')?.scrollIntoView({behavior: reduceMotion ? 'auto' : 'smooth', block:'start'}); }));

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  try { sessionStorage.setItem(AUDIT_KEY_SESSION, $('#auditAccessKey')?.value.trim() || ''); } catch {}
  const payload = { url:$('#url').value, auditMode:selectedAuditMode(), modules:selectedAuditMode()==='custom'?collectCustomModules():{}, devices:{ mobile:$('#deviceMobile').checked, desktop:$('#deviceDesktop').checked }, maxPages:Number($('#maxPages').value), pageSpeed:$('#pageSpeed').checked, stableMode:$('#stableMode').checked, aiReview:$('#aiReview')?.checked === true };
  submitButton.disabled = true;
  view('working');
  startWorkingTimer();
  const rawTarget = $('#url').value.trim();
  prepareWorkingIdentity(rawTarget, payload);
  const identityPromise = loadSiteIdentity(rawTarget);
  try {
    beginServerAudit(payload);
    currentCacheState = 'JOB CON PROGRESO';
    const data = await runLargeAudit(payload);
    await identityPromise.catch(() => null);
    completeServerAudit(data);
    completeWorkingReport();
    stopWorkingTimer();
    renderAudit(data); view('dashboard');
  } catch (error) {
    stopWorkingTimer();
    $('#errorText').textContent = error.message; view('error');
  } finally { submitButton.disabled = false; }
});

$('#severityFilter').addEventListener('change', () => currentAudit && renderFindings(currentAudit));
$('#newAudit').addEventListener('click', () => { stopWorkingTimer(); currentAudit = null; currentLargeJobId = null; currentLargeJobToken = null; $('#jobProgressPanel').hidden = true; window.CGAuditOpenNew(); $('#url').focus(); });
$('#retryButton').addEventListener('click', () => { stopWorkingTimer(); view('hero'); });
$('#exportPdf').addEventListener('click', async () => {
  if (!currentAudit) return;
  const button = $('#exportPdf');
  button.disabled = true; button.textContent = 'Generando…';
  try {
    const payload = {
      meta: currentAudit.meta, company: currentAudit.company, scores: currentAudit.scores, summary: currentAudit.summary,
      findings: currentAudit.findings.slice(0, 100),
      performance: currentAudit.performance || null,
      browser: currentAudit.browser?.moduleStatus === 'measured' ? { moduleStatus:'measured', domNodes:currentAudit.browser.domNodes, performance:currentAudit.browser.performance, contrast:currentAudit.browser.contrast, responsive:currentAudit.browser.responsive, axe:currentAudit.browser.axe, network:currentAudit.browser.network } : currentAudit.browser,
      infrastructure: currentAudit.infrastructure,
      seo: currentAudit.seo,
      content: currentAudit.content,
      ux: currentAudit.ux,
      imageSummary: currentAudit.imageSummary,
      technologies: currentAudit.technologies,
      technologyProfile: currentAudit.technologyProfile,
      css: currentAudit.css,
      accessibilityManual: currentAudit.accessibilityManual,
      pages: currentAudit.pages,
      peru: currentAudit.peru,
      iso: currentAudit.iso,
      templateSampling: currentAudit.templateSampling || null
    };
    const response = await fetch('/api/report', { method:'POST', headers:auditAccessHeaders({'content-type':'application/json'}), body:JSON.stringify(payload) });
    if (!response.ok) { const detail = await response.json().catch(() => null); throw new Error(detail?.error || 'No se pudo generar el PDF.'); }
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `${currentAudit.meta.id}.pdf`; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
  } catch (error) { alert(error.message); }
  finally { button.disabled = false; button.textContent = 'Exportar PDF'; }
});
