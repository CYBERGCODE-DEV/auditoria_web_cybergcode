import { createFinding } from '../audit/finding.js';
import { RULES } from '../config/rules.js';

export const PE_CATALOG = Object.freeze([
  {
    id: 'PE-DP-29733',
    reference: 'Ley N.° 29733 + D.S. N.° 016-2024-JUS',
    name: 'Protección de Datos Personales',
    source: 'https://www.gob.pe/institucion/congreso-de-la-republica/normas-legales/243470-29733',
    note: 'La revisión automática evalúa señales visibles; la licitud del tratamiento, bases jurídicas, contratos, banco de datos, transferencias y obligaciones internas requieren revisión jurídica/documental.'
  },
  {
    id: 'PE-CONSUMER-29571',
    reference: 'Ley N.° 29571 + Ley N.° 32495 + D.Leg. N.° 1729',
    name: 'Protección al consumidor y comercio electrónico',
    source: 'https://busquedas.elperuano.pe/dispositivo/NL/2486266-3',
    note: 'Las reglas de comercio electrónico y Libro de Reclamaciones deben interpretarse según aplicabilidad y reglamentación vigente. El scanner emite alertas, no resoluciones legales.'
  }
]);

const maxSignal = (pages, browserData, key) => Math.max(
  ...pages.map((p) => Number(p.complianceSignals?.[key] || 0)),
  Number(browserData?.privacy?.[key] || 0),
  0
);

export function runPeruCompliance({ target, pages = [], browser = {} }) {
  const browserData = browser?.data || browser || {};
  const privacyLinks = maxSignal(pages, browserData, 'privacyLinks');
  const claimsBookLinks = maxSignal(pages, browserData, 'claimsBookLinks');
  const forms = maxSignal(pages, browserData, 'forms');
  const piiFields = maxSignal(pages, browserData, 'piiFields');
  const consentControls = maxSignal(pages, browserData, 'consentControls');
  const ecommerceSignals = Boolean(browserData?.privacy?.ecommerceSignals || pages.some((p) => p.complianceSignals?.ecommerceSignals));
  const precheckedOptionalControls = Number(browserData?.privacy?.precheckedOptionalControls || 0);
  const trackers = browserData?.network?.trackers || [];
  const cookieConsentUi = Boolean(browserData?.privacy?.cookieConsentUi);
  const findings = [];

  if ((forms > 0 || piiFields > 0) && privacyLinks === 0) {
    findings.push(createFinding({
      rule: RULES.compliance.privacyPolicyMissing,
      category: 'compliance', title: 'Perú: no se detectó política de privacidad visible en un sitio que recopila datos', url: target,
      selector: 'form, footer',
      evidence: `${forms} formulario(s), ${piiFields} campo(s) potencialmente asociados a datos personales y 0 enlaces de privacidad detectados.`,
      expected: 'Información de privacidad accesible y coherente con el tratamiento real.',
      impact: 'La ausencia de información visible reduce transparencia y puede requerir revisión frente a la Ley 29733 y su reglamento.',
      source: 'Cumplimiento Perú / señales web', type: 'advisory', confidence: 0.88
    }));
  }

  if (ecommerceSignals && claimsBookLinks === 0) {
    findings.push(createFinding({
      rule: RULES.compliance.missingClaimsBook,
      category: 'compliance', title: 'Perú: no se detectó enlace visible a Libro de Reclamaciones en un sitio con señales de comercio electrónico', url: target,
      selector: 'a[href], footer',
      evidence: 'Se detectaron señales de venta/checkout/precio, pero 0 enlaces identificables como Libro de Reclamaciones.',
      expected: 'Verificar si el proveedor/plataforma está obligado a ofrecer Libro de Reclamaciones y, de ser aplicable, mantenerlo visible y accesible.',
      impact: 'Puede existir una brecha de cumplimiento/atención al consumidor si la obligación resulta aplicable al negocio.',
      source: 'Cumplimiento Perú / Ley 29571, Ley 32495, D.Leg. 1729', type: 'advisory', confidence: 0.82
    }));
  }

  if (trackers.length > 0 && !cookieConsentUi) {
    findings.push(createFinding({
      rule: RULES.compliance.trackingConsentReview,
      category: 'compliance', title: 'Perú: terceros de analítica/marketing requieren revisión de privacidad y consentimiento', url: target,
      evidence: `${trackers.length} plataforma(s) de tracking detectada(s) en la visita inicial y no se identificó una UI clara de gestión de cookies.`,
      expected: 'Inventariar tecnologías, finalidades y condición de activación aplicable; informar al usuario de forma coherente.',
      impact: 'Los trackers pueden involucrar identificadores y transferencias a terceros; su configuración debe revisarse frente al tratamiento real y normativa aplicable.',
      source: 'Cumplimiento Perú / red Chromium', type: 'advisory', confidence: 0.8
    }));
  }

  if (precheckedOptionalControls > 0) {
    findings.push(createFinding({
      rule: RULES.compliance.darkPatternReview,
      category: 'compliance', title: 'Perú: controles opcionales preseleccionados requieren revisión por posibles patrones coercitivos', url: target,
      selector: 'input[type="checkbox"]:checked',
      evidence: `${precheckedOptionalControls} control(es) opcional(es) preseleccionado(s) asociado(s) a marketing/suscripción/promoción.`,
      expected: 'Las decisiones opcionales deben presentarse de forma clara y sin inducir aceptación no intencional.',
      impact: 'Puede afectar la libertad de elección del usuario y debe revisarse frente a las reglas de protección al consumidor aplicables al comercio electrónico.',
      source: 'Cumplimiento Perú / D.Leg. 1729 / heurística UI', type: 'advisory', confidence: 0.72
    }));
  }

  const checks = [
    { id:'PE-PRIVACY-VISIBLE', status: privacyLinks > 0 ? 'observed' : ((forms || piiFields) ? 'attention' : 'manual'), title:'Aviso/política de privacidad visible', evidence:`${privacyLinks} enlace(s); ${forms} formulario(s); ${piiFields} campo(s) PII potenciales.` },
    { id:'PE-CONSENT', status: consentControls > 0 || cookieConsentUi ? 'observed' : (piiFields ? 'manual' : 'not_applicable'), title:'Mecanismos visibles de consentimiento/gestión', evidence:`${consentControls} control(es); cookie UI: ${cookieConsentUi ? 'sí' : 'no'}.` },
    { id:'PE-CLAIMS', status: ecommerceSignals ? (claimsBookLinks > 0 ? 'observed' : 'attention') : 'manual', title:'Libro de Reclamaciones / canal visible', evidence:`ecommerce: ${ecommerceSignals ? 'sí' : 'no concluyente'}; enlaces: ${claimsBookLinks}.` },
    { id:'PE-DARK', status: precheckedOptionalControls > 0 ? 'attention' : 'manual', title:'Patrones oscuros / coercitivos', evidence:`${precheckedOptionalControls} controles opcionales preseleccionados detectados; se requiere revisión humana del flujo completo.` },
    { id:'PE-LEGAL-INTERNAL', status:'manual', title:'Evidencia interna de protección de datos', evidence:'Requiere revisar finalidades, bases aplicables, responsables/encargados, transferencias, medidas de seguridad, ejercicio de derechos, conservación y documentos internos.' }
  ];
  const observed = checks.filter((c) => c.status === 'observed').length;
  const attention = checks.filter((c) => c.status === 'attention').length;

  return {
    status: 'partial-assessment',
    methodology: 'Evaluación de señales visibles de cumplimiento y confianza digital en Perú. No constituye asesoría jurídica ni declaración de infracción.',
    catalogDate: '2026-09-04',
    summary: { observed, attention, manual: checks.filter((c) => c.status === 'manual').length },
    signals: { privacyLinks, claimsBookLinks, forms, piiFields, consentControls, ecommerceSignals, precheckedOptionalControls, trackers, cookieConsentUi },
    checks,
    catalog: PE_CATALOG,
    findings
  };
}
