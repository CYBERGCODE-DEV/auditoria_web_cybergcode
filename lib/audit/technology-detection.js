const clean = (value) => String(value || '').trim();

export function detectTechnologies({ html = '', $, response }) {
  const source = String(html || '');
  const lower = source.toLowerCase();
  const generator = clean($?.('meta[name="generator"]').attr('content'));
  const server = clean(response?.headers?.get?.('server'));
  const powered = clean(response?.headers?.get?.('x-powered-by'));
  const found = new Map();
  const add = (name, category, evidence, confidence = 1) => {
    if (!found.has(name)) found.set(name, { name, category, evidence, confidence });
  };

  if (/wordpress/i.test(generator) || /\/wp-content\/|\/wp-includes\//i.test(source)) add('WordPress','CMS', generator || 'Rutas wp-content/wp-includes observadas');
  if (/woocommerce/i.test(source)) add('WooCommerce','Ecommerce','Marcadores WooCommerce observados en HTML');
  if (/cdn\.shopify\.com|shopify\.theme|myshopify\.com/i.test(source)) add('Shopify','Ecommerce','Recursos/variables Shopify observados');
  if (/__next_data__|\/_next\//i.test(lower)) add('Next.js','Framework','__NEXT_DATA__ o recursos /_next/ observados');
  if (/ng-version=/i.test(source)) add('Angular','Framework','Atributo ng-version observado');
  if (/vue(?:\.runtime)?(?:\.global)?(?:\.prod)?\.js|unpkg\.com\/vue|cdn\.jsdelivr\.net\/npm\/vue/i.test(source)) add('Vue.js','Framework','Script Vue observado',.95);
  if (/react(?:\.production\.min)?\.js|react-dom/i.test(source)) add('React','Framework','Script React observado',.9);
  if (/jquery(?:\.min)?\.js|jquery-[0-9]/i.test(source)) add('jQuery','JavaScript','Script jQuery observado');
  if (/bootstrap(?:\.min)?\.(?:css|js)/i.test(source)) add('Bootstrap','CSS/UI','Recurso Bootstrap observado');
  if (/googletagmanager\.com\/gtm\.js/i.test(source)) add('Google Tag Manager','Analytics','gtm.js observado');
  if (/googletagmanager\.com\/gtag\/js|google-analytics\.com|gtag\s*\(/i.test(source)) add('Google Analytics','Analytics','gtag/Google Analytics observado');
  if (/connect\.facebook\.net\/.*fbevents|fbq\s*\(/i.test(source)) add('Meta Pixel','Analytics/Marketing','fbevents/fbq observado');
  if (/cloudflare/i.test(server) || response?.headers?.get?.('cf-ray')) add('Cloudflare','CDN/Edge', server || 'Cabecera cf-ray observada');
  if (/vercel/i.test(server) || response?.headers?.get?.('x-vercel-id')) add('Vercel','Hosting/Edge', server || 'Cabecera x-vercel-id observada');
  if (/nginx/i.test(server)) add('nginx','Servidor',server);
  if (/apache/i.test(server)) add('Apache','Servidor',server);
  if (/php/i.test(powered)) add('PHP','Backend',powered,.95);
  if (/express/i.test(powered)) add('Express','Backend',powered,.95);
  if (generator && ![...found.values()].some((item) => generator.toLowerCase().includes(item.name.toLowerCase()))) add(generator,'Generator','meta[name="generator"] observado',.9);

  return [...found.values()];
}

export function aggregateTechnologies(pages = []) {
  const map = new Map();
  for (const page of pages) {
    for (const item of page.technologies || []) {
      const current = map.get(item.name) || { ...item, pages: 0, urls: [] };
      current.pages += 1;
      if (current.urls.length < 6) current.urls.push(page.url);
      current.confidence = Math.max(current.confidence || 0, item.confidence || 0);
      map.set(item.name, current);
    }
  }
  return [...map.values()].sort((a,b) => b.pages - a.pages || a.name.localeCompare(b.name));
}

function resourceLanguage(resource) {
  const url = String(resource?.url || '').toLowerCase();
  if (/\.wasm(?:[?#]|$)/.test(url)) return 'WebAssembly';
  if (/\.json(?:[?#]|$)/.test(url) || (['fetch','xmlhttprequest'].includes(resource?.initiatorType) && /json/.test(url))) return 'JSON';
  if (/\.css(?:[?#]|$)/.test(url) || resource?.initiatorType === 'css' || resource?.initiatorType === 'link') return 'CSS';
  if (/\.m?js(?:[?#]|$)/.test(url) || resource?.initiatorType === 'script') return 'JavaScript';
  return null;
}

export function buildTechnologyProfile({ pages = [], browser = null } = {}) {
  const technologies = aggregateTechnologies(pages).map((item) => ({
    ...item,
    confidencePercent:Math.round((item.confidence || 0) * 100),
    state:(item.confidence || 0) >= .9 ? 'confirmed' : (item.confidence || 0) >= .75 ? 'very-probable' : 'probable',
    evidenceItems:[{ type:'public-fingerprint', value:item.evidence, pages:item.pages || 1 }]
  }));
  const totals = new Map();
  const htmlBytes = pages.reduce((sum, page) => sum + Number(page.rawHtmlBytes || 0), 0);
  if (htmlBytes > 0) totals.set('HTML', htmlBytes);
  const resources = browser?.data?.performance?.codeResources || browser?.performance?.codeResources || [];
  let unmeasuredResources = 0;
  for (const resource of resources) {
    const language = resourceLanguage(resource);
    if (!language) continue;
    const bytes = Number(resource.transferBytes || resource.encodedBodyBytes || resource.decodedBodyBytes || 0);
    if (!bytes) { unmeasuredResources += 1; continue; }
    totals.set(language, (totals.get(language) || 0) + bytes);
  }
  const totalBytes = [...totals.values()].reduce((sum, value) => sum + value, 0);
  const frontendComposition = [...totals.entries()].map(([language, bytes]) => ({
    language, bytes, percentage:totalBytes ? Number(((bytes / totalBytes) * 100).toFixed(2)) : null,
    measurement:language === 'HTML' ? 'raw-response-bytes' : 'browser-resource-timing'
  })).sort((a, b) => b.bytes - a.bytes);
  return {
    status:totalBytes ? (browser?.status !== 'measured' || unmeasuredResources ? 'partial' : 'measured') : 'unavailable',
    technologies,
    frontendComposition,
    totalObservedCodeBytes:totalBytes,
    resourcesWithUnavailableSize:unmeasuredResources,
    coverage:{ crawledHtmlPages:pages.length, browserPages:browser?.status === 'measured' ? 1 : 0 },
    methodology:'Porcentaje sobre bytes observables de HTML rastreado y recursos públicos de código medidos por Resource Timing; imágenes, fuentes y multimedia quedan excluidos.',
    limitations:[
      'No representa el código fuente original ni los lenguajes del backend.',
      'Recursos cross-origin sin Timing-Allow-Origin pueden ocultar su tamaño.',
      'La confianza tecnológica expresa fuerza de evidencia, no porcentaje de uso del lenguaje.'
    ]
  };
}
