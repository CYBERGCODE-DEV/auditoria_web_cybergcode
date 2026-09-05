import test from 'node:test';
import assert from 'node:assert/strict';
import { detectTechnologies, aggregateTechnologies } from '../lib/audit/technology-detection.js';

function response(headers={}) { return { headers:{ get:(key)=>headers[key.toLowerCase()] ?? null } }; }
function fake$(generator='') { return (selector) => ({ attr:(name) => selector === 'meta[name="generator"]' && name === 'content' ? generator : null }); }

test('detecta tecnologías solo cuando existe evidencia observable', () => {
  const html='<html><head><meta name="generator" content="WordPress 6.7"><script src="https://www.googletagmanager.com/gtm.js"></script></head><body><img src="/wp-content/x.png"></body></html>';
  const found=detectTechnologies({html,$:fake$('WordPress 6.7'),response:response({'server':'cloudflare','cf-ray':'abc'})});
  assert.ok(found.some((item)=>item.name==='WordPress'));
  assert.ok(found.some((item)=>item.name==='Google Tag Manager'));
  assert.ok(found.some((item)=>item.name==='Cloudflare'));
});

test('agrega tecnologías por páginas sin inventar ausencias', () => {
  const result=aggregateTechnologies([{url:'https://a.test/',technologies:[{name:'Next.js',category:'Framework',evidence:'/_next/',confidence:1}]},{url:'https://a.test/x',technologies:[{name:'Next.js',category:'Framework',evidence:'/_next/',confidence:1}]}]);
  assert.equal(result[0].name,'Next.js');
  assert.equal(result[0].pages,2);
});
