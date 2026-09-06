import crypto from 'node:crypto';

const ACCESS_COOKIE = 'cybergcode_access';
const REFRESH_COOKIE = 'cybergcode_refresh';

function env(name) { return String(process.env[name] || '').trim(); }

export function authConfigured() {
  return Boolean(env('SUPABASE_URL') && env('SUPABASE_ANON_KEY'));
}

export function adminAuthConfigured() {
  return authConfigured() && Boolean(env('SUPABASE_SERVICE_ROLE_KEY'));
}

function baseUrl() { return env('SUPABASE_URL').replace(/\/+$/,''); }
function anonKey() { return env('SUPABASE_ANON_KEY'); }
function serviceKey() { return env('SUPABASE_SERVICE_ROLE_KEY'); }

function parseCookies(req) {
  return String(req.headers?.cookie || '').split(';').reduce((cookies, part) => {
    const index = part.indexOf('=');
    if (index < 1) return cookies;
    const key = part.slice(0,index).trim();
    try { cookies[key] = decodeURIComponent(part.slice(index + 1).trim()); } catch { cookies[key] = ''; }
    return cookies;
  }, {});
}

function cookie(name, value, { maxAge = 0, req = null } = {}) {
  const forwardedProto = String(req?.headers?.['x-forwarded-proto'] || '').split(',')[0].trim();
  const secure = process.env.VERCEL_ENV === 'production' || forwardedProto === 'https';
  return `${name}=${encodeURIComponent(value || '')}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${Math.max(0,Math.floor(maxAge))}${secure ? '; Secure' : ''}`;
}

export function setSessionCookies(req, res, session) {
  const accessTtl = Math.max(60,Number(session?.expires_in) || 3600);
  const refreshTtl = 60 * 60 * 24 * 30;
  res.setHeader('Set-Cookie', [
    cookie(ACCESS_COOKIE, session?.access_token || '', { maxAge:accessTtl, req }),
    cookie(REFRESH_COOKIE, session?.refresh_token || '', { maxAge:refreshTtl, req })
  ]);
}

export function clearSessionCookies(req, res) {
  res.setHeader('Set-Cookie', [cookie(ACCESS_COOKIE,'',{ req }),cookie(REFRESH_COOKIE,'',{ req })]);
}

async function supabaseRequest(path, { method = 'GET', token = '', admin = false, body } = {}) {
  if (!authConfigured()) throw Object.assign(new Error('Autenticación no configurada.'), { code:'AUTH_NOT_CONFIGURED', status:503 });
  const key = admin ? serviceKey() : anonKey();
  if (admin && !key) throw Object.assign(new Error('SUPABASE_SERVICE_ROLE_KEY no configurada.'), { code:'AUTH_ADMIN_NOT_CONFIGURED', status:503 });
  const response = await fetch(`${baseUrl()}/auth/v1${path}`, {
    method,
    headers:{ apikey:key, Authorization:`Bearer ${token || key}`, ...(body === undefined ? {} : {'content-type':'application/json'}) },
    ...(body === undefined ? {} : { body:JSON.stringify(body) })
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = payload?.msg || payload?.message || payload?.error_description || payload?.error || 'La operación de autenticación falló.';
    throw Object.assign(new Error(message), { status:response.status, code:payload?.error_code || 'AUTH_PROVIDER_ERROR' });
  }
  return payload;
}

function adminEmails() {
  return new Set(env('CYBERGCODE_ADMIN_EMAILS').split(',').map((email)=>email.trim().toLowerCase()).filter(Boolean));
}

export function publicUser(user) {
  if (!user?.id) return null;
  const email = String(user.email || '').toLowerCase();
  const configuredAdmin = adminEmails().has(email);
  const role = configuredAdmin ? 'admin' : String(user.app_metadata?.role || 'analyst');
  const organizationId = String(user.app_metadata?.organization_id || user.id);
  return {
    id:user.id,
    email:user.email || '',
    name:user.user_metadata?.full_name || user.user_metadata?.name || '',
    role,
    organizationId,
    isAdmin:role === 'admin',
    emailConfirmed:Boolean(user.email_confirmed_at || user.confirmed_at),
    createdAt:user.created_at || null,
    lastSignInAt:user.last_sign_in_at || null
  };
}

export async function signInWithPassword(email, password) {
  return supabaseRequest('/token?grant_type=password', { method:'POST', body:{ email, password } });
}

export async function refreshSession(refreshToken) {
  return supabaseRequest('/token?grant_type=refresh_token', { method:'POST', body:{ refresh_token:refreshToken } });
}

export async function userFromAccessToken(accessToken) {
  if (!accessToken) return null;
  try { return await supabaseRequest('/user', { token:accessToken }); }
  catch (error) { if ([401,403].includes(error?.status)) return null; throw error; }
}

export async function resolveRequestUser(req) {
  if (req.cybergcodeUser) return req.cybergcodeUser;
  const token = parseCookies(req)[ACCESS_COOKIE] || '';
  const raw = await userFromAccessToken(token);
  const user = publicUser(raw);
  if (user) req.cybergcodeUser = user;
  return user;
}

export async function requireUser(req, res, { roles = [] } = {}) {
  if (!authConfigured()) {
    res.status(503).json({ error:'La autenticación debe configurarse antes de habilitar la aplicación privada.', code:'AUTH_NOT_CONFIGURED' });
    return null;
  }
  const user = await resolveRequestUser(req);
  if (!user) {
    res.status(401).json({ error:'Inicia sesión para continuar.', code:'AUTH_REQUIRED' });
    return null;
  }
  if (roles.length && !roles.includes(user.role)) {
    res.status(403).json({ error:'Tu cuenta no tiene permiso para realizar esta operación.', code:'AUTH_FORBIDDEN' });
    return null;
  }
  return user;
}

export function requireSameOrigin(req, res) {
  const origin = String(req.headers?.origin || '').trim();
  if (!origin) return true;
  const host = String(req.headers?.['x-forwarded-host'] || req.headers?.host || '').split(',')[0].trim();
  try {
    if (new URL(origin).host === host) return true;
  } catch {}
  res.status(403).json({ error:'Origen de solicitud no permitido.', code:'CSRF_ORIGIN_REJECTED' });
  return false;
}

export function requestRefreshToken(req) { return parseCookies(req)[REFRESH_COOKIE] || ''; }
export function requestAccessToken(req) { return parseCookies(req)[ACCESS_COOKIE] || ''; }

export async function updatePassword(accessToken, password) {
  return supabaseRequest('/user', { method:'PUT', token:accessToken, body:{ password } });
}

export async function signOut(accessToken) {
  if (!accessToken) return;
  await supabaseRequest('/logout', { method:'POST', token:accessToken }).catch(()=>null);
}

export async function listAuthUsers({ page = 1, perPage = 50 } = {}) {
  return supabaseRequest(`/admin/users?page=${Math.max(1,Number(page)||1)}&per_page=${Math.min(100,Math.max(1,Number(perPage)||50))}`, { admin:true });
}

export async function inviteAuthUser({ email, role = 'analyst', organizationId, redirectTo } = {}) {
  const normalizedRole = ['analyst','reader'].includes(role) ? role : 'analyst';
  const org = String(organizationId || crypto.randomUUID());
  const query = redirectTo ? `?redirect_to=${encodeURIComponent(redirectTo)}` : '';
  const invited = await supabaseRequest(`/invite${query}`, { method:'POST', admin:true, body:{ email, data:{ invited_by:'cybergcode-admin' } } });
  if (!invited?.id) throw new Error('Supabase no devolvió el usuario invitado.');
  await supabaseRequest(`/admin/users/${encodeURIComponent(invited.id)}`, { method:'PUT', admin:true, body:{ app_metadata:{ role:normalizedRole, organization_id:org } } });
  return { ...publicUser({ ...invited, app_metadata:{ ...(invited.app_metadata || {}), role:normalizedRole, organization_id:org } }), invitationSent:true };
}

export async function updateAuthUser(userId, changes = {}) {
  const body = {};
  if (typeof changes.disabled === 'boolean') body.ban_duration = changes.disabled ? '876000h' : 'none';
  if (changes.role || changes.organizationId) body.app_metadata = {
    ...(changes.role ? { role:['admin','analyst','reader'].includes(changes.role) ? changes.role : 'analyst' } : {}),
    ...(changes.organizationId ? { organization_id:String(changes.organizationId) } : {})
  };
  const updated = await supabaseRequest(`/admin/users/${encodeURIComponent(userId)}`, { method:'PUT', admin:true, body });
  return publicUser(updated);
}

export function validatePassword(password) {
  const value = String(password || '');
  if (value.length < 12) return 'La contraseña debe tener al menos 12 caracteres.';
  if (!/[a-z]/.test(value) || !/[A-Z]/.test(value) || !/\d/.test(value) || !/[^A-Za-z0-9]/.test(value)) return 'Incluye mayúscula, minúscula, número y símbolo.';
  return '';
}
