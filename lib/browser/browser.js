import fs from 'node:fs';
import { assertPublicUrl } from '../security/url-guard.js';
import { startSafeBrowserProxy } from '../security/safe-browser-proxy.js';

let cachedExecutablePath;
let cachedChromiumModule;

const LOCAL_CANDIDATES = [
  process.env.CHROME_EXECUTABLE_PATH,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  process.env.LOCALAPPDATA ? `${process.env.LOCALAPPDATA}/Google/Chrome/Application/chrome.exe` : null,
  '/usr/bin/google-chrome-stable',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser'
].filter(Boolean);

function localExecutable() {
  return LOCAL_CANDIDATES.find((candidate) => fs.existsSync(candidate)) || null;
}

function packUrls() {
  // Remote packs are now an explicit fallback only. The primary Vercel path
  // is the bundled @sparticuz/chromium dependency, avoiding self-HTTP/404s.
  return process.env.CHROMIUM_PACK_URL ? [process.env.CHROMIUM_PACK_URL] : [];
}

async function loadBundledChromium() {
  try {
    const { default: chromium } = await import('@sparticuz/chromium');
    const executablePath = await chromium.executablePath();
    if (executablePath && fs.existsSync(executablePath)) {
      cachedChromiumModule = chromium;
      return executablePath;
    }
  } catch {
    // fallback to chromium-min remote pack below
  }
  return null;
}

async function resolveExecutablePath() {
  if (cachedExecutablePath) return cachedExecutablePath;
  const local = localExecutable();
  if (local) {
    cachedExecutablePath = local;
    return local;
  }

  // Preferred on Vercel: bundle @sparticuz/chromium with the Function.
  // This avoids depending on a public self-hosted tar URL that may return 404.
  const bundled = await loadBundledChromium();
  if (bundled) {
    cachedExecutablePath = bundled;
    return bundled;
  }

  const remotePacks = packUrls();
  if (!remotePacks.length) {
    throw new Error('Chromium no está disponible. En local define CHROME_EXECUTABLE_PATH; en Vercel se intentó Chromium empaquetado y no estuvo disponible.');
  }

  if (process.arch === 'arm64' && !process.env.CHROMIUM_PACK_URL) {
    throw new Error('Runtime arm64 detectado. Define CHROMIUM_PACK_URL con un chromium-pack arm64 compatible.');
  }

  const { default: chromium } = await import('@sparticuz/chromium-min');
  cachedChromiumModule = chromium;
  let lastError;
  for (const remotePack of remotePacks) {
    try {
      cachedExecutablePath = await chromium.executablePath(remotePack);
      return cachedExecutablePath;
    } catch (error) { lastError = error; }
  }
  throw new Error(`No se pudo preparar Chromium empaquetado ni desde el pack remoto: ${lastError?.message || 'error desconocido'}`);
}

export async function launchAuditBrowser({ hostMapping = null } = {}) {
  const puppeteer = await import('puppeteer-core');
  const executablePath = await resolveExecutablePath();
  const safeProxy = await startSafeBrowserProxy();
  const isServerless = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);
  let args = ['--disable-dev-shm-usage', '--no-first-run', '--no-default-browser-check'];
  if (hostMapping?.hostname && hostMapping?.address) args.push(`--host-resolver-rules=MAP ${hostMapping.hostname} ${hostMapping.address}`);
  args.push(`--proxy-server=${safeProxy.url}`, '--proxy-bypass-list=<-loopback>');
  let headless = true;

  if (isServerless) {
    const chromium = cachedChromiumModule || (await import('@sparticuz/chromium')).default;
    headless = 'shell';
    args = await puppeteer.default.defaultArgs({ args: [...chromium.args, ...args], headless });
  }

  try {
    const browser = await puppeteer.default.launch({
      executablePath,
      headless,
      args,
      protocolTimeout: 45000,
      defaultViewport: { width: 1366, height: 768, deviceScaleFactor: 1 }
    });
    browser.once('disconnected', () => void safeProxy.close());
    return browser;
  } catch (error) {
    await safeProxy.close();
    throw error;
  }
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
