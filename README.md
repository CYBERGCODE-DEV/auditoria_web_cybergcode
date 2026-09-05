# CYBERGCODE Web Audit Intelligence v0.15.0

Plataforma de auditoría web integral preparada para **GitHub → Vercel**, con frontend HTML/CSS/JavaScript y backend Node.js/Vercel Functions.

## Principio de integridad

**Datos medidos, no simulaciones.** Un módulo no ejecutado, una fuente externa sin respuesta o una comprobación manual pendiente no reciben una puntuación inventada. Las heurísticas de UX/CRO, agrupación de plantillas, cobertura CSS e IA se identifican expresamente como tales.

## Novedad principal V0.14: auditorías grandes autónomas de 100–500 páginas

Hasta 50 páginas se mantiene la ejecución directa existente. Cuando el usuario solicita **más de 50 páginas**, la interfaz crea un **job temporal por lotes** en vez de intentar procesar cientos de URLs dentro de una única Function.

### Flujo real

```text
Dominio
  ↓
robots.txt + sitemap + enlaces internos
  ↓
Job temporal
  ↓
lotes de 20 URLs
  ↓
HTTP / HTML / SEO / H1-H6 / links / imágenes / contenido
  ↓
chunks comprimidos en Vercel Runtime Cache
  ↓
agrupación heurística por plantillas
  ↓
representantes de plantillas
  ↓
Chromium adicional sobre muestra limitada
  ↓
consolidación del mismo JSON
  ↓
Dashboard + PDF
```

En Vercel, el job se publica en **Vercel Queues** y un consumer privado procesa los lotes y la consolidación. El navegador ya no necesita permanecer abierto para que la cola siga avanzando. Si Queues no está disponible, el sistema conserva automáticamente el flujo client-driven anterior como fallback explícito.

## Persistencia temporal del job

La V0.14 utiliza **Vercel Runtime Cache** para el estado temporal del job y **Vercel Queues** para la orquestación autónoma cuando está disponible. En desarrollo local se conserva un fallback de memoria y ejecución desde el cliente.

- TTL del job: **12 horas**.
- Estado, lotes y resultado se almacenan por claves independientes.
- Los lotes se comprimen con gzip/base64.
- Un chunk demasiado grande se divide automáticamente en varias partes para mantenerse por debajo de un margen seguro respecto al límite de tamaño por entrada del Runtime Cache.
- Si una única página produce un detalle extraordinariamente grande, el almacenamiento temporal limita arrays muy extensos y lo declara mediante `jobStorage.truncated=true`; no se inventan datos faltantes.
- Runtime Cache sigue siendo almacenamiento temporal: el histórico permanente se implementará en la fase plataforma con base de datos.

## Reanudación y cancelación

La interfaz guarda solo una referencia local al job activo:

```text
cybergcode:active-large-job
```

Al volver a abrir la aplicación puede consultar `/api/jobs/status` y:

- reanudar el rastreo;
- abrir el resultado si ya fue consolidado;
- descartar/cancelar el job temporal.

La cancelación marca el job como `cancelled`; no convierte páginas pendientes en páginas procesadas.

## Progreso real

Para auditorías grandes la pantalla de carga muestra:

- URLs realmente procesadas;
- páginas HTML procesadas correctamente;
- fallos reales;
- URLs descubiertas;
- URLs todavía en cola;
- lotes persistidos;
- fase `crawling / crawl-complete / finalizing / completed`.

Si la cola se agota antes del límite solicitado, la interfaz muestra por ejemplo:

```text
31 URLs procesadas · cola agotada antes del límite 500
```

en lugar de fingir `500/500`.

## Agrupación por plantillas

Después del rastreo se agrupan páginas mediante señales observables:

- patrón de URL;
- estructura de encabezados;
- datos estructurados.

Ejemplos de grupos:

```text
Home
Producto
Categoría
Artículo
Contacto
Checkout / comercio
Cuenta
Sección
Profundidad N
```

La clasificación se muestra como **heurística**, no como una verdad del CMS.

El dashboard incluye una pestaña **Cobertura** con:

- URLs solicitadas/procesadas/exitosas/fallidas;
- grupos de plantillas;
- porcentaje de cobertura;
- URL representativa por grupo;
- muestras Chromium realmente ejecutadas.

## Rendimiento representativo

No se ejecuta Lighthouse/PageSpeed indiscriminadamente sobre 500 páginas. La URL objetivo conserva las fuentes configuradas del análisis principal y, cuando Chromium está habilitado, V0.14 puede ejecutar una muestra adicional de hasta **3 representantes no-home** para aportar señales de laboratorio como TTFB/LCP/DOM/recursos.

Ese muestreo:

- no sustituye el score principal;
- no inventa una puntuación PageSpeed por plantilla;
- se etiqueta como muestreo representativo.

## Detalle por página bajo demanda

Para evitar un JSON gigante al navegador, el resultado principal de una auditoría grande contiene una versión compacta de las páginas. La ficha completa se recupera cuando el usuario la abre mediante:

```text
GET /api/jobs/page?id=JOB-...&url=https://...
```

Los conteos y agregados se calculan antes de compactar el payload final.

## Endpoints de jobs

```text
POST /api/jobs/start
POST /api/jobs/process
POST /api/jobs/finalize
POST /api/jobs/cancel
GET  /api/jobs/status?id=...
GET  /api/jobs/result?id=...
GET  /api/jobs/page?id=...&url=...

QUEUE PRIVADA
api/queues/large-audit.js  ← trigger queue/v2beta
```

La Function directa:

```text
POST /api/audit
```

rechaza deliberadamente solicitudes de más de 50 páginas con `LARGE_AUDIT_JOB_REQUIRED`; el frontend las deriva al flujo por jobs.

## Funciones ya disponibles

Además de la orquestación autónoma y la nueva capa de plataforma, V0.15 conserva todo el motor construido en las versiones anteriores:

- Rápida / Completa / Personalizada;
- selección real de módulos;
- Móvil / Escritorio;
- SSRF Guard;
- crawler determinístico;
- HTTP/HTTPS;
- SEO técnico y on-page;
- H1–H6;
- contenido determinístico;
- IA editorial opcional y separada del score técnico;
- imágenes y recursos;
- Chromium / raw HTML vs DOM renderizado;
- PageSpeed/Lighthouse cuando la fuente responde;
- Browser Lab medido como fallback diferenciado;
- CrUX/CrUX History cuando existe muestra;
- axe-core;
- WCAG automático + checklist manual;
- UX/CRO heurístico basado en evidencia;
- CSSOM / estilos computados / colores / tipografías / contraste;
- responsive y screenshots;
- seguridad HTTP, cookies, terceros;
- DNS/TLS/SPF/DMARC/DKIM orientativo/MTA-STS/TLS-RPT;
- Perú;
- ISO Web Readiness + Evidence Center;
- motor de remediación y criterio de cierre;
- plan de acción Impacto × Esfuerzo;
- dashboard y PDF corporativo sobre el mismo JSON.

## Variables de entorno

```env
PAGESPEED_API_KEY=
CRUX_API_KEY=
OPENAI_API_KEY=
OPENAI_MODEL=gpt-5.6-luna
CHROME_EXECUTABLE_PATH=
CHROMIUM_PACK_URL=
CYBERGCODE_QUEUE_DISABLED=0
DATABASE_URL=
CYBERGCODE_PLATFORM_KEY=
```

Las claves externas son opcionales. Si una fuente no está configurada o no responde, el informe lo declara y no genera datos sustitutos.

## Desarrollo

```bash
npm install
npm run check
npx vercel dev
```

## Vercel Queues para auditorías grandes

La V0.15 conserva orquestación autónoma para auditorías de 100–500 páginas. Vercel Queues es la ruta principal cuando el deployment dispone del servicio; la cola utiliza entrega durable y reintentos. El consumer está configurado en `vercel.json` como trigger `queue/v2beta` y el frontend solo consulta el estado.

En local o si la cola no está disponible, el mismo motor cae a modo cliente sin inventar progreso ni perder el estado del job.

## Despliegue GitHub → Vercel

1. Mantener `package.json`, `vercel.json`, `api/`, `lib/` y `public/` en la raíz del repositorio.
2. Hacer push a la rama conectada a Vercel.
3. Confirmar **ENGINE 0.15.0** y perfil **CG-STABLE-5**.
4. Probar primero 12–25 páginas.
5. Probar después 100 páginas y verificar el panel de progreso por lotes.
6. Recargar durante un job y confirmar que aparece **Reanudar**.
7. Abrir la pestaña **Cobertura** y comprobar los grupos/representantes.
8. Confirmar que una auditoría >50 páginas usa `/api/jobs/*` y no `/api/audit` directamente.

## Procesamiento autónomo

- En Vercel, las auditorías de más de 50 páginas intentan publicarse en el topic `cybergcode-large-audit` mediante **Vercel Queues**.
- El consumer privado `api/queues/large-audit.js` procesa lotes y consolida el informe sin depender de que el navegador permanezca abierto.
- Si Queues no está disponible o se desactiva con `CYBERGCODE_QUEUE_DISABLED=1`, el frontend conserva automáticamente el modo client-driven anterior.
- El estado temporal del job se mantiene en Runtime Cache durante hasta 12 horas y registra eventos, reintentos y fase de ejecución.
- Los lotes tienen reintentos controlados y la consolidación dispone de su propio contador de recuperación.
- Los grupos de plantillas son heurísticos; Chromium representativo usa una muestra pequeña para controlar coste/tiempo.
- PageSpeed no se ejecuta automáticamente sobre cada plantilla.
- El detalle extremadamente grande de una página puede compactarse para almacenamiento temporal y queda marcado como tal.

## Plataforma persistente V0.15

V0.15 incorpora la primera capa de plataforma persistente sin cambiar el motor de auditoría:

```text
Proyecto por dominio
  ↓
Auditoría completada
  ↓
Snapshot histórico + resumen
  ↓
PostgreSQL / Neon
  ↓
Historial
  ↓
Antes vs Después
```

Nuevos endpoints:

```text
GET  /api/platform-status
GET  /api/projects
POST /api/projects
GET  /api/project?id=...
PATCH /api/project?id=...
GET  /api/history?projectId=...
GET  /api/audit-record?id=...
GET  /api/comparison?before=...&after=...
```

El esquema puede crearse automáticamente en la primera conexión o ejecutarse manualmente desde `migrations/001_platform.sql`.

### Configurar Neon en Vercel

1. Vercel → **Storage / Marketplace** → instalar **Neon**.
2. Conectar el recurso al proyecto de auditoría.
3. Confirmar que Vercel expone `DATABASE_URL`.
4. Hacer redeploy.
5. Entrar en **Proyecto**: el estado debe aparecer como **Conectado**.
6. Ejecutar dos auditorías del mismo dominio y abrir **Historial → Comparar**.

Si `DATABASE_URL` no existe, el scanner continúa funcionando y la interfaz muestra que el histórico persistente está desactivado.

Los endpoints de proyectos e histórico requieren además `CYBERGCODE_PLATFORM_KEY`. Esta capa es una protección administrativa de transición para V0.15 y evita exponer el histórico de forma pública antes de implementar usuarios/roles completos.

### Qué se guarda

Siempre se guarda un snapshot ligero con puntuaciones, severidades, cobertura, SEO, H1–H6, imágenes, contenido y rendimiento disponible. El resultado completo solo se guarda en JSONB cuando su tamaño está por debajo del umbral seguro del motor; esto evita convertir el histórico en un almacén de payloads gigantes.

## Siguiente fase plataforma

Después de V0.15 quedan: usuarios y autenticación, clientes/equipos, almacenamiento persistente de PDF/screenshots/evidencias ISO, auditorías programadas, monitorización/alertas, API pública, white-label, Search Console, Analytics y pruebas de seguridad activas únicamente con autorización.

## Empresa

CYBERGCODE SOLUCIONES TECNOLOGICAS S.A.C.  
RUC 20615849988  
cybergcode.com · Lambayeque, Perú

## Paquete de producción

Esta distribución **v0.15.0 Production** excluye deliberadamente toda la carpeta de pruebas y archivos `*.test.js`. El comando `npm test` también fue retirado del `package.json`. Se conserva `npm run check` porque únicamente valida la sintaxis del código de producción y no incorpora fixtures ni suites de pruebas al despliegue.
