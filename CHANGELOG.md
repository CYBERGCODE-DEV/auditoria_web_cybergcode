# Changelog

## v0.20.0 — arquitectura visual y navegación responsive

- Separa la portada pública de la aplicación privada mediante un espacio de trabajo con navegación lateral.
- Rediseña administración y cuenta con secciones independientes, jerarquía tipográfica y menú móvil.
- Amplía la portada con capacidades, principios operativos, SVG accesibles y una ilustración original de auditoría.
- Refuerza los temas claro y oscuro, espaciado responsive y navegación para móvil, tablet y escritorio.

## v0.19.0 — administración, perfil y límites

- Añade una consola responsive en `/admin` para usuarios, organizaciones, roles, suscripciones manuales, límites, suspensiones y activaciones.
- Añade `/account` con perfil, plan, periodo, renovación y consumo; las operaciones de pago se muestran deshabilitadas hasta integrar una pasarela real.
- Añade revocación de sesiones mediante una fecha de validez administrada en servidor.
- Añade trazabilidad SQL de invitaciones, cambios de cuenta, reenvíos y revocaciones.
- Aplica estado de suscripción y cuota antes de iniciar auditorías de analistas; los administradores conservan acceso operativo.
- Refuerza la demostración con límite concurrente por dispositivo, módulos económicos, referencia temporal firmada y cero persistencia.
- Amplía el sitio público con Características, Cómo funciona y Seguridad y privacidad.

## v0.18.0 — portal público, cuentas privadas y aislamiento por organización

- Separa una demostración pública limitada de la plataforma completa autenticada.
- Añade sesiones seguras con Supabase Auth mediante cookies `HttpOnly`, renovación y cierre de sesión.
- Añade administración de invitaciones y roles `admin`, `analyst` y `reader`; el rol privilegiado solo se acepta desde metadatos administrados por servidor.
- Exige cuenta de administrador o analista para auditar, procesar jobs y exportar PDF cuando Supabase está configurado.
- Aísla proyectos, históricos, comparaciones, jobs y reportes por organización y usuario.
- Firma los PDF y comprueba que el resultado firmado pertenezca a la organización de la sesión.
- Añade migraciones SQL multiusuario para instalaciones MySQL y PostgreSQL existentes.
- Mantiene pagos, suscripciones y facturación electrónica fuera de esta versión.

## v0.17.1 — inicio profesional y progreso verificable

- Inicio rediseñado para explicar con claridad qué analiza la plataforma, cómo funciona y qué entrega.
- La configuración sensible queda fuera del mensaje comercial y agrupada como opción avanzada.
- La pantalla de trabajo conserva composición horizontal en tablets y evita partir dominios largos.
- Los pasos, módulos y tareas cambian con eventos confirmados del navegador, del job o de la respuesta del servidor.
- El rastreo por lotes muestra URLs realmente procesadas; no se fabrican porcentajes para auditorías monolíticas.

## v0.17.0 — calidad, seguridad distribuida y observabilidad

- Restaura pruebas unitarias, integración y E2E responsive en seis viewports, ejecutadas por GitHub Actions.
- Añade rate limiting compartido mediante MySQL/PostgreSQL y fallback por instancia cuando SQL no está configurado.
- Añade locks distribuidos con expiración para impedir procesamiento simultáneo de un job grande.
- Enruta Chromium por un proxy local que valida y fija direcciones IP públicas para mitigar DNS rebinding/TOCTOU en subrecursos.
- Exige claves de producción robustas y secretos HMAC de al menos 32 caracteres.
- Añade `X-Request-ID` y logs estructurados de ruta, estado y duración en todas las Functions.
- Valida navegación real, RDAP, hosting y tecnologías contra `cybergcode.com`, además de redirecciones y dominios públicos de control.
- Corrige peticiones HEAD para no rechazar respuestas por un cuerpo que no se descarga.

## v0.16.1 — interfaz responsive unificada

- Paquete de producción limpiado: eliminadas suites/fixtures de `test/`, scripts de pruebas y el generador Chromium heredado que ya no intervenía en Vercel.
- Retirada la dependencia de desarrollo directa `tar-fs`; `axe-core` se conserva porque forma parte del analizador real de accesibilidad.
- Retirado el trigger experimental de Vercel Queues que impedía registrar los outputs del deployment; las auditorías grandes conservan el flujo compatible por lotes desde el cliente.
- Chromium queda limitado a `api/audit` y `api/jobs/finalize`: el Build Output baja de 618.93 MB/9,245 archivos a un paquete mucho menor sin copias en endpoints livianos.
- Los seis endpoints SQL se consolidan en `api/platform`, y se elimina el endpoint legado de Queue para quedar por debajo del límite de Functions de Vercel Hobby.
- Portada compacta y adaptable desde 280 px hasta pantallas amplias.
- Encabezado móvil en una sola fila, controles táctiles de 44 px y prevención de zoom de formularios en iOS.
- Opciones de auditoría reorganizadas en rejilla y contraseña a ancho completo en móvil.
- Cobertura convertida en carrusel horizontal con scroll snap para evitar páginas excesivamente largas.
- Dashboard, métricas, recursos, tablas, evidencias, historial y comparaciones reforzados para móvil y tablet.
- Breakpoints E2E ampliados a 320, 360, 390, 768, 1024 y 1440 px, con verificación de overflow y accesibilidad.

## v0.16.0 — integridad, seguridad y tecnología/dominio

- Corrige el recorrido CSSOM y la detección de pseudoestados sin caracteres de control.
- Añade UUID completos, huella de perfil y bloqueo de comparaciones incompatibles.
- Fija las conexiones HTTP a la IP pública previamente validada y fija el hostname principal en Chromium.
- Añade clave opcional de auditoría, cuotas temporales y tokens de capacidad de 256 bits para jobs.
- Firma el payload autorizado de PDF con HMAC-SHA256 y rechaza modificaciones.
- Añade RDAP de dominio, vencimiento, días restantes, CNAME, IP RDAP y evidencia de hosting/CDN.
- Añade tecnologías con confianza/evidencia y composición frontend por bytes observables.
- Añade idempotency keys y revisiones de estado para entregas repetidas de Vercel Queues.
- Incorpora pruebas unitarias, de integración y E2E con Node Test y Chromium.

## v0.15.1 — adaptadores MySQL/MariaDB y PostgreSQL

- Nueva capa de persistencia multiproveedor seleccionable con `DB_PROVIDER`.
- Soporte de primera clase para **MySQL 8**, **MariaDB**, **TiDB MySQL-compatible** y PostgreSQL/Neon.
- Driver `mysql2` fijado en `3.24.3`.
- Pool serverless limitado y configurable mediante `DB_POOL_LIMIT`.
- TLS configurable mediante `DB_SSL` y activación automática para hosts TiDB Cloud/PlanetScale.
- Nueva migración `migrations/mysql/001_platform.sql`.
- Los snapshots/resultados MySQL usan `LONGTEXT` para compatibilidad MySQL/MariaDB y se serializan/deserializan de forma explícita.
- La interfaz de Plataforma ahora muestra proveedor, dialecto y versión del servidor SQL detectado.
- PostgreSQL/Neon permanece disponible sin cambios funcionales para el usuario.
- El motor de auditoría continúa funcionando sin base de datos; no se inventan históricos.
- ENGINE `0.15.1`, perfil de auditoría `CG-STABLE-5`.

## v0.15.0 — proyectos, PostgreSQL, histórico y antes/después

- Persistencia opcional mediante PostgreSQL serverless (`DATABASE_URL`) compatible con Neon/Vercel.
- Creación automática de un **Proyecto por dominio** al completar una auditoría.
- Historial persistente de auditorías con score, páginas, hallazgos, modo y snapshots normalizados.
- Comparación **Antes vs Después** para puntuación global/categorías, severidades, SEO y métricas de rendimiento disponibles en ambas ejecuciones.
- Nuevo dashboard: `Proyecto`, `Historial` y `Comparar`.
- API de plataforma: `/api/platform-status`, `/api/projects`, `/api/project`, `/api/history`, `/api/audit-record` y `/api/comparison`.
- Snapshot histórico separado del resultado completo para que las comparativas sigan siendo ligeras y verificables.
- El resultado completo se guarda en JSONB únicamente cuando no supera el umbral seguro definido; el snapshot y resumen se conservan siempre.
- El motor sigue funcionando sin base de datos: la interfaz declara explícitamente que el histórico persistente está desactivado.
- Perfil reproducible actualizado a `CG-STABLE-5` y motor `0.15.0`.
- Distribución Production: sin suites de pruebas.

## v0.14.0 — jobs autónomos, recuperación y cobertura multi-plantilla

- Auditorías de más de 50 páginas intentan ejecutarse mediante **Vercel Queues** con topic `cybergcode-large-audit`.
- Consumer privado con trigger `queue/v2beta`; el navegador puede cerrarse mientras la cola continúa procesando.
- Fallback automático al procesamiento client-driven si Queues no está disponible.
- Reintentos controlados para lotes y consolidación, con estado y trazabilidad real del job.
- TTL temporal de jobs ampliado a 12 horas.
- El PDF informa orquestación, reintentos, grupos de plantillas y métricas Chromium representativas.
- Perfil reproducible actualizado a `CG-STABLE-4`.
- Distribución Production sin carpeta de tests.

## v0.14.0 — paquete Production sin tests

- Eliminada completamente la carpeta `test/`.
- Eliminados todos los archivos `*.test.js` del paquete distribuible.
- Retirado el script `npm test` de `package.json`.
- Se conserva `npm run check` para validación sintáctica del código de producción.
- No se modificó la lógica funcional del motor de auditoría respecto de la versión responsive anterior.

## v0.14.0 — limpieza de pruebas y paquete de entrega

- Eliminadas pruebas temporales/legacy con nombres de versión (`v08`, `v09`, `v010`, `v011`, `v012`, `v013`) que ya duplicaban validaciones.
- La cobertura útil se reorganizó en pruebas por funcionalidad: `responsive-ui`, `performance-ux`, `audit-modes-css` y `large-audit-jobs`.
- Se redujo la dependencia de asserts ligados a versiones históricas y se dejó una única verificación de integridad de release.
- El proyecto funcional permanece completo: motor de auditoría, interfaz, endpoints Vercel, jobs, PDF, identidad visual y módulos de análisis.

## v0.14.0 — hardening responsive real en tablet y móvil

- **Loader / auditoría en proceso** reorganizado para **tablet**: el layout se apila antes, el radar central reduce tamaño, el dominio rompe línea sin desbordes y los paneles laterales se convierten en grilla adaptable.
- **Dashboard** optimizado para pantallas intermedias: navegación compacta antes en tablet, paneles principales en una sola columna y botones de acción fluidos.
- **Tablas del informe** ahora pasan a **tarjetas apiladas desde tablet** y no solo en móvil estrecho.
- **Home / formulario** ajustado para móvil real: input y CTA se apilan, opciones pasan a grid responsivo y bloques de cobertura evitan overflow.
- Se mantienen intactos el motor measured-only, los módulos reales y la exportación PDF.

# Changelog

## v0.14.0 — responsive system, loader adaptativo y navegación móvil

- Loader de auditoría rediseñado para **móvil, tablet y desktop** con composición fluida, escalado progresivo y distribución apilada en pantallas estrechas.
- Los **8 nodos orbitales** ahora usan iconografía SVG representativa (SEO, DOM, Imágenes, Accesibilidad, Seguridad, Perú, ISO y PDF) y animaciones sutiles de flotación/brillo para reforzar la sensación interactiva.
- Nuevo **selector móvil de secciones** para el dashboard (`dashboardTabSelect`) que complementa la barra horizontal de pestañas y evita desbordes en pantallas pequeñas.
- Tablas del análisis adaptadas a formato **stacked cards** en móvil, preservando todas las métricas sin desbordes laterales.
- Ajustes responsivos globales en textos, KPIs, paneles, grids, botones, gráficas e imágenes para mejorar la lectura en cualquier dispositivo.
- Todos los assets públicos y el motor visual se actualizan a **ENGINE 0.14.0**.

# CHANGELOG

## v0.11.0 — crawler 100–500 páginas, jobs por lotes y muestreo por plantillas

- Auditorías de 51–500 páginas derivadas automáticamente al flujo `/api/jobs/*`.
- La Function `/api/audit` no intenta procesar auditorías grandes en una sola invocación.
- Job temporal con Vercel Runtime Cache y fallback local de memoria.
- TTL de 2 horas.
- Rastreo en lotes de 20 URLs con concurrencia controlada.
- Progreso basado en URLs realmente procesadas, exitosas, fallidas, descubiertas y pendientes.
- Reanudación después de recargar mediante referencia local + endpoint de estado.
- Cancelación explícita de jobs temporales.
- Almacenamiento de páginas por chunks comprimidos.
- Auto-división de chunks grandes para respetar un margen seguro frente al límite de tamaño por entrada del Runtime Cache.
- Ficha completa por página recuperable bajo demanda mediante `/api/jobs/page`.
- Resultado principal compacto para controlar el payload del dashboard.
- Agrupación heurística de páginas por tipo/plantilla usando URL, headings y structured data.
- Nueva pestaña **Cobertura**.
- Selección de URL representativa por grupo.
- Muestreo Chromium adicional sobre hasta 3 plantillas no-home cuando el navegador está habilitado.
- El muestreo representativo no altera ni inventa el score PageSpeed principal.
- PDF ampliado con cobertura del crawler, grupos de plantillas y muestras representativas.
- Perfil estable actualizado a `CG-STABLE-4`.
- ENGINE `0.11.0`.
- Política measured-only preservada.

## v0.10.0 — modos de auditoría, CSS avanzado y accesibilidad manual guiada

- Modos Rápida / Completa / Personalizada.
- Selección real de módulos y dispositivos.
- Configuración incluida en fingerprint/caché.
- Scoring excluye categorías no seleccionadas.
- Tabs no seleccionados se ocultan del dashboard.
- CSSOM + computed styles para cobertura CSS observable, inline styles, variables, tipografías, spacing, radios y estados.
- Hallazgos y remediaciones CSS nuevas.
- Accesibilidad manual guiada con persistencia local por auditoría.
- Tab Accesibilidad independiente.
- PageSpeed y CrUX respetan Mobile/Desktop.
- PageSpeed conserva resultados parciales por dispositivo cuando uno falla.
- Matriz visual impacto/esfuerzo del plan de acción.
- PDF ampliado con modo, dispositivos, CSS y revisión manual.
- Perfil reproducible CG-STABLE-2.
- 49+ pruebas automatizadas de la base, más pruebas específicas de V0.10.

## v0.9.0 — performance fiable, CrUX, UX/CRO y revisión IA opcional

- CrUX API e History API opcionales.
- Chromium Lab como fallback medido y separado de Lighthouse.
- UX/CRO observable.
- IA editorial opcional sin impacto en score técnico.
- SEO e imágenes avanzadas.
- Plan de acción y Quick Wins.
