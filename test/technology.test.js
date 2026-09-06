import test from 'node:test';
import assert from 'node:assert/strict';
import { buildTechnologyProfile, detectTechnologies } from '../lib/audit/technology-detection.js';

test('detecta tecnologías solo cuando existe evidencia pública', () => {
  const headers = new Headers({ server:'Vercel', 'x-powered-by':'Express' });
  const html = '<script id="__NEXT_DATA__"></script><script src="jquery.min.js"></script>';
  const names = detectTechnologies({ html, response:{ headers }, $:null }).map((item) => item.name);
  assert.deepEqual(new Set(names), new Set(['Next.js','jQuery','Vercel','Express']));
});

test('calcula porcentajes sobre bytes observables', () => {
  const profile = buildTechnologyProfile({
    pages:[{ rawHtmlBytes:100, technologies:[] }],
    browser:{ status:'measured', data:{ performance:{ codeResources:[
      { url:'https://example.com/app.js', initiatorType:'script', transferBytes:300 },
      { url:'https://example.com/app.css', initiatorType:'link', transferBytes:100 }
    ] } } }
  });
  assert.equal(profile.status, 'measured');
  assert.equal(profile.totalObservedCodeBytes, 500);
  assert.equal(profile.frontendComposition.reduce((sum, item) => sum + item.percentage, 0), 100);
});
