import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const html = fs.readFileSync(new URL('../public/index.html', import.meta.url), 'utf8');
const css = fs.readFileSync(new URL('../public/css/app.css', import.meta.url), 'utf8');
const vercel = JSON.parse(fs.readFileSync(new URL('../vercel.json', import.meta.url), 'utf8'));

test('dashboard prioriza SEO, H1-H6, contenido, cobertura y UX en quince menús interactivos', () => {
  const tabs = [...html.matchAll(/data-tab="([^"]+)"/g)].map((m) => m[1]);
  assert.deepEqual(tabs, ['overview','seo','headings','content','ux','pages','coverage','images','performance','accessibility','visual','infrastructure','peru','iso','findings']);
});

test('interfaz incluye modo estable, tema y preferencias de movimiento reducido', () => {
  assert.match(html, /id="stableMode"/);
  assert.match(html, /id="themeToggle"/);
  assert.match(css, /prefers-reduced-motion:reduce/);
});

test('tipografía es escalable y footer queda al fondo del viewport', () => {
  assert.match(css, /font-size:1rem/);
  assert.match(css, /line-height:1\.6/);
  assert.match(css, /body\{min-height:100vh;[^}]*display:flex;[^}]*flex-direction:column/);
  assert.match(css, /main\{flex:1\}/);
  assert.match(css, /footer\{margin-top:auto/);
});

test('Vercel usa una región fija para reducir variación de ejecución', () => {
  assert.deepEqual(vercel.regions, ['iad1']);
});


test('dashboard contiene vistas SEO y H1-H6 con tablas de datos reales', () => {
  assert.match(html, /data-view="seo"/);
  assert.match(html, /id="seoMetaTable"/);
  assert.match(html, /data-view="headings"/);
  assert.match(html, /id="headingTree"/);
  assert.match(html, /id="headingMatrix"/);
  assert.match(html, /id="imagesTable"/);
});
