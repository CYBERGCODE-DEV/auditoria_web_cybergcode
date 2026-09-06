import test from 'node:test';
import assert from 'node:assert/strict';
import { buildCssAnalysis } from '../lib/audit/css-analysis.js';

test('solo declara cobertura CSS medida cuando existe CSSOM procesado', () => {
  const unavailable = buildCssAnalysis({ status:'measured', data:{} }, true);
  assert.equal(unavailable.status, 'partial');
  assert.equal(unavailable.summary, null);

  const measured = buildCssAnalysis({ status:'measured', data:{ finalUrl:'https://example.com', cssAudit:{
    inlineStyleRatio:0.3, inlineStyleElements:12, unusedSelectorRatio:0.7, accessibleSelectors:100,
    unusedSelectors:70, fontFamilies:['A','B'], interactiveElements:3, states:{ focus:true, focusVisible:false }
  } } }, true);
  assert.equal(measured.status, 'measured');
  assert.equal(measured.summary.accessibleSelectors, 100);
  assert.ok(measured.findings.some((item) => item.title.includes('selectores CSS')));
});
