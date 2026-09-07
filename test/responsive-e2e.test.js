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
  const visualDir = process.env.CYBERGCODE_VISUAL_REVIEW_DIR;
  if (visualDir) fs.mkdirSync(visualDir, { recursive:true });
  try {
    const page = await browser.newPage();
    for (const width of [320,360,390,768,1024,1440]) {
      await page.setViewport({ width, height:900, deviceScaleFactor:1 });
      await page.goto(`http://127.0.0.1:${app.address().port}/`, { waitUntil:'networkidle0' });
      const layout = await page.evaluate(() => ({ scrollWidth:document.documentElement.scrollWidth, clientWidth:document.documentElement.clientWidth, title:document.title, form:Boolean(document.querySelector('#auditForm')), demo:Boolean(document.querySelector('#demoForm')), publicVisible:document.querySelector('#publicPortal')?.hidden === false }));
      assert.equal(layout.form, true);
      assert.equal(layout.demo, true);
      assert.equal(layout.publicVisible, true);
      assert.match(layout.title, /CYBERGCODE/i);
      assert.ok(layout.scrollWidth <= layout.clientWidth + 1, `${width}px: ${layout.scrollWidth} > ${layout.clientWidth}`);
      if (visualDir && width === 390) await page.screenshot({ path:path.join(visualDir, 'home-mobile-390.png'), fullPage:true });
      if (visualDir && width === 1440) await page.screenshot({ path:path.join(visualDir, 'home-laptop-1440.png'), fullPage:true });
    }
    for (const route of ['admin.html','account.html']) {
      for (const width of [390,1440]) {
        await page.setViewport({ width,height:900,deviceScaleFactor:1 });
        await page.goto(`http://127.0.0.1:${app.address().port}/${route}`, { waitUntil:'networkidle0' });
        const layout = await page.evaluate(()=>({ scrollWidth:document.documentElement.scrollWidth,clientWidth:document.documentElement.clientWidth,title:document.title }));
        assert.match(layout.title,/CYBERGCODE|Administración|Mi cuenta/i);
        assert.ok(layout.scrollWidth <= layout.clientWidth + 1,`${route} ${width}px: ${layout.scrollWidth} > ${layout.clientWidth}`);
        if (width === 390) {
          await page.click('#adminMenu');
          const menuOpen = await page.evaluate(()=>document.body.classList.contains('admin-menu-open') && getComputedStyle(document.querySelector('#adminSidebar')).transform !== 'none');
          assert.equal(menuOpen,true,`${route}: el menú móvil no abrió`);
          await page.click('#adminBackdrop');
        }
        if (visualDir && width === 1440) await page.screenshot({ path:path.join(visualDir,`${route.replace('.html','')}-laptop-1440.png`),fullPage:true });
      }
    }
    await page.setViewport({ width:1440,height:900,deviceScaleFactor:1 });
    await page.goto(`http://127.0.0.1:${app.address().port}/`, { waitUntil:'networkidle0' });
    const privateLayout = await page.evaluate(()=>{
      document.querySelector('#publicPortal').hidden=true;
      document.querySelector('#privateApp').hidden=false;
      document.body.dataset.authenticated='true';
      return {
        columns:getComputedStyle(document.querySelector('.workspace-shell')).gridTemplateColumns.split(' ').length,
        sidebarVisible:getComputedStyle(document.querySelector('#workspaceSidebar')).display !== 'none',
        overflow:document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1
      };
    });
    assert.equal(privateLayout.columns,2);
    assert.equal(privateLayout.sidebarVisible,true);
    assert.equal(privateLayout.overflow,true);
    const reportLayout = await page.evaluate(() => {
      const nav = document.querySelector('#reportNavigation');
      nav.classList.remove('hidden');
      const button = nav.querySelector('[data-report-tab="headings"]');
      button.click();
      const cards = document.querySelector('#scoreCards');
      cards.innerHTML = '<article class="panel score-card"><span>Accesibilidad</span><b>79</b><em>/ 100</em><div class="score-bar"><i style="--bar:79%"></i></div></article><article class="panel score-card"><span>ISO / Cumplimiento observable</span><b>67</b><em>/ 100</em><div class="score-bar"><i style="--bar:67%"></i></div></article>';
      const scoreCards = [...cards.querySelectorAll('.score-card')];
      return {
        links:nav.querySelectorAll('[data-report-tab]').length,
        active:button.classList.contains('active') && document.querySelector('[data-view="headings"]')?.classList.contains('active'),
        barsClear:scoreCards.every((card) => {
          const suffix = card.querySelector('em').getBoundingClientRect();
          const bar = card.querySelector('.score-bar').getBoundingClientRect();
          return bar.top >= suffix.bottom;
        })
      };
    });
    assert.ok(reportLayout.links >= 17);
    assert.equal(reportLayout.active,true);
    assert.equal(reportLayout.barsClear,true);
    if (visualDir) await page.screenshot({ path:path.join(visualDir,'workspace-laptop-1440.png'),fullPage:true });
    await page.goto(`http://127.0.0.1:${app.address().port}/`, { waitUntil:'networkidle0' });
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

    const progressPage = await browser.newPage();
    await progressPage.setViewport({ width:834, height:1112, deviceScaleFactor:1 });
    await progressPage.setRequestInterception(true);
    progressPage.on('request', async (request) => {
      const url = new URL(request.url());
      if (url.pathname === '/api/identity') {
        await new Promise((resolve) => setTimeout(resolve, 120));
        await request.respond({ status:200, contentType:'application/json', body:JSON.stringify({ hostname:'example.com', visual:null }) });
        return;
      }
      if (url.pathname === '/api/jobs/start') {
        await new Promise((resolve) => setTimeout(resolve, 1400));
        await request.respond({ status:503, contentType:'application/json', body:'{"error":"fin controlado de prueba"}' });
        return;
      }
      await request.continue();
    });
    await progressPage.goto(`http://127.0.0.1:${app.address().port}/`, { waitUntil:'networkidle0' });
    await progressPage.evaluate(() => { document.querySelector('#publicPortal').hidden=true; document.querySelector('#privateApp').hidden=false; document.body.dataset.view='hero'; });
    await progressPage.type('#url', 'example.com');
    await progressPage.click('#auditForm button[type="submit"]');
    await progressPage.waitForSelector('#identityStatus.fallback');
    const progress = await progressPage.evaluate(() => ({
      view:document.body.dataset.view,
      columns:getComputedStyle(document.querySelector('.working-shell')).gridTemplateColumns.split(' ').length,
      status:document.querySelector('#workingCurrentStatus')?.textContent,
      connectionDone:document.querySelector('#workingStepConnection')?.classList.contains('done'),
      analysisActive:document.querySelector('#workingStepAudit')?.classList.contains('active'),
      activeModules:document.querySelectorAll('.orbit-node-active').length,
      domainFits:document.querySelector('#workingDomain')?.scrollWidth <= document.querySelector('#workingDomain')?.clientWidth + 1,
      animation:getComputedStyle(document.querySelector('.orbit-node-active .orbit-icon')).animationName
    }));
    assert.equal(progress.view, 'working');
    assert.equal(progress.columns, 3);
    assert.equal(progress.status, 'Preparando rastreo');
    assert.equal(progress.connectionDone, true);
    assert.equal(progress.analysisActive, true);
    assert.equal(progress.activeModules, 1);
    assert.equal(progress.domainFits, true);
    assert.notEqual(progress.animation, 'none');
    if (visualDir) await progressPage.screenshot({ path:path.join(visualDir, 'working-tablet-834.png'), fullPage:true });
    await progressPage.waitForSelector('#errorBox:not(.hidden)');
    await progressPage.close();
  } finally {
    await browser.close();
    await new Promise((resolve) => app.close(resolve));
  }
});
