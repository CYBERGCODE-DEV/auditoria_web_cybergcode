import { createFinding } from './finding.js';
import { RULES } from '../config/rules.js';

export function buildCssAnalysis(browser, enabled = true) {
  if (!enabled) return { status: 'skipped', summary: null, findings: [] };
  if (browser?.status !== 'measured' || !browser?.data?.cssAudit) {
    return { status: browser?.status === 'unavailable' ? 'unavailable' : 'partial', summary: browser?.data?.cssAudit || null, findings: [] };
  }
  const css = browser.data.cssAudit;
  const findings = [];
  if (Number.isFinite(css.inlineStyleRatio) && css.inlineStyleRatio > 0.2 && css.inlineStyleElements >= 8) {
    findings.push(createFinding({
      rule: RULES.technical.inlineStyles,
      category: 'technical', title: 'Uso elevado de estilos inline', url: browser.data.finalUrl,
      evidence: `${css.inlineStyleElements} elemento(s) con style inline (${Math.round(css.inlineStyleRatio * 100)}% de la muestra evaluada).`,
      impact: 'Una alta dependencia de estilos inline puede dificultar consistencia, reutilización y mantenimiento visual.',
      recommendation: 'Consolidar estilos repetidos en clases, componentes o tokens del sistema visual cuando sea viable.',
      source: 'Rendered DOM / CSSOM', type: 'advisory', confidence: 0.85
    }));
  }
  if (Number.isFinite(css.unusedSelectorRatio) && css.accessibleSelectors >= 30 && css.unusedSelectorRatio > 0.55) {
    findings.push(createFinding({
      rule: RULES.technical.unusedCss,
      category: 'technical', title: 'Alta proporción observable de selectores CSS sin coincidencia', url: browser.data.finalUrl,
      evidence: `${css.unusedSelectors}/${css.accessibleSelectors} selectores accesibles no coincidieron con el DOM actual (${Math.round(css.unusedSelectorRatio * 100)}%).`,
      impact: 'Puede existir CSS no utilizado en esta vista, aumentando complejidad y potencialmente el peso de estilos.',
      recommendation: 'Revisar cobertura CSS por plantilla antes de eliminar reglas; estados dinámicos y rutas no visitadas pueden justificar selectores sin coincidencia.',
      source: 'CSSOM + querySelector sobre DOM renderizado', type: 'advisory', confidence: 0.72
    }));
  }
  if ((css.fontFamilies || []).length > 4) {
    findings.push(createFinding({
      rule: RULES.technical.fontSprawl,
      category: 'technical', title: 'Varias familias tipográficas detectadas', url: browser.data.finalUrl,
      evidence: `${css.fontFamilies.length} familias en elementos visibles: ${(css.fontFamilies || []).slice(0, 8).join(', ')}.`,
      impact: 'Muchas familias pueden afectar coherencia visual y, si son fuentes web distintas, también rendimiento.',
      recommendation: 'Revisar si todas las familias son intencionales y forman parte del sistema tipográfico.',
      source: 'getComputedStyle()', type: 'advisory', confidence: 0.8
    }));
  }
  if (css.interactiveElements > 0 && css.accessibleSelectors >= 10 && !css.states?.focusVisible && !css.states?.focus) {
    findings.push(createFinding({
      rule: RULES.accessibility.focusStyleReview,
      category: 'accessibility', title: 'No se observaron reglas CSS de foco en las hojas accesibles', url: browser.data.finalUrl,
      evidence: `${css.interactiveElements} elemento(s) interactivo(s); no se detectaron selectores :focus o :focus-visible en CSS accesible.`,
      impact: 'La navegación por teclado puede carecer de una indicación visual suficiente, aunque estilos nativos o CSS inaccesible podrían seguir aportarla.',
      recommendation: 'Comprobar manualmente el foco visible y definir estilos explícitos cuando sea necesario.',
      source: 'CSSOM observable', type: 'advisory', confidence: 0.65
    }));
  }
  return { status: 'measured', summary: css, findings };
}
