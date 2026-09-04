import * as cheerio from 'cheerio';
import { RULES } from '../config/rules.js';
import { createFinding } from './finding.js';

const clean = (value) => String(value ?? '').replace(/\s+/g, ' ').trim();

function absoluteUrl(value, base) {
  try { return new URL(value, base).href; } catch { return null; }
}

function structuredTypes($) {
  const types = new Set();
  $('script[type="application/ld+json"]').each((_, node) => {
    try {
      const data = JSON.parse($(node).text());
      const items = Array.isArray(data) ? data : [data];
      for (const item of items) {
        const values = Array.isArray(item?.['@type']) ? item['@type'] : [item?.['@type']];
        values.filter(Boolean).forEach((v) => types.add(String(v)));
        if (Array.isArray(item?.['@graph'])) {
          for (const graphItem of item['@graph']) {
            const graphTypes = Array.isArray(graphItem?.['@type']) ? graphItem['@type'] : [graphItem?.['@type']];
            graphTypes.filter(Boolean).forEach((v) => types.add(String(v)));
          }
        }
      }
    } catch { /* invalid JSON-LD is recorded later in a dedicated module */ }
  });
  return [...types];
}

function auditHeadings($, pageUrl, findings) {
  const headings = [];
  $('h1,h2,h3,h4,h5,h6').each((_, node) => {
    const tag = node.tagName.toLowerCase();
    const level = Number(tag.slice(1));
    const text = clean($(node).text());
    headings.push({ level, tag, text });
    if (!text) {
      findings.push(createFinding({
        rule: RULES.seo.emptyHeading, category: 'seo', title: 'Encabezado vacío', url: pageUrl,
        selector: tag, evidence: `<${tag}> sin texto visible`, impact: 'La estructura semántica contiene un encabezado que no comunica contenido.',
        recommendation: 'Eliminar el encabezado vacío o añadir un texto descriptivo.', source: 'HTML'
      }));
    }
  });

  const h1 = headings.filter((h) => h.level === 1);
  if (h1.length === 0) {
    findings.push(createFinding({
      rule: RULES.seo.missingH1, category: 'seo', title: 'Página sin H1', url: pageUrl, selector: 'body',
      evidence: '0 elementos <h1>', expected: 'Un encabezado principal descriptivo.',
      impact: 'La estructura principal del contenido no queda claramente identificada.',
      recommendation: 'Añadir un H1 que represente el tema principal de la página.', source: 'HTML'
    }));
  } else if (h1.length > 1) {
    findings.push(createFinding({
      rule: RULES.seo.multipleH1, category: 'seo', title: 'Múltiples H1 detectados', url: pageUrl, selector: 'h1',
      evidence: `${h1.length} elementos <h1>`, impact: 'Puede dificultar la interpretación de cuál es el encabezado principal.',
      recommendation: 'Revisar si los H1 representan correctamente la estructura del documento; no se considera por sí solo una penalización de Google.',
      source: 'HTML', type: 'advisory', confidence: 0.95
    }));
  }

  for (let i = 1; i < headings.length; i += 1) {
    const prev = headings[i - 1];
    const current = headings[i];
    if (current.level - prev.level > 1) {
      findings.push(createFinding({
        rule: RULES.seo.headingSkip, category: 'seo', title: 'Salto en jerarquía de encabezados', url: pageUrl,
        selector: current.tag, evidence: `${prev.tag.toUpperCase()} → ${current.tag.toUpperCase()} (${current.text || 'sin texto'})`,
        impact: 'La jerarquía semántica puede resultar menos clara para usuarios y tecnologías de asistencia.',
        recommendation: 'Revisar el nivel del encabezado y mantener una estructura lógica.', source: 'HTML', type: 'advisory', confidence: 0.9
      }));
    }
  }
  return headings;
}

export function auditPage({ html, pageUrl, response, redirects = [] }) {
  const $ = cheerio.load(html || '');
  const findings = [];
  const title = clean($('title').first().text());
  const description = clean($('meta[name="description"]').attr('content'));
  const canonical = clean($('link[rel="canonical"]').attr('href'));
  const robots = clean($('meta[name="robots"]').attr('content'));
  const lang = clean($('html').attr('lang'));
  const viewport = clean($('meta[name="viewport"]').attr('content'));
  const bodyText = clean($('body').text());
  const wordCount = bodyText ? bodyText.split(/\s+/).filter(Boolean).length : 0;
  const paragraphCount = $('p').length;

  if (!title) findings.push(createFinding({
    rule: RULES.seo.missingTitle, category: 'seo', title: 'Página sin title', url: pageUrl, selector: 'head > title',
    evidence: 'No se encontró contenido en <title>.', impact: 'La página pierde una señal descriptiva fundamental para navegación y resultados de búsqueda.',
    recommendation: 'Añadir un title claro, descriptivo y específico para esta URL.', source: 'HTML'
  }));

  if (!description) findings.push(createFinding({
    rule: RULES.seo.missingDescription, category: 'seo', title: 'Meta description ausente', url: pageUrl,
    selector: 'meta[name="description"]', evidence: 'No se detectó meta description.', impact: 'Se pierde control editorial sobre una posible descripción de la página en resultados de búsqueda.',
    recommendation: 'Añadir una descripción útil y coherente con el contenido; tratar la longitud como heurística, no como límite absoluto.', source: 'HTML'
  }));

  if (!canonical) findings.push(createFinding({
    rule: RULES.seo.missingCanonical, category: 'seo', title: 'Canonical no declarado', url: pageUrl,
    selector: 'link[rel="canonical"]', evidence: 'No se detectó rel="canonical".', impact: 'La URL no declara explícitamente su versión preferida.',
    recommendation: 'Valorar un canonical autorreferente o la URL canónica adecuada cuando corresponda.', source: 'HTML', type: 'advisory'
  }));

  const headings = auditHeadings($, pageUrl, findings);

  const images = [];
  $('img').each((_, node) => {
    const el = $(node);
    const src = absoluteUrl(el.attr('src'), pageUrl);
    const alt = el.attr('alt');
    const width = el.attr('width');
    const height = el.attr('height');
    const loading = el.attr('loading') || null;
    images.push({ src, alt: alt ?? null, width: width ?? null, height: height ?? null, loading, srcset: el.attr('srcset') || null });

    if (alt === undefined) findings.push(createFinding({
      rule: RULES.images.missingAlt, category: 'images', title: 'Imagen sin atributo alt', url: pageUrl, selector: 'img',
      evidence: src || '<img> sin src resoluble', impact: 'Una imagen informativa sin alternativa textual puede perjudicar accesibilidad y comprensión.',
      recommendation: 'Añadir alt descriptivo si la imagen aporta información; usar alt="" si es puramente decorativa.', source: 'HTML'
    }));
    if ((!width || !height) && src) findings.push(createFinding({
      rule: RULES.images.missingDimensions, category: 'images', title: 'Imagen sin dimensiones HTML explícitas', url: pageUrl, selector: 'img',
      evidence: src, impact: 'La ausencia de dimensiones puede favorecer cambios de layout mientras carga el recurso.',
      recommendation: 'Definir width y height coherentes con la relación de aspecto cuando sea posible.', source: 'HTML', type: 'advisory'
    }));
  });

  const links = [];
  $('a[href]').each((_, node) => {
    const href = absoluteUrl($(node).attr('href'), pageUrl);
    if (href) links.push({ href, text: clean($(node).text()), rel: clean($(node).attr('rel')) });
  });

  const privacyPattern = /(privacidad|privacy|protecci[oó]n\s+de\s+datos|data\s+protection)/i;
  const cookiePattern = /cookies?/i;
  const termsPattern = /(t[eé]rminos|condiciones|terms|conditions)/i;
  const consentPattern = /(consent|acepto|autorizo|privacidad|privacy|marketing|comercial)/i;
  const claimsPattern = /(libro\s+de\s+reclamaciones|reclamo|reclamaciones|complaints?)/i;
  const commercePattern = /(carrito|cart|checkout|comprar|buy now|pagar|payment|precio|price|suscripci[oó]n|subscription)/i;
  const piiPattern = /(email|e-mail|correo|phone|telefono|tel[eé]fono|mobile|celular|name|nombre|apellido|surname|dni|document|documento|address|direcci[oó]n|company|empresa|ruc)/i;
  const linkHaystack = (link) => `${link.text || ''} ${link.href || ''}`;
  let forms = 0;
  let piiFields = 0;
  let consentControls = 0;
  $('form').each((_, formNode) => {
    forms += 1;
    const form = $(formNode);
    form.find('input,select,textarea').each((__, node) => {
      const el = $(node);
      const type = clean(el.attr('type')).toLowerCase();
      const haystack = `${el.attr('name') || ''} ${el.attr('id') || ''} ${el.attr('placeholder') || ''} ${el.attr('autocomplete') || ''}`;
      if (['email','tel','password'].includes(type) || piiPattern.test(haystack)) piiFields += 1;
      if (type === 'checkbox' && consentPattern.test(`${haystack} ${clean(el.parent().text())}`)) consentControls += 1;
    });
  });
  const complianceSignals = {
    privacyLinks: links.filter((link) => privacyPattern.test(linkHaystack(link))).length,
    cookieLinks: links.filter((link) => cookiePattern.test(linkHaystack(link))).length,
    termsLinks: links.filter((link) => termsPattern.test(linkHaystack(link))).length,
    claimsBookLinks: links.filter((link) => claimsPattern.test(linkHaystack(link))).length,
    forms,
    piiFields,
    consentControls,
    ecommerceSignals: commercePattern.test(clean($('body').text())) || structuredTypes($).some((type) => ['Product','Offer'].includes(type))
  };

  const mixed = [];
  if (pageUrl.startsWith('https://')) {
    $('[src],[href]').each((_, node) => {
      const value = $(node).attr('src') || $(node).attr('href');
      if (/^http:\/\//i.test(value || '')) mixed.push(value);
    });
    if (mixed.length) findings.push(createFinding({
      rule: RULES.security.mixedContent, category: 'security', title: 'Contenido mixto detectado', url: pageUrl,
      selector: '[src],[href]', evidence: `${mixed.length} recurso(s) HTTP dentro de una página HTTPS.`, impact: 'Recursos inseguros pueden degradar la protección del canal HTTPS.',
      recommendation: 'Migrar todas las dependencias y recursos a HTTPS.', source: 'HTML'
    }));
  }

  const headers = Object.fromEntries(response.headers.entries());
  const headerChecks = [
    ['strict-transport-security', RULES.security.missingHsts, 'HSTS no detectado', 'Configurar Strict-Transport-Security cuando todo el sitio funcione correctamente sobre HTTPS.'],
    ['content-security-policy', RULES.security.missingCsp, 'Content-Security-Policy no detectada', 'Definir una CSP ajustada a los orígenes y recursos realmente necesarios.'],
    ['x-content-type-options', RULES.security.missingNosniff, 'X-Content-Type-Options no detectado', 'Configurar X-Content-Type-Options: nosniff.'],
    ['referrer-policy', RULES.security.missingReferrer, 'Referrer-Policy no detectada', 'Definir una política de referrer apropiada.'],
    ['permissions-policy', RULES.security.missingPermissions, 'Permissions-Policy no detectada', 'Restringir capacidades del navegador que la aplicación no utiliza.']
  ];
  if (pageUrl.startsWith('https://')) {
    for (const [header, rule, titleText, recommendation] of headerChecks) {
      if (!response.headers.get(header)) findings.push(createFinding({
        rule, category: 'security', title: titleText, url: pageUrl, selector: null,
        evidence: `Cabecera ${header} ausente.`, impact: 'Falta una capa de endurecimiento HTTP recomendada.', recommendation, source: 'HTTP headers'
      }));
    }
  }
  const server = response.headers.get('server');
  const powered = response.headers.get('x-powered-by');
  if (server || powered) findings.push(createFinding({
    rule: RULES.security.serverDisclosure, category: 'security', title: 'Información de plataforma expuesta', url: pageUrl,
    evidence: [server && `Server: ${server}`, powered && `X-Powered-By: ${powered}`].filter(Boolean).join(' · '),
    impact: 'La divulgación de tecnología puede aportar información innecesaria a un atacante.', recommendation: 'Reducir cabeceras de divulgación cuando no sean necesarias.', source: 'HTTP headers', type: 'advisory'
  }));

  if (response.status >= 500) findings.push(createFinding({
    rule: RULES.technical.serverError, category: 'technical', title: 'Error HTTP del servidor', url: pageUrl,
    evidence: `HTTP ${response.status}`, impact: 'La URL no está disponible correctamente.', recommendation: 'Corregir la causa del error 5xx y revisar logs del servidor.', source: 'HTTP'
  }));
  else if (response.status >= 400) findings.push(createFinding({
    rule: RULES.technical.clientError, category: 'technical', title: 'URL devuelve error HTTP', url: pageUrl,
    evidence: `HTTP ${response.status}`, impact: 'La URL no entrega el recurso esperado.', recommendation: 'Corregir la URL, contenido o enlaces que apuntan a ella.', source: 'HTTP'
  }));
  if (redirects.length >= 3) findings.push(createFinding({
    rule: RULES.technical.excessiveRedirects, category: 'technical', title: 'Cadena de redirecciones larga', url: pageUrl,
    evidence: `${redirects.length} redirecciones antes de la URL final.`, impact: 'Las cadenas largas añaden latencia y complejidad.', recommendation: 'Reducir la cadena y enlazar directamente a la URL final.', source: 'HTTP'
  }));

  return {
    url: pageUrl,
    status: response.status,
    title,
    description,
    canonical: canonical ? absoluteUrl(canonical, pageUrl) : null,
    robots,
    lang,
    viewport,
    content: { wordCount, paragraphCount },
    headings,
    images,
    links,
    structuredData: { types: structuredTypes($), count: $('script[type="application/ld+json"]').length },
    complianceSignals,
    headers,
    redirects,
    findings
  };
}
