const clean = (v) => String(v ?? '').trim();

function pathSegments(url) {
  try { return new URL(url).pathname.split('/').filter(Boolean); } catch { return []; }
}

function schemaSet(page) { return new Set((page.structuredData?.types || []).map((v) => String(v).toLowerCase())); }

function classify(page) {
  const segments = pathSegments(page.url);
  const path = `/${segments.join('/')}`.toLowerCase();
  const schema = schemaSet(page);
  if (!segments.length) return { type: 'home', label: 'Inicio', confidence: 1 };
  if (/\/(contact|contacto|contáctanos)(?:\/|$)/i.test(path)) return { type: 'contact', label: 'Contacto', confidence: .98 };
  if (/\/(blog|news|noticias|articulos?|articles?)(?:\/|$)/i.test(path) || schema.has('article') || schema.has('blogposting')) return { type: 'article', label: 'Artículo / Blog', confidence: .92 };
  if (/\/(product|products|producto|productos|box|item|shop)(?:\/|$)/i.test(path) || schema.has('product')) return { type: 'product', label: 'Producto', confidence: .9 };
  if (/\/(category|categoria|categorias|coleccion|colecciones|disenos|diseños|services|servicios)(?:\/|$)/i.test(path) && segments.length <= 2) return { type: 'category', label: 'Categoría / Listado', confidence: .82 };
  if (/\/(cart|carrito|checkout|pago)(?:\/|$)/i.test(path)) return { type: 'commerce-flow', label: 'Carrito / Checkout', confidence: .95 };
  if (/\/(login|signin|account|cuenta|perfil)(?:\/|$)/i.test(path)) return { type: 'account', label: 'Cuenta / Acceso', confidence: .92 };
  if (segments.length === 1) return { type: 'section', label: 'Sección', confidence: .7 };
  return { type: `depth-${Math.min(segments.length, 4)}`, label: `Contenido · nivel ${segments.length}`, confidence: .6 };
}

function headingShape(page) {
  const c = [1,2,3,4,5,6].map((level) => (page.headings || []).filter((h) => h.level === level).length);
  return c.join('-');
}

function signatureFor(page, classification) {
  const schema = (page.structuredData?.types || []).map(String).sort().slice(0,3).join(',') || '-';
  const segments = pathSegments(page.url);
  const root = segments[0]?.toLowerCase() || 'root';
  return `${classification.type}|${root}|h:${headingShape(page)}|s:${schema}`;
}

function median(values) {
  const nums = values.filter(Number.isFinite).sort((a,b) => a-b);
  if (!nums.length) return 0;
  const mid = Math.floor(nums.length / 2);
  return nums.length % 2 ? nums[mid] : (nums[mid-1] + nums[mid]) / 2;
}

export function groupPagesByTemplate(pages = [], { representativeLimit = 8 } = {}) {
  const groups = new Map();
  for (const page of pages) {
    const classification = classify(page);
    const signature = signatureFor(page, classification);
    const current = groups.get(signature) || {
      id: `TPL-${groups.size + 1}`,
      signature,
      type: classification.type,
      label: classification.label,
      confidence: classification.confidence,
      pages: []
    };
    current.pages.push(page);
    groups.set(signature, current);
  }

  const list = [...groups.values()].map((group) => {
    const wordMedian = median(group.pages.map((p) => Number(p.content?.wordCount || 0)));
    const sorted = [...group.pages].sort((a,b) => {
      const da = Math.abs(Number(a.content?.wordCount || 0) - wordMedian);
      const db = Math.abs(Number(b.content?.wordCount || 0) - wordMedian);
      return da - db || a.url.localeCompare(b.url);
    });
    const representative = sorted[0] || null;
    return {
      id: group.id,
      signature: group.signature,
      type: group.type,
      label: group.label,
      confidence: group.confidence,
      count: group.pages.length,
      representativeUrl: representative?.url || null,
      medianWords: Math.round(wordMedian),
      statusCodes: [...new Set(group.pages.map((p) => p.status))].sort(),
      examples: group.pages.slice(0, 4).map((p) => p.url)
    };
  }).sort((a,b) => b.count - a.count || a.label.localeCompare(b.label));

  const representatives = [];
  for (const item of list) {
    if (!item.representativeUrl) continue;
    representatives.push({ templateId: item.id, label: item.label, url: item.representativeUrl, count: item.count, confidence: item.confidence });
    if (representatives.length >= representativeLimit) break;
  }

  return {
    status: pages.length ? 'measured' : 'unavailable',
    heuristic: true,
    method: 'URL path + heading shape + structured data',
    templates: list,
    representatives,
    coverage: { pages: pages.length, groups: list.length, representatives: representatives.length }
  };
}
