import fs from 'node:fs';
import { assertPublicUrl } from '../security/url-guard.js';

let cachedExecutablePath;

const LOCAL_CANDIDATES = [
  process.env.CHROME_EXECUTABLE_PATH,
  '/usr/bin/google-chrome-stable',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser'
].filter(Boolean);

function localExecutable() {
  return LOCAL_CANDIDATES.find((candidate) => fs.existsSync(candidate)) || null;
}

function packUrls() {
  const urls = [];
  if (process.env.CHROMIUM_PACK_URL) urls.push(process.env.CHROMIUM_PACK_URL);
  if (process.env.VERCEL_URL) urls.push(`https://${process.env.VERCEL_URL}/chromium-pack.tar`);
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) urls.push(`https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}/chromium-pack.tar`);
  return [...new Set(urls)];
}

async function resolveExecutablePath() {
  if (cachedExecutablePath) return cachedExecutablePath;
  const local = localExecutable();
  if (local) {
    cachedExecutablePath = local;
    return local;
  }

  const remotePacks = packUrls();
  if (!remotePacks.length) {
    throw new Error('Chromium no está disponible. En local define CHROME_EXECUTABLE_PATH; en Vercel el pack se genera automáticamente durante el build.');
  }

  if (process.arch === 'arm64' && !process.env.CHROMIUM_PACK_URL) {
    throw new Error('Runtime arm64 detectado. Define CHROMIUM_PACK_URL con un chromium-pack arm64 compatible.');
  }

  const { default: chromium } = await import('@sparticuz/chromium-min');
  let lastError;
  for (const remotePack of remotePacks) {
    try {
      cachedExecutablePath = await chromium.executablePath(remotePack);
      return cachedExecutablePath;
    } catch (error) { lastError = error; }
  }
  throw new Error(`No se pudo preparar Chromium desde el pack remoto: ${lastError?.message || 'error desconocido'}`);
}

export async function launchAuditBrowser() {
  const puppeteer = await import('puppeteer-core');
  const executablePath = await resolveExecutablePath();
  const isServerless = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);
  let args = ['--disable-dev-shm-usage', '--no-first-run', '--no-default-browser-check'];
  let headless = true;

  if (isServerless) {
    const { default: chromium } = await import('@sparticuz/chromium-min');
    headless = 'shell';
    args = await puppeteer.default.defaultArgs({ args: [...chromium.args, ...args], headless });
  }

  return puppeteer.default.launch({
    executablePath,
    headless,
    args,
    protocolTimeout: 45000,
    defaultViewport: { width: 1366, height: 768, deviceScaleFactor: 1 }
  });
}

export async function installSafeRequestGuard(page) {
  const hostChecks = new Map();
  await page.setRequestInterception(true);

  page.on('request', (request) => {
    const url = request.url();
    let parsed;
    try { parsed = new URL(url); } catch { request.abort('blockedbyclient').catch(() => {}); return; }

    if (['data:', 'blob:', 'about:'].includes(parsed.protocol)) {
      request.continue().catch(() => {});
      return;
    }
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      request.abort('blockedbyclient').catch(() => {});
      return;
    }

    let check = hostChecks.get(parsed.hostname);
    if (!check) {
      check = assertPublicUrl(parsed).then(() => true).catch(() => false);
      hostChecks.set(parsed.hostname, check);
    }

    check.then((allowed) => {
      if (request.isInterceptResolutionHandled?.()) return;
      return allowed ? request.continue() : request.abort('blockedbyclient');
    }).catch(() => request.abort('blockedbyclient').catch(() => {}));
  });
}
