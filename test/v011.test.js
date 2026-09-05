import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { resolveAuditConfig } from '../lib/config/audit-modes.js';
import { canonicalCrawlKey } from '../lib/audit/crawl-utils.js';
import { groupPagesByTemplate } from '../lib/audit/template-grouping.js';
import { jobProgress, setJob, getJob, setJobChunk, getJobChunk, setJobResult, getJobResult } from '../lib/jobs/job-store.js';

const html = fs.readFileSync(new URL('../public/index.html', import.meta.url), 'utf8');
const js = fs.readFileSync(new URL('../public/js/app.js', import.meta.url), 'utf8');
const pkg = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const vercel = JSON.parse(fs.readFileSync(new URL('../vercel.json', import.meta.url), 'utf8'));

test('V0.12.0 habilita auditorías grandes hasta 500 páginas sin forzar la Function directa', () => {
  assert.equal(pkg.version, '0.12.0');
  const config = resolveAuditConfig({ auditMode:'complete', maxPages:500 });
  assert.equal(config.maxPages, 500);
  assert.match(html, /<option>100<\/option>/);
  assert.match(html, /<option>250<\/option>/);
  assert.match(html, /<option>500<\/option>/);
  assert.match(js, /runLargeAudit\(/);
  assert.match(js, /\/api\/jobs\/start/);
  assert.match(js, /\/api\/jobs\/process/);
  assert.match(js, /\/api\/jobs\/finalize/);
  assert.match(js, /\/api\/jobs\/cancel/);
});

test('clave de crawl elimina tracking sin destruir parámetros funcionales', () => {
  const key = canonicalCrawlKey('https://example.com/producto?id=42&utm_source=test&fbclid=abc#top');
  assert.equal(key, 'https://example.com/producto?id=42');
});

test('agrupación de plantillas selecciona representantes con evidencia estructural', () => {
  const pages = [
    { url:'https://example.com/', status:200, headings:[{level:1,text:'Inicio'}], structuredData:{types:['WebSite']}, content:{wordCount:500} },
    { url:'https://example.com/producto/a', status:200, headings:[{level:1,text:'A'},{level:2,text:'Detalle'}], structuredData:{types:['Product']}, content:{wordCount:320} },
    { url:'https://example.com/producto/b', status:200, headings:[{level:1,text:'B'},{level:2,text:'Detalle'}], structuredData:{types:['Product']}, content:{wordCount:340} },
    { url:'https://example.com/contacto', status:200, headings:[{level:1,text:'Contacto'}], structuredData:{types:[]}, content:{wordCount:180} }
  ];
  const grouped = groupPagesByTemplate(pages);
  assert.equal(grouped.status, 'measured');
  assert.ok(grouped.templates.some((item) => item.type === 'product' && item.count === 2));
  assert.ok(grouped.representatives.length >= 3);
  assert.equal(grouped.heuristic, true);
});

test('job store conserva estado y chunks en fallback local', async () => {
  const id = `JOB-TEST-${Date.now()}`;
  await setJob({ id, status:'crawling', maxPages:100, processedCount:20, chunkCount:1 });
  await setJobChunk(id, 0, [{ url:'https://example.com/', status:200 }]);
  assert.equal((await getJob(id)).processedCount, 20);
  assert.equal((await getJobChunk(id, 0))[0].status, 200);
  assert.equal(jobProgress({ status:'crawling', maxPages:100, processedCount:20 }), 18);
  assert.equal(jobProgress({ status:'crawl-complete', maxPages:100, processedCount:60 }), 90);
  assert.equal(jobProgress({ status:'completed', maxPages:100, processedCount:60 }), 100);
});

test('Vercel define duraciones específicas para endpoints de jobs', () => {
  assert.equal(vercel.functions['api/jobs/process.js'].maxDuration, 120);
  assert.equal(vercel.functions['api/jobs/finalize.js'].maxDuration, 300);
  assert.match(html, /data-tab="coverage"/);
  assert.match(html, /id="templateGroups"/);
  assert.match(html, /id="jobProgressPanel"/);
});


test('chunks grandes se dividen y se reconstruyen sin perder páginas', async () => {
  const id = `JOB-SPLIT-${Date.now()}`;
  const pages = Array.from({ length: 3 }, (_, index) => ({
    url: `https://example.com/grande-${index}`,
    status: 200,
    payload: crypto.randomBytes(700_000).toString('base64')
  }));
  const stored = await setJobChunk(id, 0, pages);
  assert.equal(stored.split, true);
  assert.ok(stored.parts >= 2);
  const recovered = await getJobChunk(id, 0);
  assert.equal(recovered.length, 3);
  assert.equal(recovered[2].url, pages[2].url);
  assert.equal(recovered[1].payload, pages[1].payload);
});

test('interfaz permite reanudar y cancelar un job temporal', () => {
  assert.match(html, /id="resumeJob"/);
  assert.match(html, /id="resumeJobButton"/);
  assert.match(html, /id="discardJobButton"/);
  assert.match(js, /cybergcode:active-large-job/);
  assert.match(js, /discoverResumableJob/);
  assert.match(js, /\/api\/jobs\/cancel/);
  assert.equal(vercel.functions['api/jobs/cancel.js'].maxDuration, 30);
});


test('resultados grandes se fragmentan y reconstruyen desde el job store', async () => {
  const id = `JOB-RESULT-${Date.now()}`;
  const result = {
    meta: { id, engineVersion:'0.12.0' },
    data: Array.from({ length: 3 }, (_, index) => crypto.randomBytes(700_000).toString('base64') + index)
  };
  const stored = await setJobResult(id, result);
  assert.equal(stored.split, true);
  assert.ok(stored.parts >= 2);
  const recovered = await getJobResult(id);
  assert.equal(recovered.meta.id, id);
  assert.equal(recovered.data[2], result.data[2]);
});
