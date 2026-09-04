const remediation = (recommendation, solution, steps, acceptanceCriteria, codeExample = null, effort = 'Media') => ({
  recommendation,
  solution,
  steps,
  acceptanceCriteria,
  codeExample,
  effort
});

export const REMEDIATIONS = Object.freeze({
  'SEO-TITLE-001': remediation(
    'Crear un <title> único, descriptivo y alineado con la intención principal de la URL.',
    'La página debe entregar un elemento <title> no vacío en el HTML inicial, coherente con su H1 y distinto del resto de páginas relevantes.',
    ['Definir el tema principal de la URL.', 'Redactar un title específico y natural.', 'Insertarlo dentro de <head>.', 'Comprobar que no se repita de forma innecesaria en otras URLs.'],
    'La auditoría detecta un <title> con texto útil en HTML inicial y deja de generar SEO-TITLE-001.',
    '<title>Desarrollo de software a medida | Mi Empresa</title>',
    'Baja'
  ),
  'SEO-DESC-001': remediation(
    'Añadir una meta description útil que resuma el contenido y ayude al usuario a entender la propuesta de la página.',
    'La URL debe incluir <meta name="description"> con contenido específico, legible y coherente con la página.',
    ['Redactar un resumen orientado al usuario.', 'Evitar descripciones duplicadas entre páginas importantes.', 'Insertar la etiqueta en <head>.', 'Revisar el snippet real en buscadores cuando la página esté indexada.'],
    'La auditoría encuentra meta[name="description"] con contenido no vacío y deja de generar SEO-DESC-001.',
    '<meta name="description" content="Desarrollamos soluciones web y software a medida para empresas.">',
    'Baja'
  ),
  'SEO-H-001': remediation(
    'Añadir un H1 que identifique claramente el tema principal de la página.',
    'Debe existir al menos un <h1> visible, descriptivo y relacionado con el contenido principal.',
    ['Identificar el título principal real.', 'Usar un H1 semántico, no un div estilizado.', 'Mantener coherencia entre title, H1 y contenido.', 'Volver a ejecutar la auditoría.'],
    'La URL presenta un H1 visible y significativo y la regla SEO-H-001 ya no aparece.',
    '<h1>Software a medida para automatizar tu empresa</h1>',
    'Baja'
  ),
  'SEO-H-002': remediation(
    'Revisar los múltiples H1 y confirmar que la estructura semántica sigue siendo clara.',
    'Los H1 existentes deben responder a una estructura justificable; si compiten por representar el título principal, conservar uno principal y reorganizar el resto como H2/H3.',
    ['Localizar todos los H1.', 'Determinar cuál representa el contenido principal.', 'Reclasificar los secundarios si corresponde.', 'Validar navegación y accesibilidad después del cambio.'],
    'La estructura queda intencional y clara; idealmente existe un único título principal cuando la plantilla no requiere múltiples H1.',
    '<h1>Título principal</h1>\n<h2>Sección secundaria</h2>',
    'Baja'
  ),
  'SEO-H-003': remediation(
    'Eliminar encabezados vacíos o proporcionarles un texto significativo.',
    'Ningún H1-H6 utilizado como estructura debe quedar vacío.',
    ['Identificar el heading vacío.', 'Eliminarlo si solo se usaba para espacio visual.', 'Añadir contenido si representa una sección real.', 'Usar CSS para espaciado en lugar de headings vacíos.'],
    'No quedan elementos H1-H6 vacíos en el DOM auditado.',
    '<h2>Nuestros servicios</h2>',
    'Baja'
  ),
  'SEO-H-004': remediation(
    'Reorganizar la jerarquía de encabezados para que los niveles reflejen la estructura lógica del contenido.',
    'Los encabezados deben seguir una secuencia semántica comprensible y evitar saltos injustificados como H2 → H4.',
    ['Revisar el árbol H1-H6.', 'Identificar saltos de nivel.', 'Cambiar el nivel según la jerarquía real, no según el tamaño visual.', 'Mantener el aspecto mediante CSS.'],
    'La jerarquía auditada no presenta saltos semánticos injustificados.',
    '<h2>Servicios</h2>\n<h3>Desarrollo web</h3>',
    'Baja'
  ),
  'SEO-CAN-001': remediation(
    'Definir la URL canónica adecuada cuando la página pueda tener variantes o duplicados.',
    'La página debe declarar rel="canonical" apuntando a la URL preferida y accesible cuando el caso lo requiera.',
    ['Determinar la URL preferida.', 'Añadir canonical absoluto en <head>.', 'Evitar canonicals hacia URLs con error o noindex.', 'Mantener coherencia con redirects y sitemap.'],
    'La auditoría detecta un canonical válido y coherente o la revisión documenta que no es necesario para esa plantilla.',
    '<link rel="canonical" href="https://example.com/servicio">',
    'Baja'
  ),
  'IMG-ALT-001': remediation(
    'Añadir texto alternativo a imágenes informativas y alt vacío a imágenes puramente decorativas.',
    'Cada <img> debe tener atributo alt; su contenido debe describir la función o información de la imagen cuando corresponda.',
    ['Clasificar la imagen como informativa o decorativa.', 'Escribir un alt breve y contextual para imágenes informativas.', 'Usar alt="" para decorativas.', 'Evitar repetir el nombre del archivo o frases genéricas.'],
    'Todas las imágenes auditadas incluyen atributo alt adecuado a su función y deja de aparecer IMG-ALT-001.',
    '<img src="equipo.webp" alt="Equipo de desarrollo trabajando en una aplicación web">',
    'Baja'
  ),
  'IMG-ALT-002': remediation(
    'Sustituir textos alternativos sospechosos por descripciones contextuales útiles.',
    'El alt no debe ser únicamente un nombre de archivo, URL o texto genérico cuando la imagen aporta información.',
    ['Revisar el propósito de la imagen.', 'Describir el contenido o función en contexto.', 'Eliminar palabras redundantes como “imagen de” salvo que sean necesarias.'],
    'El alt expresa la función de la imagen y ya no coincide con un patrón genérico o de archivo.',
    '<img src="servicio.webp" alt="Panel de control del sistema de inventario">',
    'Baja'
  ),
  'IMG-DIM-001': remediation(
    'Declarar width y height coherentes con la relación de aspecto de la imagen.',
    'Las imágenes relevantes deben reservar espacio antes de cargar para reducir desplazamientos de layout.',
    ['Obtener las dimensiones intrínsecas o relación de aspecto.', 'Añadir width y height al elemento.', 'Mantener CSS responsive con max-width:100%; height:auto.', 'Verificar CLS después del cambio.'],
    'Las imágenes auditadas tienen dimensiones explícitas o un mecanismo equivalente que reserva correctamente el espacio.',
    '<img src="hero.webp" width="1600" height="900" style="max-width:100%;height:auto" alt="...">',
    'Baja'
  ),
  'SEC-HTTPS-001': remediation(
    'Servir el sitio exclusivamente mediante HTTPS y redirigir HTTP a HTTPS.',
    'Toda URL pública debe responder de forma segura por HTTPS con certificado válido; HTTP debe redirigir a la versión HTTPS definitiva.',
    ['Instalar o renovar certificado TLS válido.', 'Configurar redirección 301/308 HTTP → HTTPS.', 'Actualizar enlaces y recursos internos.', 'Verificar que no exista contenido mixto.'],
    'La URL final es HTTPS, el certificado es válido y todas las variantes HTTP redirigen a HTTPS sin bucles.',
    'HTTP 301/308 → https://dominio.com/...',
    'Media'
  ),
  'SEC-HSTS-001': remediation(
    'Configurar HSTS cuando el dominio y sus dependencias estén preparados para operar siempre por HTTPS.',
    'La respuesta HTTPS debe incluir Strict-Transport-Security con una política adecuada y probada.',
    ['Confirmar que todo el sitio funciona por HTTPS.', 'Configurar HSTS inicialmente con un max-age prudente.', 'Ampliar max-age tras validar.', 'Añadir includeSubDomains solo si todos los subdominios están preparados.'],
    'La cabecera Strict-Transport-Security aparece en respuestas HTTPS con una política aprobada para el dominio.',
    'Strict-Transport-Security: max-age=31536000; includeSubDomains',
    'Media'
  ),
  'SEC-CSP-001': remediation(
    'Implementar una Content-Security-Policy basada en los orígenes que realmente utiliza la aplicación.',
    'Las respuestas deben incluir una CSP que restrinja scripts, estilos, imágenes, conexiones, frames y otros recursos sin romper funcionalidades legítimas.',
    ['Inventariar dominios externos usados.', 'Empezar con Content-Security-Policy-Report-Only.', 'Eliminar inline scripts o usar nonces/hashes cuando sea viable.', 'Corregir violaciones legítimas.', 'Activar Content-Security-Policy definitiva.'],
    'La cabecera CSP está presente, no rompe funcionalidades y reduce fuentes a las estrictamente necesarias.',
    "Content-Security-Policy: default-src 'self'; img-src 'self' https: data:; script-src 'self' 'nonce-...'; object-src 'none'; base-uri 'self'",
    'Media/Alta'
  ),
  'SEC-NOSNIFF-001': remediation(
    'Añadir X-Content-Type-Options: nosniff.',
    'El servidor debe impedir el MIME sniffing en respuestas aplicables.',
    ['Configurar la cabecera globalmente.', 'Verificar tipos MIME correctos de CSS, JS, fuentes e imágenes.', 'Reprobar recursos estáticos y dinámicos.'],
    'La cabecera X-Content-Type-Options está presente con valor nosniff.',
    'X-Content-Type-Options: nosniff',
    'Baja'
  ),
  'SEC-REF-001': remediation(
    'Definir una Referrer-Policy coherente con las necesidades de analítica y privacidad.',
    'El sitio debe declarar explícitamente qué información de referencia comparte al navegar hacia otros orígenes.',
    ['Elegir una política según necesidades.', 'Configurarla como cabecera HTTP.', 'Validar analítica, pagos e integraciones.'],
    'La respuesta incluye Referrer-Policy con el valor aprobado para la aplicación.',
    'Referrer-Policy: strict-origin-when-cross-origin',
    'Baja'
  ),
  'SEC-PERM-001': remediation(
    'Restringir mediante Permissions-Policy las capacidades del navegador que el sitio no utiliza.',
    'La aplicación debe declarar permisos explícitos para cámara, micrófono, geolocalización u otras APIs sensibles cuando aplique.',
    ['Inventariar APIs del navegador usadas.', 'Desactivar las no utilizadas.', 'Permitir únicamente orígenes necesarios.', 'Probar funciones que sí requieren permisos.'],
    'La cabecera Permissions-Policy está presente y las funciones legítimas siguen operativas.',
    'Permissions-Policy: camera=(), microphone=(), geolocation=()',
    'Baja'
  ),
  'SEC-DISC-001': remediation(
    'Reducir información innecesaria sobre servidor, framework o runtime expuesta en cabeceras.',
    'Las respuestas no deben revelar versiones o tecnologías que no aportan valor funcional.',
    ['Eliminar X-Powered-By.', 'Ocultar o generalizar Server cuando la plataforma lo permita.', 'No confiar en esta medida como control principal de seguridad.'],
    'Las cabeceras de respuesta ya no exponen detalles innecesarios de plataforma o versiones.',
    'X-Powered-By: [eliminado]',
    'Baja'
  ),
  'SEC-MIXED-001': remediation(
    'Migrar a HTTPS todos los recursos cargados por una página HTTPS.',
    'No debe existir ningún script, estilo, imagen, iframe, fuente o petición activa servida por HTTP dentro de una página HTTPS.',
    ['Localizar URLs http:// detectadas.', 'Actualizar a https:// cuando el proveedor lo soporte.', 'Sustituir proveedores sin HTTPS.', 'Revisar CSS y contenido dinámico.', 'Repetir auditoría.'],
    'La página HTTPS no realiza solicitudes HTTP y SEC-MIXED-001 desaparece.',
    'https://cdn.example.com/recurso.js',
    'Baja/Media'
  ),
  'HTTP-5XX-001': remediation(
    'Corregir la causa del error de servidor antes de abordar optimizaciones secundarias.',
    'La URL debe responder con un código 2xx apropiado o redirección intencional estable, sin errores 5xx.',
    ['Revisar logs de aplicación y servidor.', 'Reproducir el error.', 'Corregir excepción, dependencia, timeout o configuración.', 'Añadir monitorización y prueba de regresión.'],
    'La URL deja de devolver 5xx de forma reproducible y responde correctamente en nuevas auditorías.',
    'HTTP 200 OK',
    'Media/Alta'
  ),
  'HTTP-4XX-001': remediation(
    'Corregir la URL, permisos o enlaces que llevan a una respuesta 4xx no intencional.',
    'La URL debe responder con el recurso esperado, redirigir correctamente o eliminarse de navegación/sitemap si ya no debe existir.',
    ['Determinar si la URL debería existir.', 'Restaurar el recurso o aplicar redirección cuando corresponda.', 'Actualizar enlaces internos.', 'Retirar URLs inexistentes de sitemap.'],
    'La URL ya no devuelve un 4xx inesperado y los enlaces internos apuntan al destino correcto.',
    'HTTP 200 o redirección 301/308 intencional',
    'Baja/Media'
  ),
  'HTTP-REDIR-001': remediation(
    'Reducir la cadena de redirecciones y enlazar directamente al destino final.',
    'Las URLs internas y canónicas deberían llegar al destino definitivo con cero o el mínimo imprescindible de saltos.',
    ['Documentar la cadena actual.', 'Actualizar enlaces internos al destino final.', 'Consolidar reglas redundantes.', 'Probar variantes HTTP/www/trailing slash.'],
    'La auditoría observa menos redirecciones y no supera el umbral configurado.',
    '/antigua → /final',
    'Baja'
  ),
  'DOM-JS-001': remediation(
    'Corregir las excepciones JavaScript reproducibles detectadas durante la carga.',
    'La página debe completar la carga y sus interacciones principales sin errores no controlados en consola.',
    ['Reproducir el error con stack trace.', 'Identificar componente y condición.', 'Añadir manejo de errores o corregir la causa.', 'Crear prueba de regresión.', 'Validar nuevamente con Chromium.'],
    'La misma navegación ya no genera pageerror y las funciones afectadas operan correctamente.',
    'try { /* operación */ } catch (error) { /* manejo controlado */ }',
    'Media'
  ),
  'DOM-META-001': remediation(
    'Servir metadatos esenciales desde HTML inicial o SSR cuando sean críticos para rastreo e integraciones.',
    'El title, description y canonical esenciales deben ser coherentes entre HTML inicial y DOM renderizado.',
    ['Comparar HTML inicial y DOM final.', 'Mover metadatos críticos al servidor/plantilla.', 'Evitar sobrescrituras innecesarias en cliente.', 'Validar ambos estados.'],
    'HTML inicial y DOM renderizado presentan metadatos equivalentes o la dependencia de JS queda documentada y justificada.',
    '<head><title>...</title><meta name="description" content="..."></head>',
    'Media'
  ),
  'DOM-STRUCT-001': remediation(
    'Asegurar que la estructura semántica principal no dependa innecesariamente de JavaScript.',
    'Los encabezados y contenido esencial deben estar disponibles de forma consistente en el estado inicial o mediante renderizado servidor cuando el proyecto lo permita.',
    ['Comparar headings iniciales y finales.', 'Identificar contenido inyectado por JS.', 'Aplicar SSR/prerender si aporta valor.', 'Mantener una jerarquía idéntica y accesible.'],
    'El árbol principal de encabezados es coherente antes y después del render o la diferencia está técnicamente justificada.',
    null,
    'Media'
  ),
  'A11Y-CONTRAST-AA': remediation(
    'Ajustar las combinaciones de texto y fondo que no alcanzan el contraste mínimo aplicable.',
    'Texto normal debe alcanzar al menos 4.5:1 y texto grande al menos 3:1, salvo excepciones aplicables de WCAG.',
    ['Identificar el selector y colores detectados.', 'Modificar color de texto, fondo o ambos.', 'Revisar estados hover/focus/disabled.', 'Recalcular contraste.'],
    'Todas las combinaciones señaladas alcanzan el umbral WCAG AA correspondiente y la regla deja de aparecer.',
    'color: #1f2937; background: #ffffff; /* contraste suficiente */',
    'Baja'
  ),
  'A11Y-REFLOW-001': remediation(
    'Eliminar el desbordamiento horizontal no intencional en móvil.',
    'El contenido debe ajustarse al viewport sin obligar a desplazamiento horizontal para lectura o interacción normal.',
    ['Revisar selectores reportados.', 'Sustituir anchos fijos por medidas fluidas.', 'Aplicar max-width:100% a medios.', 'Hacer tablas/contenedores responsivos.', 'Reprobar en 320–390 px.'],
    'document.documentElement.scrollWidth no supera significativamente innerWidth en los viewports auditados.',
    'img, video { max-width: 100%; height: auto; }',
    'Baja/Media'
  ),
  'A11Y-TARGET-001': remediation(
    'Aumentar el área táctil o el espaciado de controles demasiado pequeños.',
    'Los controles interactivos relevantes deben ofrecer un área de activación suficiente y separación que reduzca pulsaciones accidentales.',
    ['Localizar controles reportados.', 'Aumentar padding/min-width/min-height.', 'Separar controles adyacentes.', 'Validar en móvil y teclado.'],
    'Los controles señalados alcanzan al menos 24×24 CSS px cuando aplica o cuentan con espaciado equivalente según el criterio usado.',
    'button, .tap-target { min-width: 24px; min-height: 24px; }',
    'Baja'
  ),
  'PERF-LCP-001': remediation(
    'Priorizar la carga del elemento LCP y reducir trabajo bloqueante antes de su renderizado.',
    'La medición móvil debe situar LCP en 2.5 s o menos en condiciones comparables, idealmente validado también con datos reales de usuarios.',
    ['Identificar el elemento LCP en Lighthouse.', 'Optimizar y dimensionar la imagen/hero.', 'Evitar lazy loading del LCP.', 'Preload del recurso crítico cuando proceda.', 'Reducir TTFB, CSS y JS bloqueante.'],
    'Una nueva prueba comparable obtiene LCP ≤ 2.5 s y el recurso principal no está retrasado por carga diferida innecesaria.',
    '<link rel="preload" as="image" href="/hero.webp">',
    'Media'
  ),
  'PERF-CLS-001': remediation(
    'Reservar espacio para contenido dinámico, imágenes, iframes y fuentes para evitar saltos visuales.',
    'La prueba debe obtener CLS ≤ 0.1 en condiciones comparables.',
    ['Añadir dimensiones/aspect-ratio a medios.', 'Reservar espacio para banners y widgets.', 'Evitar insertar contenido encima del viewport ya renderizado.', 'Optimizar carga de fuentes.'],
    'Una nueva medición obtiene CLS ≤ 0.1 y los desplazamientos principales identificados están corregidos.',
    '.media { aspect-ratio: 16 / 9; }',
    'Baja/Media'
  ),
  'PERF-TBT-001': remediation(
    'Reducir JavaScript y dividir tareas largas del hilo principal.',
    'El TBT de laboratorio debe bajar al rango objetivo definido por la metodología y no existir trabajo largo innecesario durante la carga.',
    ['Revisar long tasks y scripts de terceros.', 'Eliminar JS no utilizado.', 'Dividir bundles y cargar por demanda.', 'Posponer terceros no críticos.', 'Mover cálculos pesados fuera del hilo principal cuando proceda.'],
    'La nueva ejecución reduce TBT por debajo del umbral configurado y disminuyen las tareas largas responsables.',
    '<script type="module" src="/app.js" defer></script>',
    'Media/Alta'
  ),
  'ISO-29184-PRIVACY-001': remediation(
    'Publicar y enlazar un aviso de privacidad visible desde los puntos donde se recopilan datos personales.',
    'La web debe permitir que el usuario acceda fácilmente a información de privacidad coherente con los tratamientos reales, especialmente junto a formularios y otras capturas de datos.',
    ['Inventariar los formularios y datos recopilados.', 'Redactar o actualizar el aviso de privacidad con apoyo legal cuando corresponda.', 'Añadir un enlace visible en footer y cerca de los formularios.', 'Verificar que la URL sea accesible y no esté rota.', 'Repetir la auditoría y revisar el contenido manualmente.'],
    'La auditoría detecta un enlace de privacidad accesible y una revisión manual confirma que el aviso describe los tratamientos aplicables.',
    '<a href="/politica-de-privacidad">Política de privacidad</a>',
    'Baja / Media'
  ),
  'ISO-29184-CONSENT-001': remediation(
    'Revisar si los tratamientos detectados requieren consentimiento y, cuando corresponda, implementar un mecanismo claro, informado y registrable.',
    'El flujo debe diferenciar información, aceptación de términos y consentimiento para finalidades opcionales; no debe asumirse consentimiento por silencio o por casillas preseleccionadas cuando no corresponda.',
    ['Identificar finalidad y base aplicable para cada formulario/cookie.', 'Separar consentimientos opcionales de condiciones necesarias.', 'Añadir texto y enlaces a privacidad en contexto.', 'Registrar la decisión del usuario cuando sea necesario.', 'Probar aceptación, rechazo y revocación cuando aplique.'],
    'Los flujos que requieren consentimiento permiten una decisión explícita y trazable, y la revisión manual confirma que la información presentada es suficiente.',
    '<label><input type="checkbox" name="marketing_consent"> Acepto recibir comunicaciones comerciales opcionales</label>',
    'Media'
  ),
  'ISO-29147-VDP-001': remediation(
    'Definir un canal público y mantenido para recibir reportes de vulnerabilidades.',
    'La organización debe disponer de un mecanismo claro de contacto y un proceso interno para recibir, clasificar, remediar y comunicar vulnerabilidades. Publicar security.txt es una evidencia técnica útil, aunque por sí sola no demuestra conformidad ISO.',
    ['Definir responsable y correo/canal de seguridad.', 'Documentar el procedimiento interno de recepción y triage.', 'Publicar /.well-known/security.txt siguiendo un formato válido.', 'Definir expectativas de respuesta y política de divulgación.', 'Probar periódicamente que el canal funciona.'],
    'Existe un canal público operativo y la organización puede demostrar con evidencia interna que los reportes se reciben, gestionan y cierran de forma trazable.',
    'Contact: mailto:security@example.com\nExpires: 2027-12-31T23:59:59Z\nPreferred-Languages: es, en',
    'Baja / Media'
  ),
  'INFRA-TLS-001': remediation(
    'Corregir la cadena o configuración del certificado TLS para que el navegador pueda validarlo sin errores.',
    'El certificado presentado debe ser válido para el hostname, estar emitido por una CA confiable y entregar una cadena completa.',
    ['Revisar el certificado y la cadena intermedia.', 'Confirmar SAN/hostname.', 'Instalar la cadena completa en el servidor/CDN.', 'Probar desde varias redes/navegadores.'],
    'La conexión TLS se valida correctamente y no devuelve authorizationError.', null, 'Media'
  ),
  'INFRA-TLS-002': remediation(
    'Renovar inmediatamente el certificado TLS expirado.',
    'El dominio debe presentar un certificado vigente y confiable.',
    ['Emitir/renovar certificado.', 'Instalarlo en servidor o CDN.', 'Validar hostname y cadena.', 'Automatizar renovación y alertas.'],
    'El certificado queda vigente y la auditoría reporta daysRemaining > 0.', null, 'Alta'
  ),
  'INFRA-TLS-003': remediation(
    'Renovar el certificado antes de su fecha de expiración y activar alertas preventivas.',
    'Mantener un margen operativo suficiente para evitar interrupciones de HTTPS.',
    ['Confirmar mecanismo de renovación.', 'Renovar si corresponde.', 'Configurar alertas 30/15/7 días.', 'Verificar despliegue del nuevo certificado.'],
    'El certificado tiene margen de vigencia aceptable según la política interna.', null, 'Baja'
  ),
  'INFRA-DNS-CAA-001': remediation(
    'Publicar registros CAA si la organización desea restringir qué autoridades certificadoras pueden emitir certificados para el dominio.',
    'Definir CAA coherentes con el proveedor real de certificados y el proceso de emisión.',
    ['Identificar CA utilizada.', 'Añadir CAA issue/issuewild según necesidad.', 'Validar resolución DNS.', 'Documentar el cambio.'],
    'La consulta CAA devuelve la política aprobada o existe una decisión documentada de no utilizar CAA.', 'example.com. CAA 0 issue "letsencrypt.org"', 'Baja'
  ),
  'INFRA-DNSSEC-001': remediation(
    'Evaluar y habilitar DNSSEC cuando el registrador y proveedor DNS lo soporten.',
    'La zona debe firmarse y publicar el DS correcto en la zona padre sin provocar fallos de validación.',
    ['Confirmar soporte DNSSEC.', 'Generar/activar claves en DNS.', 'Publicar DS en registrador.', 'Validar cadena y rotación.'],
    'Se detecta un registro DS válido y la resolución DNSSEC funciona sin errores.', null, 'Media'
  ),
  'INFRA-MAIL-SPF-001': remediation(
    'Publicar una política SPF única que autorice solamente los emisores legítimos.',
    'El dominio debe tener un único registro v=spf1 válido y compatible con sus proveedores de correo.',
    ['Inventariar emisores.', 'Construir SPF con include/ip autorizados.', 'Evitar múltiples registros SPF.', 'Probar y terminar con una política adecuada.'],
    'La consulta TXT devuelve un SPF válido y los correos legítimos obtienen SPF=pass.', 'v=spf1 include:_spf.example.net -all', 'Baja/Media'
  ),
  'INFRA-MAIL-DMARC-001': remediation(
    'Publicar DMARC y avanzar gradualmente desde monitorización hacia una política de protección.',
    'El dominio debe publicar v=DMARC1 con alineamiento, política y reportes adecuados al entorno.',
    ['Activar p=none con rua para observar.', 'Corregir SPF/DKIM y alineamiento.', 'Avanzar a quarantine/reject cuando la cobertura sea suficiente.', 'Revisar reportes periódicamente.'],
    'Existe un registro DMARC válido y la organización demuestra alineamiento y política acordes a su riesgo.', 'v=DMARC1; p=quarantine; rua=mailto:dmarc@example.com; pct=100', 'Media'
  ),
  'INFRA-COOKIE-SECURE-001': remediation(
    'Marcar como Secure las cookies de sesión o autenticación servidas por HTTPS.',
    'Las cookies sensibles no deben enviarse por conexiones HTTP.',
    ['Identificar cookies de sesión/auth.', 'Añadir atributo Secure.', 'Forzar HTTPS.', 'Probar login y renovación de sesión.'],
    'Todas las cookies sensibles tienen Secure=true y no viajan por HTTP.', 'Set-Cookie: session=...; Secure; HttpOnly; SameSite=Lax', 'Baja'
  ),
  'INFRA-COOKIE-HTTPONLY-001': remediation(
    'Marcar HttpOnly las cookies de sesión que no necesitan acceso desde JavaScript.',
    'Las cookies sensibles deben quedar fuera de document.cookie salvo necesidad justificada.',
    ['Clasificar cookies.', 'Añadir HttpOnly a sesión/auth.', 'Eliminar dependencias JS innecesarias.', 'Probar autenticación.'],
    'Las cookies sensibles tienen HttpOnly=true o existe una justificación técnica documentada.', 'Set-Cookie: session=...; Secure; HttpOnly; SameSite=Lax', 'Baja'
  ),
  'INFRA-COOKIE-SAMESITE-001': remediation(
    'Definir SameSite de forma explícita según el flujo de autenticación y navegación.',
    'Las cookies sensibles deben usar Lax o Strict cuando sea posible; SameSite=None requiere Secure.',
    ['Revisar flujos cross-site.', 'Elegir Lax/Strict/None.', 'Configurar Secure si None.', 'Probar OAuth/pagos/iframes.'],
    'Las cookies sensibles tienen SameSite explícito y los flujos legítimos siguen funcionando.', 'Set-Cookie: session=...; Secure; HttpOnly; SameSite=Lax', 'Baja'
  ),
  'INFRA-TRACKER-001': remediation(
    'Revisar los terceros de analítica/marketing cargados antes de cualquier interacción de consentimiento.',
    'Los recursos de seguimiento deben responder a una finalidad y base aplicable, y activarse según la política de consentimiento definida para el sitio.',
    ['Inventariar trackers.', 'Clasificar necesarios/analítica/marketing.', 'Bloquear los no necesarios hasta la condición aplicable.', 'Permitir rechazo y preferencias cuando corresponda.', 'Documentar terceros en privacidad/cookies.'],
    'La carga de terceros coincide con la política de consentimiento y la revisión legal/privacidad aplicable.', null, 'Media'
  ),
  'PE-PRIVACY-001': remediation(
    'Publicar una política/aviso de privacidad visible y coherente con los tratamientos reales del sitio.',
    'La información de privacidad debe ser accesible desde formularios y navegación relevante y describir responsable, finalidades, datos, destinatarios, derechos y canales aplicables.',
    ['Inventariar tratamientos.', 'Revisar contenido con responsable legal/privacidad.', 'Publicar página accesible.', 'Enlazar desde formularios y footer.', 'Mantener versión y fecha.'],
    'El enlace existe, funciona y la revisión humana confirma que el aviso refleja los tratamientos reales.', null, 'Media'
  ),
  'PE-CONSUMER-LR-001': remediation(
    'Habilitar un Libro de Reclamaciones virtual visible cuando la obligación resulte aplicable al proveedor/plataforma.',
    'El usuario debe poder ubicar y utilizar un canal de reclamaciones accesible desde el portal de venta/servicio.',
    ['Confirmar aplicabilidad legal.', 'Implementar Libro de Reclamaciones virtual.', 'Añadir enlace visible y aviso.', 'Probar registro y constancia.', 'Definir atención dentro del plazo aplicable.'],
    'El enlace al Libro de Reclamaciones es visible, funcional y el proceso genera una constancia/seguimiento conforme al procedimiento aplicable.', null, 'Media'
  ),
  'PE-COOKIE-001': remediation(
    'Revisar cookies y trackers frente a la política de privacidad y el mecanismo de consentimiento aplicable.',
    'La interfaz debe informar y permitir la gestión de tecnologías no necesarias cuando corresponda, sin afirmar automáticamente una infracción legal por su sola presencia.',
    ['Inventariar cookies/trackers.', 'Clasificar finalidad y duración.', 'Definir condición de activación.', 'Añadir panel de preferencias si corresponde.', 'Probar aceptar/rechazar/revocar.'],
    'La configuración técnica y la documentación de privacidad son coherentes y los terceros se activan según la decisión definida.', null, 'Media'
  ),
  'PE-CONSUMER-DARK-001': remediation(
    'Revisar interfaces de compra, suscripción y cancelación para evitar patrones que distorsionen la decisión del consumidor.',
    'Las acciones principales, precios, cargos adicionales, suscripciones y opciones de rechazo/cancelación deben mostrarse de forma clara y no coercitiva.',
    ['Revisar checkout y suscripciones.', 'Eliminar opciones preseleccionadas no necesarias.', 'Mostrar costos totales antes de confirmar.', 'Dar igual claridad a aceptar/rechazar cuando corresponda.', 'Probar cancelación.'],
    'La revisión UX/legal documenta que los flujos no inducen decisiones engañosas y que costos/condiciones se presentan antes de confirmar.', null, 'Media'
  )
});

export function getRemediation(ruleId) {
  return REMEDIATIONS[ruleId] || null;
}
