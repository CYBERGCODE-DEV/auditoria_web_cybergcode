import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../public');
const chromeCandidates = [
  process.env.CHROME_EXECUTABLE_PATH,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  '/usr/bin/google-chrome',
  '/usr/bin/google-chrome-stable',
  '/usr/bin/chromium'
].filter(Boolean);

function server() {
  return http.createServer((req, res) => {
    const pathname = new URL(req.url, 'http://127.0.0.1').pathname;
    if (pathname.startsWith('/api/')) { res.writeHead(503, { 'content-type':'application/json' }); res.end('{"error":"not configured in UI test"}'); return; }
    const relative = pathname === '/' ? 'index.html' : pathname.replace(/^\//, '');
    const file = path.resolve(root, relative);
    if (!file.startsWith(`${root}${path.sep}`) || !fs.existsSync(file)) { res.writeHead(404); res.end(); return; }
    const type = file.endsWith('.css') ? 'text/css' : file.endsWith('.js') ? 'text/javascript' : file.endsWith('.png') ? 'image/png' : 'text/html';
    res.writeHead(200, { 'content-type':type });
    fs.createReadStream(file).pipe(res);
  });
}

test('interfaz sin overflow y menús conectados en seis viewports', { timeout:120000 }, async (t) => {
  const executablePath = chromeCandidates.find((item) => fs.existsSync(item));
  if (!executablePath) return t.skip('Chrome no está instalado en este runner.');
  const app = server();
  await new Promise((resolve) => app.listen(0, '127.0.0.1', resolve));
  const browser = await puppeteer.launch({ executablePath, headless:true, args:['--no-sandbox','--disable-dev-shm-usage'] });
  try {
    const page = await browser.newPage();
    for (const width of [320,360,390,768,1024,1440]) {
      await page.setViewport({ width, height:900, deviceScaleFactor:1 });
      await page.goto(`http://127.0.0.1:${app.address().port}/`, { waitUntil:'networkidle0' });
      const layout = await page.evaluate(() => ({ scrollWidth:document.documentElement.scrollWidth, clientWidth:document.documentElement.clientWidth, title:document.title, form:Boolean(document.querySelector('#auditForm')) }));
      assert.equal(layout.form, true);
      assert.match(layout.title, /CYBERGCODE/i);
      assert.ok(layout.scrollWidth <= layout.clientWidth + 1, `${width}px: ${layout.scrollWidth} > ${layout.clientWidth}`);
    }
    const menuResult = await page.evaluate(async () => {
      document.body.dataset.view = 'dashboard';
      document.querySelector('#dashboard')?.classList.remove('hidden');
      const result = [];
      for (const button of document.querySelectorAll('.dashboard-tab')) {
        if (button.hidden) continue;
        button.click();
        await new Promise((resolve) => setTimeout(resolve, 0));
        result.push({ tab:button.dataset.tab, active:document.querySelector(`.analysis-view[data-view="${button.dataset.tab}"]`)?.classList.contains('active') === true });
      }
      return result;
    });
    assert.ok(menuResult.length >= 8);
    assert.equal(menuResult.every((item) => item.active), true, JSON.stringify(menuResult));
  } finally {
    await browser.close();
    await new Promise((resolve) => app.close(resolve));
  }
});
