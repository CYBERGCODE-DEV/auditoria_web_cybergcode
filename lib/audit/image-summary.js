import { RULES } from '../config/rules.js';
import { createFinding } from './finding.js';

function extFrom(url = '') {
  try { return new URL(url).pathname.split('.').pop()?.toLowerCase() || ''; } catch { return ''; }
}

export function buildImageSummary(pages = [], inspection = {}, browserData = null) {
  const all = pages.flatMap((page) => page.images.map((image) => ({ ...image, pageUrl: page.url })));
  const unique = new Map();
  for (const image of all) if (image.src && !unique.has(image.src)) unique.set(image.src, image);
  const assets = [...unique.values()];
  const findings = [];
  const knownBytes = assets.filter((image) => Number.isFinite(image.contentLength) && image.contentLength > 0);
  const oversized = knownBytes.filter((image) => image.contentLength > 500 * 1024);
  const broken = assets.filter((image) => Number.isFinite(image.status) && image.status >= 400);
  const legacyLarge = knownBytes.filter((image) => /image\/(jpeg|jpg|png)/i.test(image.contentType || '') && image.contentLength > 180 * 1024);
  const noResponsiveSource = all.filter((image) => image.src && !image.srcset && !/\.svg(?:$|\?)/i.test(image.src));
  const runtimeImages = Array.isArray(browserData?.runtimeImages) ? browserData.runtimeImages : [];
  const backgroundImages = Array.isArray(browserData?.backgroundImages) ? browserData.backgroundImages : [];
  const runtimeMap = new Map(runtimeImages.filter((image) => image.src).map((image) => [image.src, image]));
  const renderedOversize = runtimeImages.filter((image) => Number.isFinite(image.naturalWidth) && Number.isFinite(image.renderedWidth) && image.renderedWidth > 0 && image.naturalWidth > image.renderedWidth * 1.8 && image.naturalWidth - image.renderedWidth > 300);
  const lcpCandidate = browserData?.performance?.lcpElement?.url || null;

  for (const image of broken.slice(0, 20)) findings.push(createFinding({
    rule: RULES.images.brokenAsset, category: 'images', title: 'Recurso de imagen con error HTTP', url: image.pageUrl,
    evidence: `${image.src} → HTTP ${image.status}`, impact: 'La imagen puede no mostrarse correctamente al usuario.', recommendation: 'Corregir la URL, el recurso o la referencia que apunta a la imagen.', source: 'HEAD HTTP', confidence: 1
  }));
  for (const image of oversized.slice(0, 20)) findings.push(createFinding({
    rule: RULES.images.oversized, category: 'images', title: 'Imagen pesada detectada', url: image.pageUrl,
    evidence: `${image.src} · ${(image.contentLength / 1024).toFixed(0)} KB (${image.contentType || 'tipo no declarado'})`, impact: 'Una imagen pesada puede incrementar transferencia y tiempo de carga.', recommendation: 'Redimensionar al tamaño de uso, comprimir y evaluar formatos modernos manteniendo calidad suficiente.', source: 'HTTP Content-Length', type: 'advisory', confidence: .95
  }));
  for (const image of renderedOversize.slice(0, 12)) findings.push(createFinding({
    rule: RULES.images.renderedOversize, category: 'images', title: 'Imagen con resolución natural muy superior a su tamaño renderizado', url: pages[0]?.url || image.src,
    evidence: `${image.src} · natural ${image.naturalWidth}×${image.naturalHeight || '?'} · renderizada ${image.renderedWidth}×${image.renderedHeight || '?'}.`,
    impact: 'Servir muchos más píxeles de los necesarios puede aumentar transferencia y decodificación.', recommendation: 'Generar una variante ajustada al tamaño de uso y servirla mediante srcset/sizes cuando corresponda.', source: 'Chromium natural/rendered dimensions', type: 'advisory', confidence: .9
  }));
  for (const image of legacyLarge.slice(0, 16)) findings.push(createFinding({
    rule: RULES.images.modernFormat, category: 'images', title: 'Imagen pesada en formato tradicional', url: image.pageUrl,
    evidence: `${image.src} · ${image.contentType} · ${(image.contentLength / 1024).toFixed(0)} KB`, impact: 'WebP o AVIF pueden reducir transferencia en muchos casos, aunque el ahorro real depende del contenido y calidad.', recommendation: 'Comparar una versión WebP/AVIF y servir la alternativa que reduzca peso sin degradación visible.', source: 'HTTP headers', type: 'advisory', confidence: .8
  }));

  const byFormat = {};
  for (const image of assets) {
    const key = image.contentType || extFrom(image.src) || 'unknown';
    byFormat[key] = (byFormat[key] || 0) + 1;
  }
  return {
    status: 'measured',
    totalReferences: all.length,
    uniqueAssets: assets.length,
    inspectedAssets: inspection.inspected || knownBytes.length,
    knownBytes: knownBytes.reduce((sum, image) => sum + image.contentLength, 0),
    oversized: oversized.length,
    broken: broken.length,
    legacyLarge: legacyLarge.length,
    missingDimensions: all.filter((image) => !image.width || !image.height).length,
    missingAlt: all.filter((image) => image.alt == null).length,
    emptyAlt: all.filter((image) => image.alt === '').length,
    lazy: all.filter((image) => image.loading === 'lazy').length,
    withSrcset: all.filter((image) => Boolean(image.srcset)).length,
    withSizes: all.filter((image) => Boolean(image.sizes)).length,
    withPictureSources: all.filter((image) => Array.isArray(image.pictureSources) && image.pictureSources.length > 0).length,
    asyncDecoding: all.filter((image) => String(image.decoding).toLowerCase() === 'async').length,
    noResponsiveSource: noResponsiveSource.length,
    renderedMeasured: runtimeImages.length,
    renderedOversize: renderedOversize.length,
    backgroundImagesObserved: backgroundImages.length,
    backgroundImages: backgroundImages.slice(0, 20),
    lcpCandidate,
    lcpCandidateRuntime: lcpCandidate ? (runtimeMap.get(lcpCandidate) || null) : null,
    byFormat,
    largest: knownBytes.sort((a,b) => b.contentLength - a.contentLength).slice(0, 12).map((image) => ({ url: image.src, pageUrl: image.pageUrl, bytes: image.contentLength, contentType: image.contentType, status: image.status })),
    findings
  };
}
