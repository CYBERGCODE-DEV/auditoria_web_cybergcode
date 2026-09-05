const CHECKS = Object.freeze([
  {
    id: 'A11Y-MANUAL-KEYBOARD',
    standard: 'WCAG 2.2 · 2.1 / 2.4',
    title: 'Navegación completa por teclado',
    instructions: 'Recorrer header, navegación, contenido, formularios, modales y footer usando Tab, Shift+Tab, Enter, Space y Escape cuando corresponda.',
    evidenceRequired: 'Registro de recorrido o matriz de componentes con resultado por teclado.',
    acceptanceCriteria: 'Todo elemento interactivo alcanzable con puntero puede operarse con teclado y no existe trampa de foco.'
  },
  {
    id: 'A11Y-MANUAL-FOCUS',
    standard: 'WCAG 2.2 · 2.4.7 / 2.4.11',
    title: 'Orden y visibilidad del foco',
    instructions: 'Verificar visualmente el foco en todos los controles y comprobar que el orden siga la lectura y la interacción esperadas.',
    evidenceRequired: 'Capturas o video corto del recorrido de foco en vistas representativas.',
    acceptanceCriteria: 'El foco siempre es visible, no queda oculto y avanza en un orden comprensible.'
  },
  {
    id: 'A11Y-MANUAL-SCREENREADER',
    standard: 'WCAG 2.2 · 1.3 / 4.1',
    title: 'Lectura con tecnología de asistencia',
    instructions: 'Probar una muestra con NVDA, VoiceOver o equivalente: landmarks, headings, navegación, formularios, mensajes y controles personalizados.',
    evidenceRequired: 'Matriz de prueba indicando lector, navegador, página y resultado.',
    acceptanceCriteria: 'La estructura, nombres, roles, estados y mensajes importantes son anunciados de forma comprensible.'
  },
  {
    id: 'A11Y-MANUAL-ZOOM',
    standard: 'WCAG 2.2 · 1.4.4 / 1.4.10',
    title: 'Zoom 200% y reflow',
    instructions: 'Comprobar zoom de texto al 200% y viewport equivalente a 320 CSS px sin pérdida de información o funcionalidad esencial.',
    evidenceRequired: 'Capturas desktop a 200% y vista estrecha representativa.',
    acceptanceCriteria: 'No se requiere desplazamiento bidimensional para contenido que debe reflow y no se ocultan acciones esenciales.'
  },
  {
    id: 'A11Y-MANUAL-MEDIA',
    standard: 'WCAG 2.2 · 1.2',
    title: 'Contenido multimedia',
    instructions: 'Si existen audio/video, revisar subtítulos, transcripción, audiodescripción u alternativas aplicables.',
    evidenceRequired: 'Inventario de multimedia y alternativa disponible por pieza.',
    acceptanceCriteria: 'Cada recurso multimedia aplicable dispone de la alternativa requerida para su contenido.'
  },
  {
    id: 'A11Y-MANUAL-ERRORS',
    standard: 'WCAG 2.2 · 3.3',
    title: 'Errores y ayuda en formularios',
    instructions: 'Provocar errores de validación y comprobar identificación, instrucciones, asociación con campos y conservación de datos.',
    evidenceRequired: 'Capturas de estados de error y corrección de formularios representativos.',
    acceptanceCriteria: 'Los errores se identifican en texto, se asocian al control y explican cómo corregirlos.'
  },
  {
    id: 'A11Y-MANUAL-MOTION',
    standard: 'WCAG 2.2 · 2.2 / 2.3',
    title: 'Movimiento, parpadeo y tiempo',
    instructions: 'Revisar carruseles, animaciones, contenido autoactualizable, límites de tiempo y destellos.',
    evidenceRequired: 'Inventario de componentes con movimiento/tiempo y mecanismo de pausa o control.',
    acceptanceCriteria: 'El movimiento no crea riesgos, puede controlarse cuando aplica y los límites de tiempo disponen de mecanismo adecuado.'
  },
  {
    id: 'A11Y-MANUAL-MEANING',
    standard: 'WCAG 2.2 · 1.3 / 3.1',
    title: 'Significado, instrucciones y lenguaje',
    instructions: 'Revisar que instrucciones no dependan solo de color/posición y que el idioma, abreviaturas o cambios de idioma relevantes estén identificados.',
    evidenceRequired: 'Muestra de páginas y componentes revisados manualmente.',
    acceptanceCriteria: 'La información conserva significado sin depender únicamente de características visuales y el lenguaje está correctamente indicado.'
  }
]);

export function buildManualAccessibilityChecklist({ enabled = true, browser = null } = {}) {
  if (!enabled) return { status: 'skipped', items: [], note: 'Módulo de accesibilidad no seleccionado.' };
  return {
    status: 'manual-required',
    automatedSource: browser?.status === 'measured' ? 'Chromium + axe-core disponibles como evidencia complementaria.' : 'No hubo Chromium válido; la revisión manual sigue siendo necesaria.',
    note: 'Estos criterios no se consideran aprobados automáticamente. Deben validarse y documentarse por una persona.',
    items: CHECKS.map((item) => ({ ...item, status: 'pending-human-review' }))
  };
}
