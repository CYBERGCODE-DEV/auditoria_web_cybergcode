import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { computeBrowserLabScore, buildBrowserLabFindings } from '../lib/performance/browser-lab.js';
import { buildCruxFindings } from '../lib/performance/crux.js';
import { buildUxSummary } from '../lib/audit/ux-summary.js';
import { runAiContentReview } from '../lib/audit/ai-review.js';

const html = fs.readFileSync(new URL('../public/index.html', import.meta.url), 'utf8');
const js = fs.readFileSync(new URL('../public/js/app.js', import.meta.url), 'utf8');
const pkg = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8'));

test('V0.9+ expone UX/CRO, CrUX y revisión IA opcional', () => {
  assert.equal(pkg.version, '0.12.0');
  assert.match(html, /data-tab="ux"/);
  assert.match(html, /id="cruxMetrics"/);
  assert.match(html, /id="aiReview"/);
  assert.match(html, /id="contentAi"/);
  assert.match(js, /function renderUx\(/);
  assert.match(js, /function renderFieldPerformance\(/);
});

test('Browser Lab produce score solo con suficiente evidencia', () => {
  assert.equal(computeBrowserLabScore({ lcpMs: 2200, cls: .05 }), null);
  const score = computeBrowserLabScore({ lcpMs:2200, cls:.05, fcpMs:1500, ttfbMs:500, longTaskTotalMs:100 });
  assert.equal(score, 100);
  const findings = buildBrowserLabFindings('https://example.com/', { lcpMs:4500, cls:.3, ttfbMs:2100, longTaskCount:3, longTaskTotalMs:700 });
  assert.ok(findings.length >= 4);
  assert.ok(findings.every((item) => item.acceptanceCriteria));
});

test('CrUX crea hallazgos únicamente con valores de campo medidos', () => {
  const findings = buildCruxFindings('https://example.com/', {
    status:'measured', current:{ phone:{ scope:'origin', metrics:{ lcp:{p75:3100}, inp:{p75:260}, cls:{p75:.15} } }, desktop:null }
  });
  assert.equal(findings.length, 3);
  assert.ok(findings.every((item) => /Chrome UX Report API/.test(item.source)));
});

test('UX/CRO es una heurística explícita basada en evidencia HTML', () => {
  const pages = [{
    url:'https://example.com/', content:{wordCount:700,ctaCount:0,genericAnchors:2},
    complianceSignals:{ecommerceSignals:true},
    uxSignals:{forms:1,fields:10,requiredFields:8,unlabeledFields:2,phoneLinks:0,emailLinks:0,whatsappLinks:0,trustLinks:0}
  }];
  const seo = { rows:[{url:'https://example.com/',clickDepth:0}] };
  const result = buildUxSummary(pages, seo);
  assert.equal(result.status, 'measured');
  assert.ok(Number.isFinite(result.score));
  assert.match(result.methodology, /Heurísticas determinísticas/);
  assert.ok(result.findings.some((item) => item.ruleId === 'UX-FORM-001'));
});

test('IA está desactivada por defecto y no genera contenido', async () => {
  const result = await runAiContentReview([], false);
  assert.equal(result.status, 'disabled');
  assert.equal(result.review, null);
});
