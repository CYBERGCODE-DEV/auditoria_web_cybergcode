import test from 'node:test';
import assert from 'node:assert/strict';
import { buildImageSummary } from '../lib/audit/image-summary.js';

test('resumen de imágenes usa Content-Length/HTTP reales cuando están disponibles', () => {
  const pages=[{url:'https://example.com/',images:[
    {src:'https://example.com/hero.jpg',alt:'Hero',width:'1600',height:'900',loading:null,srcset:null,status:200,contentType:'image/jpeg',contentLength:700*1024},
    {src:'https://example.com/broken.png',alt:null,width:null,height:null,loading:'lazy',srcset:null,status:404,contentType:'image/png',contentLength:12*1024}
  ]}];
  const summary=buildImageSummary(pages,{inspected:2});
  assert.equal(summary.oversized,1);
  assert.equal(summary.broken,1);
  assert.equal(summary.inspectedAssets,2);
  assert.ok(summary.findings.some((f)=>f.ruleId==='IMG-WEIGHT-001'));
  assert.ok(summary.findings.some((f)=>f.ruleId==='IMG-BROKEN-001'));
});
