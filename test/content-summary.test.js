import test from 'node:test';
import assert from 'node:assert/strict';
import { analyzeContent } from '../lib/audit/content-analysis.js';
import { buildContentSummary } from '../lib/audit/content-summary.js';

function page(url, text, title='Servicio web', h1='Servicio web profesional') {
  const content = analyzeContent({ bodyText:text, paragraphs:[text], title, h1, links:[{text:'Ver más',href:`${url}#x`}], buttons:['Solicitar cotización'] });
  return { url, title, content, headings:[{level:1,text:h1}] };
}

test('contenido mide palabras, frases, CTAs y enlaces genéricos sin IA', () => {
  const c = analyzeContent({ bodyText:'Creamos sitios web rápidos. También desarrollamos tiendas online para empresas.', paragraphs:['Creamos sitios web rápidos. También desarrollamos tiendas online para empresas.'], title:'Diseño web empresarial', h1:'Diseño web para empresas', links:[{text:'Ver más',href:'#'}], buttons:['Solicitar cotización'] });
  assert.ok(c.wordCount >= 10);
  assert.ok(c.sentenceCount >= 2);
  assert.equal(c.ctaCount, 1);
  assert.equal(c.genericAnchors, 1);
  assert.ok(Number.isFinite(c.titleH1Overlap));
});

test('resumen de contenido detecta bloques repetidos y genera hallazgos advisory', () => {
  const repeated='Este es un bloque descriptivo largo que se repite exactamente entre páginas distintas para comprobar la detección determinística de contenido duplicado dentro del sitio auditado.';
  const pages=[page('https://example.com/a',repeated),page('https://example.com/b',repeated)];
  const summary=buildContentSummary(pages);
  assert.equal(summary.status,'measured');
  assert.equal(summary.duplicateParagraphGroups.length,1);
  assert.ok(summary.findings.some((f)=>f.ruleId==='CONTENT-DUP-001'));
});
