import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const html = fs.readFileSync(new URL('../public/index.html', import.meta.url), 'utf8');
const css = fs.readFileSync(new URL('../public/css/app.css', import.meta.url), 'utf8');
const js = fs.readFileSync(new URL('../public/js/app.js', import.meta.url), 'utf8');
const engine = fs.readFileSync(new URL('../lib/audit/engine.js', import.meta.url), 'utf8');
const pkg = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8'));

 test('v0.8 implementa branding visual y workspace lateral', () => {
  assert.equal(pkg.version, '0.8.1');
  assert.match(html, /\/assets\/cybergcode-logo\.png/);
  assert.match(html, /id="appSidebar"/);
  assert.match(css, /body\[data-view="dashboard"\] \.app-sidebar/);
  assert.match(css, /--sidebar:/);
});

test('loader usa identidad real del dominio y evita porcentaje simulado', () => {
  assert.match(html, /id="workingSiteLogo"/);
  assert.match(html, /id="identityStatus"/);
  assert.match(html, /no inventa porcentajes/i);
  assert.match(js, /fetch\('\/api\/identity'/);
  assert.match(js, /Logo real detectado y cargado/);
});

test('overview usa información real ya existente y rail de observaciones', () => {
  assert.match(html, /id="overviewSeoSnapshot"/);
  assert.match(html, /id="overviewHeadingSnapshot"/);
  assert.match(html, /id="overviewPagesTable"/);
  assert.match(html, /id="topFindings"/);
  assert.match(html, /id="auditInfo"/);
});

test('puntuaciones N-D no se renderizan como tarjetas de score', () => {
  assert.match(js, /filter\(\(\[,value\]\) => Number\.isFinite\(value\)\)/);
  assert.doesNotMatch(js, /value === null \? 'N\/D' : value/);
});

test('motor declara política measured-only sin simulación', () => {
  assert.match(engine, /simulated: false/);
  assert.match(engine, /policy: 'measured-only'/);
  assert.match(engine, /No se crean métricas, hallazgos ni porcentajes/);
});


test('loader 0.8.1 replica la composición profesional acordada sin datos ficticios', () => {
  assert.match(html, /working-brand-lockup/);
  assert.match(html, /id="workingElapsed"/);
  assert.match(html, /orbit-n8/);
  assert.match(html, /IDENTIDAD DEL SITIO/);
  assert.match(html, /Sin simulación/);
  assert.match(css, /body\[data-view="working"\]/);
  assert.match(css, /min-height:100dvh/);
  assert.match(js, /startWorkingTimer/);
  assert.match(js, /Fallback textual del dominio/);
});

test('branding usa logo principal y símbolo CYBERGCODE con cache-busting', () => {
  assert.match(html, /cybergcode-logo\.png\?v=0\.8\.1/);
  assert.match(html, /cybergcode-symbol\.png\?v=0\.8\.1/);
  assert.match(html, /ENGINE 0\.8\.1/);
});
