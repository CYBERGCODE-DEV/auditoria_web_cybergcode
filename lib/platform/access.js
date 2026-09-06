import crypto from 'node:crypto';

export function platformAccessConfigured() {
  return String(process.env.CYBERGCODE_PLATFORM_KEY || '').trim().length >= 32;
}

function safeEqual(a, b) {
  const left = Buffer.from(String(a || ''));
  const right = Buffer.from(String(b || ''));
  if (left.length !== right.length || !left.length) return false;
  return crypto.timingSafeEqual(left, right);
}

export function requestPlatformKey(req) {
  return String(req?.headers?.['x-cybergcode-platform-key'] || '').trim();
}

export function hasPlatformAccess(req) {
  const expected = String(process.env.CYBERGCODE_PLATFORM_KEY || '').trim();
  if (!expected) return false;
  return safeEqual(requestPlatformKey(req), expected);
}

export function requirePlatformAccess(req, res) {
  if (!platformAccessConfigured()) {
    res.status(503).json({ error:'CYBERGCODE_PLATFORM_KEY debe configurarse con al menos 32 caracteres.', code:'PLATFORM_KEY_NOT_CONFIGURED' });
    return false;
  }
  if (!hasPlatformAccess(req)) {
    res.status(401).json({ error:'Clave de plataforma requerida.', code:'PLATFORM_ACCESS_REQUIRED' });
    return false;
  }
  return true;
}
