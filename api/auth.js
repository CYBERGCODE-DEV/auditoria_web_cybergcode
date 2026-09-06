import {
  adminAuthConfigured,
  authConfigured,
  clearSessionCookies,
  inviteAuthUser,
  listAuthUsers,
  publicUser,
  refreshSession,
  requestAccessToken,
  requestRefreshToken,
  resendActivation,
  resolveRequestUser,
  requireSameOrigin,
  requireUser,
  setSessionCookies,
  signInWithPassword,
  signOut,
  updateAuthUser,
  updatePassword,
  validatePassword
} from '../lib/auth/supabase.js';
import { requireScopedRateLimit } from '../lib/security/api-access.js';
import { listAdminEvents, recordAdminEvent } from '../lib/platform/admin-events.js';
import { withApiObservability } from '../lib/observability/api.js';

function bodyOf(req) { return typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {}); }
function clientIdentity(req) { return String(req.headers?.['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown').split(',')[0].trim(); }
function baseOrigin(req) {
  const proto = String(req.headers?.['x-forwarded-proto'] || 'https').split(',')[0].trim();
  const host = String(req.headers?.['x-forwarded-host'] || req.headers?.host || '').split(',')[0].trim();
  return `${proto}://${host}`;
}
async function logAdmin(actor, action, targetUserId, organizationId, details = {}) {
  return recordAdminEvent({ actor,action,targetUserId,organizationId,details }).catch((error)=>({ stored:false,reason:String(error?.message || error) }));
}

async function handler(req, res) {
  res.setHeader('Cache-Control','no-store');
  const action = String(req.query?.action || 'session');
  try {
    if (action === 'session' && req.method === 'GET') {
      if (!authConfigured()) return res.status(200).json({ configured:false, authenticated:false });
      let user = await resolveRequestUser(req);
      if (!user && requestRefreshToken(req)) {
        try {
          const session = await refreshSession(requestRefreshToken(req));
          setSessionCookies(req,res,session);
          user = publicUser(session.user);
        } catch (refreshError) {
          if (![400,401,403].includes(Number(refreshError?.status))) throw refreshError;
          clearSessionCookies(req,res);
        }
      }
      if (!user) return res.status(401).json({ configured:true, authenticated:false, error:'Inicia sesión para continuar.', code:'AUTH_REQUIRED' });
      return res.status(200).json({ configured:true, authenticated:true, user });
    }
    if (!requireSameOrigin(req,res)) return;

    if (action === 'login' && req.method === 'POST') {
      if (!await requireScopedRateLimit(res,{ scope:'auth/login', identity:clientIdentity(req), limit:10 })) return;
      const body = bodyOf(req);
      const session = await signInWithPassword(String(body.email || '').trim().toLowerCase(),String(body.password || ''));
      setSessionCookies(req,res,session);
      return res.status(200).json({ authenticated:true, user:publicUser(session.user) });
    }
    if (action === 'exchange' && req.method === 'POST') {
      const body = bodyOf(req);
      if (!body.accessToken || !body.refreshToken) return res.status(400).json({ error:'Enlace de activación incompleto.' });
      setSessionCookies(req,res,{ access_token:body.accessToken, refresh_token:body.refreshToken, expires_in:Number(body.expiresIn)||3600 });
      return res.status(200).json({ authenticated:true, activation:true });
    }
    if (action === 'logout' && req.method === 'POST') {
      await signOut(requestAccessToken(req));
      clearSessionCookies(req,res);
      return res.status(200).json({ authenticated:false });
    }
    if (action === 'password' && req.method === 'POST') {
      const user = await requireUser(req,res); if (!user) return;
      const body = bodyOf(req);
      const problem = validatePassword(body.password);
      if (problem) return res.status(400).json({ error:problem, code:'WEAK_PASSWORD' });
      if (body.password !== body.confirmation) return res.status(400).json({ error:'Las contraseñas no coinciden.' });
      await updatePassword(requestAccessToken(req),body.password);
      return res.status(200).json({ updated:true });
    }
    if (action === 'users' && req.method === 'GET') {
      const user = await requireUser(req,res,{ roles:['admin'] }); if (!user) return;
      const payload = await listAuthUsers({ page:req.query?.page, perPage:req.query?.limit });
      return res.status(200).json({ users:(payload.users || []).map(publicUser), total:payload.aud || payload.total || null, adminConfigured:adminAuthConfigured() });
    }
    if (action === 'invite' && req.method === 'POST') {
      const user = await requireUser(req,res,{ roles:['admin'] }); if (!user) return;
      if (!await requireScopedRateLimit(res,{ scope:'auth/invite', identity:user.id, limit:30 })) return;
      const body = bodyOf(req);
      const email = String(body.email || '').trim().toLowerCase();
      if (!/^\S+@\S+\.\S+$/.test(email)) return res.status(400).json({ error:'Correo inválido.' });
      const invited = await inviteAuthUser({ email, role:body.role, organizationId:body.organizationId, redirectTo:`${baseOrigin(req)}/?activate=1` });
      const event = await logAdmin(user,'user.invited',invited.id,invited.organizationId,{ email,role:invited.role });
      return res.status(201).json({ user:invited, eventStored:event.stored });
    }
    if (action === 'user' && req.method === 'PATCH') {
      const user = await requireUser(req,res,{ roles:['admin'] }); if (!user) return;
      const body = bodyOf(req);
      if (!body.id) return res.status(400).json({ error:'Falta el usuario.' });
      if (body.id === user.id && body.disabled === true) return res.status(409).json({ error:'No puedes suspender tu propia sesión administrativa.' });
      const updated = await updateAuthUser(body.id,body);
      const event = await logAdmin(user,'user.updated',body.id,updated.organizationId,{
        role:body.role || null, organizationChanged:Boolean(body.organizationId), disabled:body.disabled,
        subscriptionChanged:Boolean(body.subscription), sessionsRevoked:Boolean(body.revokeSessions)
      });
      return res.status(200).json({ user:updated, eventStored:event.stored });
    }
    if (action === 'resend' && req.method === 'POST') {
      const user = await requireUser(req,res,{ roles:['admin'] }); if (!user) return;
      const body = bodyOf(req); const email = String(body.email || '').trim().toLowerCase();
      if (!/^\S+@\S+\.\S+$/.test(email)) return res.status(400).json({ error:'Correo inválido.' });
      await resendActivation(email,`${baseOrigin(req)}/?activate=1`);
      const event = await logAdmin(user,'user.activation-resent',body.id || null,body.organizationId || null,{ email });
      return res.status(200).json({ sent:true,eventStored:event.stored });
    }
    if (action === 'events' && req.method === 'GET') {
      const user = await requireUser(req,res,{ roles:['admin'] }); if (!user) return;
      return res.status(200).json(await listAdminEvents({ limit:req.query?.limit }));
    }
    return res.status(405).json({ error:'Operación de autenticación no permitida.' });
  } catch (error) {
    console.error(`[auth/${action}]`,error);
    const status = Number(error?.status) || 400;
    const safeStatus = status >= 400 && status < 600 ? status : 500;
    return res.status(safeStatus).json({ error:error?.message || 'No se pudo completar la autenticación.', code:error?.code || 'AUTH_ERROR' });
  }
}

export default withApiObservability('auth',handler);
