import { safeFetch } from '../security/safe-fetch.js';
import { createFinding } from '../audit/finding.js';
import { RULES } from '../config/rules.js';

export const ISO_CATALOG = Object.freeze([
  { id: 'ISO-IEC-40500-2025', reference: 'ISO/IEC 40500:2025', name: 'Accesibilidad web (WCAG 2.2)', scope: 'Accesibilidad del contenido web', source: 'https://www.iso.org/standard/91029.html' },
  { id: 'ISO-IEC-29184-2020', reference: 'ISO/IEC 29184:2020', name: 'Avisos de privacidad y consentimiento online', scope: 'Privacidad visible y consentimiento', source: 'https://www.iso.org/standard/70331.html' },
  { id: 'ISO-IEC-27701-2025', reference: 'ISO/IEC 27701:2025', name: 'Sistema de gestión de información de privacidad', scope: 'Gestión de privacidad y PII', source: 'https://www.iso.org/standard/27701.html' },
  { id: 'ISO-IEC-27001-2022', reference: 'ISO/IEC 27001:2022 + ISO/IEC 27002:2022', name: 'Seguridad de la información', scope: 'SGSI y controles de seguridad', source: 'https://www.iso.org/standard/27001' },
  { id: 'ISO-IEC-27034-1-2011', reference: 'ISO/IEC 27034-1:2011', name: 'Seguridad de aplicaciones', scope: 'Seguridad integrada en aplicaciones', source: 'https://www.iso.org/standard/44378.html' },
  { id: 'ISO-IEC-25010-2023', reference: 'ISO/IEC 25010:2023 + ISO/IEC 25023:2016', name: 'Calidad de producto software', scope: 'Calidad y medición de software', source: 'https://www.iso.org/standard/78176.html' },
  { id: 'ISO-9241-11-2018', reference: 'ISO 9241-11:2018', name: 'Usabilidad', scope: 'Eficacia, eficiencia y satisfacción en uso', source: 'https://www.iso.org/standard/63500.html' },
  { id: 'ISO-9241-210-2019', reference: 'ISO 9241-210:2019', name: 'Diseño centrado en las personas', scope: 'Proceso de diseño de sistemas interactivos', source: 'https://www.iso.org/standard/77520.html' },
  { id: 'ISO-IEC-29147-30111', reference: 'ISO/IEC 29147:2018 + ISO/IEC 30111:2019', name: 'Divulgación y tratamiento de vulnerabilidades', scope: 'Recepción, divulgación y remediación de vulnerabilidades', source: 'https://www.iso.org/standard/72311.html' },
  { id: 'ISO-IEC-27017-2026', reference: 'ISO/IEC 27017:2026', name: 'Seguridad en servicios cloud', scope: 'Controles de seguridad específicos de nube', source: 'https://www.iso.org/standard/27017' },
  { id: 'ISO-IEC-27018-2025', reference: 'ISO/IEC 27018:2025', name: 'Protección de PII en nube pública', scope: 'Privacidad cuando un proveedor cloud procesa PII', source: 'https://www.iso.org/standard/27018' },
  { id: 'ISO-IEC-27035-2023', reference: 'ISO/IEC 27035-1:2023 + ISO/IEC 27035-2:2023', name: 'Gestión de incidentes de seguridad', scope: 'Preparación y respuesta a incidentes', source: 'https://www.iso.org/standard/78973.html' },
  { id: 'ISO-22301-2019', reference: 'ISO 22301:2019', name: 'Continuidad del negocio', scope: 'Resiliencia y continuidad', source: 'https://www.iso.org/standard/75106.html' },
  { id: 'ISO-IEC-20000-1-2018', reference: 'ISO/IEC 20000-1:2018', name: 'Gestión de servicios TI', scope: 'Sistema de gestión de servicios', source: 'https://www.iso.org/standard/70636.html' }
]);

const check = (id, status, title, evidence, recommendation, action, acceptanceCriteria, { severity = 'medium', automated = true } = {}) => ({
  id, status, title, evidence, recommendation, action, acceptanceCriteria, severity, automated
});

const manual = (id, title, evidenceRequired, action, acceptanceCriteria) => check(
  id, 'manual', title,
  `No puede verificarse de forma concluyente mediante un escaneo externo. Evidencia requerida: ${evidenceRequired}`,
  'Solicitar y revisar evidencia documental, registros y responsables del proceso.',
  action,
  acceptanceCriteria,
  { severity: 'info', automated: false }
);

function standard(catalogId, checks, note) {
  const meta = ISO_CATALOG.find((item) => item.id === catalogId);
  const observable = checks.filter((item) => ['pass', 'fail'].includes(item.status));
  const passed = observable.filter((item) => item.status === 'pass').length;
  const failed = observable.filter((item) => item.status === 'fail').length;
  const manualCount = checks.filter((item) => item.status === 'manual').length;
  const notApplicable = checks.filter((item) => item.status === 'not_applicable').length;
  const observableScore = observable.length ? Math.round((passed / observable.length) * 100) : null;
  let status = 'manual-review';
  if (failed) status = 'needs-attention';
  else if (observable.length && manualCount) status = 'partial-alignment';
  else if (observable.length) status = 'observable-alignment';
  return { ...meta, status, observableScore, counts: { passed, failed, manual: manualCount, notApplicable, observable: observable.length }, note, checks };
}

function hasRule(findings, id) { return findings.some((item) => item.ruleId === id); }
function countRule(findings, id) { return findings.filter((item) => item.ruleId === id).length; }

function privacySignals(pages = [], browserData = null) {
  const base = pages.reduce((acc, page) => {
    const s = page.complianceSignals || {};
    acc.privacyLinks += s.privacyLinks || 0;
    acc.cookieLinks += s.cookieLinks || 0;
    acc.termsLinks += s.termsLinks || 0;
    acc.forms += s.forms || 0;
    acc.piiFields += s.piiFields || 0;
    acc.consentControls += s.consentControls || 0;
    return acc;
  }, { privacyLinks: 0, cookieLinks: 0, termsLinks: 0, forms: 0, piiFields: 0, consentControls: 0 });
  const rendered = browserData?.privacy || {};
  return {
    privacyLinks: Math.max(base.privacyLinks, rendered.privacyLinks || 0),
    cookieLinks: Math.max(base.cookieLinks, rendered.cookieLinks || 0),
    termsLinks: Math.max(base.termsLinks, rendered.termsLinks || 0),
    forms: Math.max(base.forms, rendered.forms || 0),
    piiFields: Math.max(base.piiFields, rendered.piiFields || 0),
    consentControls: Math.max(base.consentControls, rendered.consentControls || 0),
    cookieConsentUi: Boolean(rendered.cookieConsentUi)
  };
}

async function probeSecurityTxt(target) {
  const origin = new URL(target).origin;
  const candidates = [new URL('/.well-known/security.txt', origin).href, new URL('/security.txt', origin).href];
  for (const url of candidates) {
    try {
      const result = await safeFetch(url, { accept: 'text/plain,*/*;q=0.2', timeoutMs: 7000 });
      if (result.response.ok && result.body.trim()) return { found: true, url: result.url.href, status: result.response.status, sample: result.body.slice(0, 500) };
    } catch { /* optional signal */ }
  }
  return { found: false, url: candidates[0], status: null, sample: '' };
}

export async function runIsoReadiness({ target, pages = [], browser = {}, performance = {}, findings = [], infrastructure = {}, securityTxt: securityTxtOverride = null }) {
  const browserData = browser?.data || browser;
  const privacy = privacySignals(pages, browserData);
  const securityTxt = securityTxtOverride || await probeSecurityTxt(target);
  const homepage = pages[0];
  const https = String(target).startsWith('https://') && !hasRule(findings, 'SEC-HTTPS-001');
  const a11yAvailable = browserData?.axe?.moduleStatus === 'measured';
  const performanceAvailable = performance?.status === 'measured';
  const tlsInfo = infrastructure?.tls || {};

  const isoFindings = [];
  if (privacy.piiFields > 0 && privacy.privacyLinks === 0) {
    isoFindings.push(createFinding({
      rule: RULES.compliance.missingPrivacyNotice,
      category: 'compliance',
      title: 'Se recopilan datos personales sin aviso de privacidad visible detectado',
      url: target,
      selector: 'form',
      evidence: `${privacy.piiFields} campo(s) potencialmente asociados a datos personales y 0 enlaces visibles de privacidad detectados.`,
      expected: 'Un aviso/política de privacidad accesible y relacionado con la recopilación de datos.',
      impact: 'Reduce la transparencia sobre el tratamiento de datos personales y debilita la evidencia observable de privacidad.',
      source: 'HTML + Rendered DOM / ISO readiness',
      confidence: 0.9
    }));
  }
  if (privacy.piiFields > 0 && privacy.consentControls === 0 && !privacy.cookieConsentUi) {
    isoFindings.push(createFinding({
      rule: RULES.compliance.missingConsentSignal,
      category: 'compliance',
      title: 'No se detectó mecanismo visible de consentimiento asociado a la recopilación de datos',
      url: target,
      selector: 'form',
      evidence: `${privacy.piiFields} campo(s) potencialmente asociados a PII; no se detectaron controles de consentimiento ni UI de consentimiento de cookies.`,
      expected: 'Cuando el tratamiento requiera consentimiento, debe existir un mecanismo claro, informado y registrable.',
      impact: 'Puede existir una brecha entre la recopilación de datos y la información/consentimiento mostrado al usuario.',
      source: 'HTML + Rendered DOM / ISO readiness',
      confidence: 0.75,
      type: 'advisory'
    }));
  }
  if (!securityTxt.found) {
    isoFindings.push(createFinding({
      rule: RULES.compliance.missingVulnerabilityDisclosure,
      category: 'compliance',
      title: 'No se detectó un security.txt público para reportar vulnerabilidades',
      url: target,
      selector: '/.well-known/security.txt',
      evidence: 'No se encontró security.txt en las ubicaciones públicas probadas.',
      expected: 'Un canal público y mantenido para recibir reportes de seguridad es una evidencia útil de divulgación coordinada.',
      impact: 'Investigadores o clientes pueden no disponer de un canal técnico evidente para reportar vulnerabilidades.',
      source: 'HTTP / ISO readiness',
      confidence: 0.9,
      type: 'advisory'
    }));
  }

  const standards = [];

  standards.push(standard('ISO-IEC-40500-2025', [
    a11yAvailable
      ? check('40500-AXE', (browserData.axe.violations || 0) === 0 ? 'pass' : 'fail', 'Comprobaciones automáticas WCAG 2.2', `${browserData.axe.violations || 0} violación(es) axe-core; ${browserData.axe.violationNodes || 0} nodo(s) afectados.`, 'Corregir cada violación automática y volver a ejecutar axe-core.', 'Resolver por regla y por nodo, priorizando impacto crítico/serio.', 'axe-core devuelve 0 violaciones automáticas reproducibles en el alcance auditado.', { severity: 'high' })
      : manual('40500-AXE', 'Comprobaciones automáticas WCAG 2.2', 'Ejecución de un motor de accesibilidad sobre DOM renderizado', 'Habilitar Chromium/axe-core y ejecutar el módulo.', 'Existe una ejecución automática válida y sus fallos han sido tratados.'),
    browserData?.contrast
      ? check('40500-CONTRAST', (browserData.contrast.failed || 0) === 0 ? 'pass' : 'fail', 'Contraste de texto automatizable', `${browserData.contrast.failed || 0} contraste(s) por debajo del umbral detectado(s) en ${browserData.contrast.checked || 0} muestras.`, 'Ajustar colores de texto/fondo hasta cumplir los umbrales aplicables.', 'Corregir las combinaciones fallidas y probar estados normal/focus/hover cuando corresponda.', 'La nueva medición no detecta contrastes automáticos fallidos.', { severity: 'high' })
      : manual('40500-CONTRAST', 'Contraste', 'Cálculo de colores computados y contexto visual', 'Ejecutar análisis visual en Chromium.', 'Las combinaciones auditadas cumplen los umbrales aplicables.'),
    manual('40500-MANUAL', 'Criterios WCAG no automatizables', 'Revisión por teclado, lector de pantalla, contenido multimedia, significado y otros criterios manuales', 'Completar una auditoría manual WCAG 2.2 sobre una muestra representativa.', 'Existe matriz de criterios, evidencia de prueba y resultado por criterio.')
  ], 'El escaneo automatizado puede cubrir una parte de WCAG 2.2, pero no constituye por sí solo una declaración completa de conformidad.'));

  const privacyRelevant = privacy.piiFields > 0 || privacy.cookieLinks > 0 || privacy.cookieConsentUi;
  standards.push(standard('ISO-IEC-29184-2020', [
    check('29184-NOTICE', privacy.privacyLinks > 0 ? 'pass' : (privacyRelevant ? 'fail' : 'manual'), 'Aviso de privacidad accesible', privacy.privacyLinks > 0 ? `${privacy.privacyLinks} enlace(s) de privacidad detectado(s).` : 'No se detectó un enlace de privacidad en el alcance rastreado.', 'Publicar un aviso de privacidad comprensible, accesible y vinculado al tratamiento.', 'Añadir enlace visible cerca de formularios/recogida de datos y en navegación o footer.', 'La auditoría detecta el aviso y la revisión manual confirma que describe el tratamiento aplicable.', { severity: 'high', automated: privacyRelevant }),
    privacyRelevant
      ? check('29184-CONSENT', (privacy.consentControls > 0 || privacy.cookieConsentUi) ? 'pass' : 'fail', 'Señales de consentimiento online', `${privacy.consentControls} control(es) de consentimiento en formularios; UI de cookies: ${privacy.cookieConsentUi ? 'sí' : 'no'}.`, 'Cuando el consentimiento sea la base aplicable, solicitarlo de forma clara y separada.', 'Relacionar consentimiento, finalidad y política; evitar casillas preseleccionadas y registrar evidencia cuando corresponda.', 'El flujo aplicable muestra información suficiente y registra una decisión explícita cuando se requiere consentimiento.', { severity: 'medium' })
      : manual('29184-CONSENT', 'Consentimiento online', 'Inventario de tratamientos, cookies y bases legales', 'Determinar si existe tratamiento que requiera consentimiento y probar el flujo.', 'La base legal y el mecanismo de consentimiento están documentados y probados.')
  ], 'Se evalúan señales visibles de aviso y consentimiento; la licitud del tratamiento y el contenido jurídico requieren revisión adicional.'));

  standards.push(standard('ISO-IEC-27701-2025', [
    check('27701-PUBLIC', privacy.privacyLinks > 0 ? 'pass' : (privacyRelevant ? 'fail' : 'manual'), 'Transparencia pública de privacidad', privacy.privacyLinks > 0 ? 'Se detectó al menos un enlace de privacidad.' : 'No se detectó enlace de privacidad en el alcance rastreado.', 'Mantener información pública coherente con el sistema de gestión de privacidad.', 'Publicar/actualizar la política y vincularla desde los puntos de recopilación cuando corresponda.', 'La política publicada coincide con el inventario real de tratamientos.', { severity: 'medium', automated: privacyRelevant }),
    manual('27701-PIMS', 'Sistema de gestión de privacidad', 'alcance PIMS, roles, inventario PII, evaluación de riesgos, derechos, terceros, retención y registros', 'Realizar revisión documental del PIMS y muestreo de registros.', 'La evidencia demuestra que los controles y responsabilidades están implementados y operados.')
  ], 'La norma evalúa un sistema de gestión de privacidad; una web solo aporta una fracción de la evidencia necesaria.'));

  standards.push(standard('ISO-IEC-27001-2022', [
    check('27001-HTTPS', https ? 'pass' : 'fail', 'Canal HTTPS', https ? 'El objetivo usa HTTPS.' : 'No se confirmó HTTPS para el objetivo.', 'Forzar HTTPS para el sitio y recursos.', 'Configurar redirección HTTP→HTTPS y eliminar recursos inseguros.', 'Todas las rutas públicas relevantes operan sobre HTTPS sin mixed content.', { severity: 'critical' }),
    tlsInfo.status === 'measured'
      ? check('27001-TLS-CERT', tlsInfo.authorized && (tlsInfo.daysRemaining == null || tlsInfo.daysRemaining > 0) ? 'pass' : 'fail', 'Certificado TLS observable', `Autorizado: ${tlsInfo.authorized ? 'sí' : 'no'}; vigencia restante: ${tlsInfo.daysRemaining ?? 'N/D'} día(s); protocolo: ${tlsInfo.protocol || 'N/D'}.`, 'Mantener certificados confiables, vigentes y monitorizados.', 'Corregir cadena/hostname o renovar certificado y configurar alertas de expiración.', 'El certificado es confiable, vigente y válido para el hostname.', { severity: 'critical' })
      : manual('27001-TLS-CERT', 'Certificado TLS observable', 'certificado, cadena, vigencia y proceso de renovación', 'Validar TLS desde una red externa y revisar alertas/renovación.', 'El certificado es válido y existe un proceso de renovación monitorizado.'),
    check('27001-CSP', hasRule(findings, 'SEC-CSP-001') ? 'fail' : 'pass', 'Endurecimiento del navegador - CSP', hasRule(findings, 'SEC-CSP-001') ? 'CSP ausente en páginas auditadas.' : 'CSP detectada en el alcance auditado.', 'Definir y mantener una CSP acorde al riesgo.', 'Inventariar orígenes, probar Report-Only y activar una política restrictiva.', 'CSP presente, probada y sin permitir orígenes innecesarios.', { severity: 'high' }),
    check('27001-MIXED', hasRule(findings, 'SEC-MIXED-001') ? 'fail' : 'pass', 'Recursos inseguros', `${countRule(findings, 'SEC-MIXED-001')} hallazgo(s) de mixed content.`, 'Eliminar dependencias HTTP dentro de páginas HTTPS.', 'Migrar URLs de recursos y terceros a HTTPS.', '0 hallazgos de mixed content.', { severity: 'high' }),
    manual('27001-ISMS', 'SGSI, riesgos y controles organizativos', 'alcance del SGSI, análisis de riesgos, declaración de aplicabilidad, políticas, roles, proveedores, incidentes, auditorías y mejora', 'Ejecutar una auditoría documental/organizativa ISO/IEC 27001.', 'Existe evidencia objetiva suficiente para cada requisito aplicable del SGSI.')
  ], 'El scanner evalúa solo controles técnicos visibles. La conformidad ISO/IEC 27001 se determina sobre el sistema de gestión completo.'));

  standards.push(standard('ISO-IEC-27034-1-2011', [
    check('27034-RUNTIME', hasRule(findings, 'DOM-JS-001') ? 'fail' : 'pass', 'Errores de ejecución visibles', `${countRule(findings, 'DOM-JS-001')} hallazgo(s) de errores JavaScript.`, 'Eliminar errores reproducibles del cliente y revisar su impacto de seguridad/fiabilidad.', 'Corregir excepciones, añadir pruebas y monitorización.', '0 errores JavaScript reproducibles en el flujo auditado.', { severity: 'medium' }),
    check('27034-WEB-HARDENING', (hasRule(findings, 'SEC-CSP-001') || hasRule(findings, 'SEC-MIXED-001')) ? 'fail' : 'pass', 'Endurecimiento web observable', 'Se revisaron CSP y mixed content.', 'Mantener controles de seguridad web coherentes con el riesgo de la aplicación.', 'Resolver los hallazgos de cabeceras y recursos inseguros.', 'Las comprobaciones de endurecimiento auditadas quedan sin hallazgos abiertos.', { severity: 'high' }),
    manual('27034-LIFECYCLE', 'Proceso de seguridad de aplicaciones', 'requisitos de seguridad, diseño, revisión de código, pruebas, cambios, dependencias y aceptación', 'Revisar el ciclo de vida de desarrollo y operación de la aplicación.', 'Existe evidencia trazable de seguridad integrada en el ciclo de vida.')
  ], 'La seguridad de aplicaciones incluye procesos y evidencias internas no visibles desde Internet.'));

  const perfScore = performance?.mobile?.categories?.performance;
  standards.push(standard('ISO-IEC-25010-2023', [
    performanceAvailable && Number.isFinite(perfScore)
      ? check('25010-PERF', perfScore >= 75 ? 'pass' : 'fail', 'Eficiencia de rendimiento - señal de laboratorio', `Performance Lighthouse móvil: ${perfScore}/100.`, 'Investigar LCP, TBT, CLS, peso y bloqueo del renderizado.', 'Aplicar optimizaciones priorizadas y repetir mediciones comparables.', 'Se alcanza el objetivo interno definido por CYBERGCODE para la plantilla auditada.', { severity: 'medium' })
      : manual('25010-PERF', 'Eficiencia de rendimiento', 'Métricas de rendimiento reproducibles', 'Ejecutar PageSpeed/Lighthouse y métricas de campo cuando estén disponibles.', 'Existe una línea base y objetivos de calidad medibles.'),
    check('25010-RELIABILITY', hasRule(findings, 'HTTP-5XX-001') ? 'fail' : 'pass', 'Fiabilidad observable', `${countRule(findings, 'HTTP-5XX-001')} error(es) HTTP 5xx en el alcance.`, 'Eliminar fallos de servidor y monitorizar disponibilidad.', 'Corregir causa raíz y añadir alertas/health checks.', '0 respuestas 5xx reproducibles en el alcance auditado.', { severity: 'high' }),
    manual('25010-QUALITY', 'Modelo completo de calidad', 'requisitos y métricas para las características de calidad relevantes del producto', 'Definir objetivos de calidad y medirlos durante el ciclo de vida.', 'Cada característica aplicable tiene métricas, umbrales y evidencia de evaluación.')
  ], 'Se usan señales técnicas como métricas de producto; no se interpreta una puntuación Lighthouse como conformidad ISO.'));

  standards.push(standard('ISO-9241-11-2018', [
    browserData?.responsive
      ? check('9241-11-REFLOW', browserData.responsive.horizontalOverflow ? 'fail' : 'pass', 'Uso en viewport móvil', browserData.responsive.horizontalOverflow ? 'Se detectó overflow horizontal.' : 'No se detectó overflow horizontal en el viewport móvil probado.', 'Eliminar desbordamientos que dificulten tareas en móvil.', 'Corregir layout, tablas, elementos fixed y anchos rígidos.', 'La prueba móvil no presenta overflow horizontal involuntario.', { severity: 'medium' })
      : manual('9241-11-REFLOW', 'Uso en viewport móvil', 'Prueba de UI renderizada', 'Ejecutar análisis responsive.', 'La interfaz funciona en los viewports definidos.'),
    manual('9241-11-USABILITY', 'Eficacia, eficiencia y satisfacción', 'pruebas de usuarios, tareas, tasas de éxito, tiempo, errores y satisfacción en contexto de uso', 'Realizar pruebas de usabilidad con usuarios y tareas representativas.', 'Se documentan métricas y resultados frente a objetivos de usabilidad.')
  ], 'La usabilidad es un resultado del uso en contexto y necesita pruebas humanas para una evaluación completa.'));

  standards.push(standard('ISO-9241-210-2019', [
    manual('9241-210-HCD', 'Proceso de diseño centrado en las personas', 'comprensión del contexto, requisitos de usuario, alternativas de diseño y evaluación iterativa', 'Auditar el proceso de diseño y la evidencia de investigación/evaluación con usuarios.', 'El ciclo de diseño demuestra actividades centradas en las personas y decisiones trazables.')
  ], 'La norma trata principalmente el proceso de diseño; no puede inferirse desde el HTML final.'));

  standards.push(standard('ISO-IEC-29147-30111', [
    check('29147-CHANNEL', securityTxt.found ? 'pass' : 'manual', 'Canal público de divulgación de vulnerabilidades', securityTxt.found ? `security.txt detectado: ${securityTxt.url}` : 'No se detectó security.txt; esto no demuestra por sí solo ausencia de un proceso de divulgación.', 'Publicar un canal claro y mantenido para recibir reportes de seguridad.', 'Definir responsable, contacto, política y tiempos de respuesta; publicar security.txt como evidencia técnica útil.', 'Existe un canal público probado y la organización puede demostrar el flujo interno de recepción y tratamiento.', { severity: 'low', automated: securityTxt.found }),
    manual('30111-PROCESS', 'Proceso de tratamiento de vulnerabilidades', 'registro, triage, severidad, remediación, comunicación, validación y cierre de vulnerabilidades', 'Revisar el procedimiento interno y una muestra de casos gestionados.', 'Los casos muestreados demuestran recepción, análisis, remediación y cierre trazables.')
  ], 'security.txt es una señal útil, no una condición suficiente ni obligatoria para demostrar conformidad con estas normas.'));

  standards.push(standard('ISO-IEC-27017-2026', [
    manual('27017-CLOUD', 'Controles y responsabilidades de seguridad cloud', 'modelo cloud, matriz de responsabilidades, configuración, activos, administración, aislamiento, logs y acuerdos con proveedor', 'Identificar proveedor/modelo y revisar controles cloud aplicables.', 'La matriz de responsabilidades y los controles cloud aplicables están documentados y verificados.')
  ], 'Solo aplica si el servicio auditado usa o presta servicios cloud dentro del alcance evaluado.'));

  standards.push(standard('ISO-IEC-27018-2025', [
    manual('27018-PII-CLOUD', 'Protección de PII en nube pública', 'rol como procesador de PII, contratos, instrucciones del cliente, acceso, borrado, divulgación y transparencia', 'Confirmar aplicabilidad y revisar contratos/procedimientos del servicio cloud.', 'La organización demuestra los controles aplicables a PII procesada en nube pública.')
  ], 'La aplicabilidad depende del rol del proveedor cloud y del tratamiento de PII; no puede concluirse solo por el sitio público.'));

  standards.push(standard('ISO-IEC-27035-2023', [
    manual('27035-IR', 'Preparación y respuesta a incidentes', 'política, plan, roles, clasificación, comunicaciones, registros, ejercicios y lecciones aprendidas', 'Revisar plan de respuesta y evidencias de simulacros/incidentes.', 'Existe un proceso operativo probado y registros de mejora posterior.')
  ], 'La gestión de incidentes es principalmente organizativa y requiere evidencia interna.'));

  standards.push(standard('ISO-22301-2019', [
    check('22301-AVAILABILITY', hasRule(findings, 'HTTP-5XX-001') ? 'fail' : 'pass', 'Disponibilidad observable en el momento del escaneo', hasRule(findings, 'HTTP-5XX-001') ? 'Se detectaron respuestas 5xx.' : 'No se detectaron respuestas 5xx en las páginas auditadas.', 'Corregir indisponibilidades y mantener monitorización.', 'Resolver fallos y documentar alertas/recuperación.', 'El alcance auditado responde correctamente y existe evidencia interna de continuidad.', { severity: 'high' }),
    manual('22301-BCMS', 'Sistema de continuidad del negocio', 'BIA, estrategias, RTO/RPO, planes, pruebas, dependencias, crisis y mejora', 'Auditar el sistema de continuidad y resultados de pruebas.', 'Los planes y pruebas demuestran capacidad de recuperación acorde a objetivos aprobados.')
  ], 'Una instantánea de disponibilidad no demuestra continuidad del negocio; solo aporta una señal operativa puntual.'));

  standards.push(standard('ISO-IEC-20000-1-2018', [
    check('20000-SERVICE', hasRule(findings, 'HTTP-5XX-001') ? 'fail' : 'pass', 'Entrega técnica observable', `${countRule(findings, 'HTTP-5XX-001')} error(es) 5xx en el alcance.`, 'Mantener el servicio web estable y medido.', 'Corregir errores, definir SLO/SLA internos y monitorizar.', 'La disponibilidad cumple el objetivo interno y no existen errores reproducibles en el alcance.', { severity: 'medium' }),
    manual('20000-SMS', 'Sistema de gestión de servicios', 'catálogo, niveles de servicio, incidentes, cambios, configuración, proveedores, medición y mejora', 'Revisar documentación y registros del SMS.', 'Existe evidencia de planificación, entrega, control y mejora del servicio.')
  ], 'La conformidad con ISO/IEC 20000-1 requiere evaluar el sistema de gestión de servicios, no únicamente la interfaz web.'));

  const observableChecks = standards.flatMap((s) => s.checks).filter((c) => ['pass', 'fail'].includes(c.status));
  const passed = observableChecks.filter((c) => c.status === 'pass').length;
  const failed = observableChecks.filter((c) => c.status === 'fail').length;
  const manualCount = standards.flatMap((s) => s.checks).filter((c) => c.status === 'manual').length;
  const observableScore = observableChecks.length ? Math.round((passed / observableChecks.length) * 100) : null;
  const evidenceItems = standards.flatMap((standardItem) => standardItem.checks
    .filter((item) => item.status === 'manual')
    .map((item) => ({
      id: `${standardItem.id}:${item.id}`,
      standardId: standardItem.id,
      standard: standardItem.reference,
      title: item.title,
      evidenceRequired: String(item.evidence || '').replace(/^No puede verificarse de forma concluyente mediante un escaneo externo\. Evidencia requerida:\s*/i, ''),
      recommendedAction: item.action,
      acceptanceCriteria: item.acceptanceCriteria,
      status: 'pending-evidence',
      acceptedEvidence: ['PDF', 'DOCX', 'XLSX/CSV', 'captura', 'registro/export', 'enlace interno', 'entrevista/verificación manual']
    })));

  return {
    status: 'partial-assessment',
    methodology: 'ISO Web Readiness CYBERGCODE v0.5: evalúa evidencias observables y separa controles que requieren evidencia interna. No constituye certificación ni declaración formal de conformidad ISO.',
    disclaimer: 'Una auditoría pública del sitio no puede acreditar por sí sola conformidad completa con normas de sistemas de gestión. Los estados se limitan a señales técnicas observables y necesidades de evidencia adicional.',
    catalogDate: '2026-09-04',
    overall: { observableScore, observableChecks: observableChecks.length, passed, failed, manual: manualCount },
    privacySignals: privacy,
    securityTxt,
    standards,
    evidenceCenter: { status: 'ready-for-evidence', pending: evidenceItems.length, completed: 0, items: evidenceItems },
    findings: isoFindings
  };
}
