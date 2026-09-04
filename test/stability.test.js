import test from 'node:test';
import assert from 'node:assert/strict';
import { aggregateSamples, median } from '../lib/performance/pagespeed.js';
import { makeAuditCacheKey, getCachedAudit, setCachedAudit } from '../lib/cache/audit-cache.js';

test('calcula mediana de muestras PageSpeed para reducir outliers', () => {
  assert.equal(median([98, 61, 90]), 90);
  const make = (performance, lcpMs) => ({
    lighthouseVersion: '13', fetchTime: '2026-09-04T00:00:00Z', environment: {},
    categories: { performance, accessibility: 95, bestPractices: 100, seo: 100 },
    metrics: { fcpMs: 1000, lcpMs, cls: .02, tbtMs: 100, speedIndexMs: 1500, ttfbMs: 200 },
    diagnostics: { requests: 20, totalByteWeight: 100000, domSize: 500 }, field: null, originField: null, warnings: []
  });
  const result = aggregateSamples([make(92, 2200), make(61, 5100), make(88, 2500)]);
  assert.equal(result.categories.performance, 88);
  assert.equal(result.metrics.lcpMs, 2500);
  assert.equal(result.sampleCount, 3);
  assert.equal(result.aggregation, 'median');
  assert.equal(result.variability.performance.range, 31);
});

test('la clave estable es igual para variantes equivalentes del mismo dominio', () => {
  const a = makeAuditCacheKey({ url:'example.com', maxPages:12, pageSpeed:true, stableMode:true, engineVersion:'0.6.0' });
  const b = makeAuditCacheKey({ url:'https://example.com/', maxPages:12, pageSpeed:true, stableMode:true, engineVersion:'0.6.0' });
  assert.equal(a, b);
});

test('cache local devuelve exactamente el mismo resultado', async () => {
  const key = 'audit:test-stability-cache';
  const result = { meta:{ id:'AUD-TEST' }, scores:{ global:87 }, findings:[{ id:'X' }] };
  assert.equal(await setCachedAudit(key, result, 60), true);
  assert.deepEqual(await getCachedAudit(key), result);
});
