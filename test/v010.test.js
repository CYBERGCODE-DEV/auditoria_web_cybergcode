import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { resolveAuditConfig } from '../lib/config/audit-modes.js';
import { buildCssAnalysis } from '../lib/audit/css-analysis.js';
import { buildManualAccessibilityChecklist } from '../lib/audit/accessibility-manual.js';
import { makeAuditCacheKey } from '../lib/cache/audit-cache.js';

const html = fs.readFileSync(new URL('../public/index.html', import.meta.url), 'utf8');
const js = fs.readFileSync(new URL('../public/js/app.js', import.meta.url), 'utf8');
const css = fs.readFileSync(new URL('../public/css/app.css', import.meta.url), 'utf8');
const pkg = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8'));

test('V0.10.0 incorpora modos Rápida, Completa y Personalizada', () => {
  assert.equal(pkg.version, '0.12.0');
  assert.match(html, /value="quick"/);
  assert.match(html, /value="complete"/);
  assert.match(html, /value="custom"/);
  assert.match(html, /id="customAuditConfig"/);
  assert.match(js, /function selectedAuditMode\(/);
  assert.match(js, /collectCustomModules/);
});

test('modo rápido omite módulos costosos y modo personalizado respeta selección', () => {
  const quick = resolveAuditConfig({ auditMode:'quick', maxPages:50, pageSpeed:true, aiReview:true });
  assert.equal(quick.modules.seo, true);
  assert.equal(quick.modules.performance, false);
  assert.equal(quick.modules.browser, false);
  assert.equal(quick.modules.iso, false);
  assert.equal(quick.pageSpeed, false);
  assert.equal(quick.aiReview, false);

  const custom = resolveAuditConfig({ auditMode:'custom', modules:{ seo:true, accessibility:true, visual:false, performance:false }, devices:{ mobile:true, desktop:false } });
  assert.equal(custom.modules.seo, true);
  assert.equal(custom.modules.accessibility, true);
  assert.equal(custom.modules.browser, true, 'accessibility activa Chromium como dependencia');
  assert.equal(custom.modules.visual, false);
  assert.equal(custom.modules.performance, false);
  assert.deepEqual(custom.devices, { mobile:true, desktop:false });
});

test('configuración de auditoría forma parte de la huella de caché', () => {
  const base = { url:'https://example.com', maxPages:12, stableMode:true, engineVersion:'0.12.0' };
  const quick = makeAuditCacheKey({ ...base, auditMode:'quick', modules:{seo:true}, devices:{mobile:true,desktop:false} });
  const complete = makeAuditCacheKey({ ...base, auditMode:'complete', modules:{seo:true}, devices:{mobile:true,desktop:false} });
  assert.notEqual(quick, complete);
});

test('auditoría CSS solo genera observaciones con evidencia medida', () => {
  const result = buildCssAnalysis({ status:'measured', data:{ finalUrl:'https://example.com/', cssAudit:{
    stylesheets:3, accessibleStylesheets:2, inaccessibleStylesheets:1, accessibleSelectors:100, unusedSelectors:70, unusedSelectorRatio:.7,
    unusedSelectorSamples:['.old-card'], customPropertyDeclarations:20, inlineStyleElements:30, sampledElements:100, inlineStyleRatio:.3,
    interactiveElements:10, states:{hover:true,focus:false,focusVisible:false,disabled:false,checked:false}, fontFamilies:['Inter','Roboto','Arial','Georgia','serif']
  } } }, true);
  assert.equal(result.status, 'measured');
  assert.ok(result.findings.some((item)=>item.ruleId === 'CSS-INLINE-001'));
  assert.ok(result.findings.some((item)=>item.ruleId === 'CSS-UNUSED-001'));
  assert.ok(result.findings.some((item)=>item.ruleId === 'CSS-FONT-001'));
  assert.ok(result.findings.some((item)=>item.ruleId === 'A11Y-FOCUS-001'));
});

test('accesibilidad manual se declara pendiente de revisión humana', () => {
  const checklist = buildManualAccessibilityChecklist({ enabled:true, browser:{status:'measured'} });
  assert.equal(checklist.status, 'manual-required');
  assert.ok(checklist.items.length >= 8);
  assert.ok(checklist.items.every((item)=>item.status === 'pending-human-review'));
  assert.match(html, /data-tab="accessibility"/);
  assert.match(html, /id="a11yManualList"/);
  assert.match(css, /manual-check-list/);
});

test('dashboard V0.10 expone CSS avanzado y matriz de acción', () => {
  assert.match(html, /id="cssSummary"/);
  assert.match(html, /id="cssTokens"/);
  assert.match(html, /id="unusedCssSamples"/);
  assert.match(html, /id="actionMatrix"/);
  assert.match(js, /function renderCssAnalysis\(/);
  assert.match(js, /function renderAccessibility\(/);
  assert.match(js, /function applyAuditTabAvailability\(/);
});
