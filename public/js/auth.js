const $ = (selector) => document.querySelector(selector);
let session = { configured:false, authenticated:false, user:null };

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>'"]/g,(char)=>({ '&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;' }[char]));
}

async function jsonFetch(url, options = {}) {
  const response = await fetch(url,{ ...options, headers:{ ...(options.body ? {'content-type':'application/json'} : {}), ...(options.headers || {}) } });
  const data = await response.json().catch(()=>({}));
  if (!response.ok) throw Object.assign(new Error(data.error || 'No se pudo completar la solicitud.'),{ status:response.status, code:data.code });
  return data;
}

function applySession(next) {
  session = next || { configured:false,authenticated:false,user:null };
  const authenticated = Boolean(session.authenticated && session.user);
  $('#publicPortal').hidden = authenticated;
  $('#privateApp').hidden = !authenticated;
  $('#loginOpen').classList.toggle('hidden',authenticated);
  $('#logoutButton').classList.toggle('hidden',!authenticated);
  $('#sessionUser').classList.toggle('hidden',!authenticated);
  $('#adminOpen').classList.toggle('hidden',!session.user?.isAdmin);
  $('#sidebarAdmin')?.classList.toggle('hidden',!session.user?.isAdmin);
  $('#profileOpen').classList.toggle('hidden',!authenticated);
  $('#publicNav').classList.toggle('hidden',authenticated);
  $('#platformDbBadge')?.classList.toggle('hidden',!authenticated);
  $('#workspaceNav')?.classList.toggle('hidden',!authenticated);
  if (authenticated) {
    $('#sessionUser').textContent = session.user.name || session.user.email;
    if ($('#sidebarUser')) $('#sidebarUser').textContent = session.user.name || session.user.email;
    if ($('#activationUsername')) $('#activationUsername').value = session.user.email || '';
    document.body.dataset.authenticated = 'true';
    const keyField = $('#auditAccessKey')?.closest('label');
    if (keyField) keyField.classList.add('hidden');
    const secureLabel = $('#auditAccessKey')?.closest('.form-options')?.querySelector('.secure-label');
    if (secureLabel) secureLabel.classList.add('hidden');
  } else {
    delete document.body.dataset.authenticated;
    document.body.dataset.view = 'public';
  }
}

async function loadSession() {
  try { applySession(await jsonFetch('/api/auth?action=session')); }
  catch (error) {
    if (error.status === 401) applySession({ configured:true,authenticated:false,user:null });
    else applySession({ configured:false,authenticated:false,user:null });
  }
}

function severityLabel(value) { return ({critical:'Crítico',high:'Alto',medium:'Medio',low:'Bajo'}[value] || value || 'Informativo'); }

function renderDemo(data) {
  const score = Number.isFinite(data.score) ? data.score : '—';
  const findings = (data.findings || []).map((finding)=>`<article class="demo-finding"><span class="badge ${escapeHtml(finding.severity)}">${escapeHtml(severityLabel(finding.severity))}</span><h3>${escapeHtml(finding.title)}</h3><p>${escapeHtml(finding.recommendation || 'Consulta el informe completo para revisar la evidencia y el criterio de cierre.')}</p></article>`).join('');
  const locked = (data.lockedSections || []).map((label)=>`<li><span>🔒</span>${escapeHtml(label)}</li>`).join('');
  $('#demoResult').innerHTML = `<div class="demo-result-head"><div><p class="eyebrow">RESUMEN REAL · DEMOSTRACIÓN</p><h2>${escapeHtml(data.hostname || data.target)}</h2><p>${escapeHtml(data.disclosure)}</p></div><div class="demo-score"><strong>${score}</strong><span>/100</span></div></div><div class="demo-kpis"><span><b>${escapeHtml(data.summary?.findingsTotal ?? 0)}</b> observaciones</span><span><b>${escapeHtml(data.summary?.critical ?? 0)}</b> críticas</span><span><b>${escapeHtml(data.summary?.high ?? 0)}</b> altas</span><span><b>${escapeHtml(data.summary?.pagesCrawled ?? 1)}</b> página revisada</span></div><div class="demo-result-grid"><div><h3>Prioridades visibles</h3>${findings || '<p class="muted">No se encontraron prioridades dentro del alcance público.</p>'}</div><aside><h3>Disponible en la cuenta completa</h3><ul>${locked}</ul><button id="demoLogin" class="primary-action" type="button">Iniciar sesión para continuar</button></aside></div>`;
  $('#demoResult').classList.remove('hidden');
  $('#demoResult').scrollIntoView({ behavior:matchMedia('(prefers-reduced-motion:reduce)').matches?'auto':'smooth', block:'start' });
  $('#demoLogin')?.addEventListener('click',()=>$('#loginDialog').showModal());
}

$('#demoForm')?.addEventListener('submit',async(event)=>{
  event.preventDefault();
  const button = event.currentTarget.querySelector('button[type="submit"]');
  button.disabled = true;
  $('#demoResult').classList.add('hidden');
  $('#demoProgress').classList.remove('hidden');
  $('#demoPrivacy').textContent = 'Procesando una página con límites públicos…';
  try {
    renderDemo(await jsonFetch('/api/demo',{ method:'POST',body:JSON.stringify({ url:$('#demoUrl').value }) }));
    $('#demoPrivacy').textContent = 'Resumen completado · el resultado público no se guarda en tu historial';
  } catch (error) {
    $('#demoResult').innerHTML = `<div class="demo-error"><strong>No se pudo completar la demostración</strong><p>${escapeHtml(error.message)}</p></div>`;
    $('#demoResult').classList.remove('hidden');
    $('#demoPrivacy').textContent = 'Puedes corregir el dominio e intentarlo nuevamente.';
  } finally { $('#demoProgress').classList.add('hidden'); button.disabled = false; }
});

$('#loginOpen')?.addEventListener('click',()=>$('#loginDialog').showModal());
$('#loginForm')?.addEventListener('submit',async(event)=>{
  event.preventDefault();
  const button = event.currentTarget.querySelector('.primary-action');
  button.disabled = true; $('#loginMessage').textContent = 'Verificando…';
  try {
    const data = await jsonFetch('/api/auth?action=login',{ method:'POST',body:JSON.stringify({ email:$('#loginEmail').value,password:$('#loginPassword').value }) });
    applySession({ configured:true,...data }); $('#loginDialog').close(); event.currentTarget.reset(); $('#loginMessage').textContent = '';
    location.hash = 'app';
  } catch (error) { $('#loginMessage').textContent = error.message; }
  finally { button.disabled = false; }
});

$('#logoutButton')?.addEventListener('click',async()=>{
  await jsonFetch('/api/auth?action=logout',{ method:'POST',body:'{}' }).catch(()=>null);
  applySession({ configured:true,authenticated:false,user:null });
  history.replaceState(null,'',location.pathname); location.reload();
});

$('#sidebarLogout')?.addEventListener('click',()=>$('#logoutButton')?.click());
$('#sidebarToggle')?.addEventListener('click',()=>document.body.classList.toggle('sidebar-open'));
$('#sidebarBackdrop')?.addEventListener('click',()=>document.body.classList.remove('sidebar-open'));
document.querySelectorAll('.workspace-sidebar [data-workspace]').forEach((button)=>button.addEventListener('click',()=>{
  document.querySelectorAll('.workspace-sidebar [data-workspace]').forEach((item)=>item.classList.toggle('active',item===button));
  document.body.classList.remove('sidebar-open');
}));

document.querySelectorAll('[data-workspace]').forEach((button)=>button.addEventListener('click',()=>{
  const target=button.dataset.workspace;
  if(target==='new'){ window.CGAuditOpenNew?.(); return; }
  window.CGAuditOpenPlatform?.(target);
}));

$('#adminOpen')?.addEventListener('click',()=>{ location.href='/admin'; });

$('#activationForm')?.addEventListener('submit',async(event)=>{
  event.preventDefault(); const button=event.currentTarget.querySelector('button'); button.disabled=true; $('#activationMessage').textContent='Guardando…';
  try {
    await jsonFetch('/api/auth?action=password',{ method:'POST',body:JSON.stringify({ password:$('#activationPassword').value,confirmation:$('#activationConfirmation').value }) });
    $('#activationDialog').close(); await loadSession(); history.replaceState(null,'',location.pathname+'#app');
  } catch(error) { $('#activationMessage').textContent=error.message; }
  finally { button.disabled=false; }
});

async function acceptAuthRedirect() {
  const fragment = new URLSearchParams(location.hash.replace(/^#/,''));
  const accessToken=fragment.get('access_token'), refreshToken=fragment.get('refresh_token');
  if (!accessToken || !refreshToken) return false;
  history.replaceState(null,'',location.pathname+'?activate=1');
  try {
    await jsonFetch('/api/auth?action=exchange',{ method:'POST',body:JSON.stringify({ accessToken,refreshToken,expiresIn:fragment.get('expires_in') }) });
    await loadSession(); $('#activationDialog').showModal(); return true;
  } catch(error) { $('#loginMessage').textContent=error.message; $('#loginDialog').showModal(); return true; }
}

(async()=>{ if (!await acceptAuthRedirect()) await loadSession(); })();
