export const AUDIT_MODULE_KEYS = Object.freeze([
  'seo', 'headings', 'content', 'images', 'browser', 'performance', 'crux',
  'accessibility', 'ux', 'visual', 'security', 'infrastructure', 'compliance', 'iso'
]);

const COMPLETE = Object.freeze(Object.fromEntries(AUDIT_MODULE_KEYS.map((key) => [key, true])));
const QUICK = Object.freeze({
  seo: true,
  headings: true,
  content: true,
  images: true,
  browser: false,
  performance: false,
  crux: false,
  accessibility: false,
  ux: true,
  visual: false,
  security: true,
  infrastructure: true,
  compliance: false,
  iso: false
});

export const AUDIT_MODE_PRESETS = Object.freeze({
  quick: Object.freeze({ id: 'quick', label: 'Rápida', description: 'HTML/HTTP, SEO, headings, contenido, imágenes básicas, UX observable y seguridad pasiva.', maxPages: 12, modules: QUICK }),
  complete: Object.freeze({ id: 'complete', label: 'Completa', description: 'Ejecuta todos los módulos automáticos disponibles y fuentes externas configuradas.', maxPages: 25, modules: COMPLETE }),
  custom: Object.freeze({ id: 'custom', label: 'Personalizada', description: 'El usuario decide qué módulos y dispositivos ejecutar.', maxPages: 25, modules: COMPLETE })
});

export function normalizeDevices(input = {}) {
  const mobile = input?.mobile !== false;
  const desktop = input?.desktop !== false;
  if (!mobile && !desktop) return { mobile: true, desktop: false };
  return { mobile, desktop };
}

export function resolveAuditConfig({ auditMode = 'complete', modules = {}, devices = {}, maxPages, pageSpeed = true, aiReview = false } = {}) {
  const mode = AUDIT_MODE_PRESETS[auditMode] ? auditMode : 'complete';
  const preset = AUDIT_MODE_PRESETS[mode];
  const resolvedModules = {};
  for (const key of AUDIT_MODULE_KEYS) {
    resolvedModules[key] = mode === 'custom' ? (key === 'browser' ? false : modules?.[key] === true) : Boolean(preset.modules[key]);
  }

  // Dependencias técnicas: estas activaciones no inventan resultados; solo permiten ejecutar la fuente necesaria.
  if (resolvedModules.performance || resolvedModules.accessibility || resolvedModules.visual) resolvedModules.browser = true;
  if (!resolvedModules.content || mode === 'quick') aiReview = false;
  if (!resolvedModules.performance) resolvedModules.crux = false;
  if (!resolvedModules.compliance) resolvedModules.iso = false;

  const requestedPages = Number(maxPages) || preset.maxPages;
  const cappedPages = Math.min(Math.max(requestedPages, 1), 50);
  const resolvedDevices = normalizeDevices(devices);

  return {
    mode,
    label: preset.label,
    modules: resolvedModules,
    devices: resolvedDevices,
    maxPages: cappedPages,
    pageSpeed: Boolean(pageSpeed && resolvedModules.performance),
    aiReview: Boolean(aiReview && resolvedModules.content)
  };
}

export function findingAllowed(finding, modules) {
  if (!finding) return false;
  const id = String(finding.ruleId || '');
  if (id.startsWith('SEO-H-')) return Boolean(modules.headings);
  if (finding.category === 'seo') return Boolean(modules.seo);
  if (finding.category === 'content') return Boolean(modules.content);
  if (finding.category === 'images') return Boolean(modules.images);
  if (finding.category === 'performance') return Boolean(modules.performance);
  if (finding.category === 'accessibility') return Boolean(modules.accessibility);
  if (finding.category === 'ux') return Boolean(modules.ux);
  if (finding.category === 'security') return Boolean(modules.security);
  if (finding.category === 'compliance') return Boolean(modules.compliance || modules.iso);
  if (finding.category === 'technical') return true;
  return true;
}
