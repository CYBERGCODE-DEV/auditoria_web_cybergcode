# CYBERGCODE Web Audit Intelligence v0.12.0

Plataforma de auditoría web integral preparada para **GitHub → Vercel**, con frontend HTML/CSS/JavaScript y backend Node.js/Vercel Functions.

## Principio de integridad

**Datos medidos, no simulaciones.** Un módulo no ejecutado, una fuente externa sin respuesta o una comprobación manual pendiente no reciben una puntuación inventada. Las heurísticas de UX/CRO, agrupación de plantillas, cobertura CSS e IA se identifican expresamente como tales.

## Novedad principal V0.11: auditorías grandes de 100–500 páginas

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

El navegador del usuario avanza el job llamando a un lote por petición. El estado queda temporalmente almacenado y puede **reanudarse tras recargar la página** durante su TTL. Esto evita presentar el sistema como una cola autónoma cuando todavía no existe un worker/Workflow independiente.

## Persistencia temporal del job

La V0.11 utiliza **Vercel Runtime Cache** cuando se ejecuta en Vercel y un fallback de memoria únicamente para desarrollo/pruebas locales.

- TTL del job: **2 horas**.
- Estado, lotes y resultado se almacenan por claves independientes.
- Los lotes se comprimen con gzip/base64.
- Un chunk demasiado grande se divide automáticamente en varias partes para mantenerse por debajo de un margen seguro respecto al límite de tamaño por entrada del Runtime Cache.
- Si una única página produce un detalle extraordinariamente grande, el almacenamiento temporal limita arrays muy extensos y lo declara mediante `jobStorage.truncated=true`; no se inventan datos faltantes.
- La V0.11 no sustituye una base de datos/cola durable para ejecuciones de larga vida. Eso queda para la fase plataforma.

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

No se ejecuta Lighthouse/PageSpeed indiscriminadamente sobre 500 páginas. La URL objetivo conserva las fuentes configuradas del análisis principal y, cuando Chromium está habilitado, V0.11 puede ejecutar una muestra adicional de hasta **3 representantes no-home** para aportar señales de laboratorio como TTFB/LCP/DOM/recursos.

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
```

La Function directa:

```text
POST /api/audit
```

rechaza deliberadamente solicitudes de más de 50 páginas con `LARGE_AUDIT_JOB_REQUIRED`; el frontend las deriva al flujo por jobs.

## Funciones ya disponibles

Además del crawler grande, V0.11 conserva lo construido hasta V0.10:

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
```

Las claves externas son opcionales. Si una fuente no está configurada o no responde, el informe lo declara y no genera datos sustitutos.

## Desarrollo

```bash
npm install
npm test
npm run check
npx vercel dev
```

## Despliegue GitHub → Vercel

1. Mantener `package.json`, `vercel.json`, `api/`, `lib/` y `public/` en la raíz del repositorio.
2. Hacer push a la rama conectada a Vercel.
3. Confirmar **ENGINE 0.12.0** y perfil **CG-STABLE-3**.
4. Probar primero 12–25 páginas.
5. Probar después 100 páginas y verificar el panel de progreso por lotes.
6. Recargar durante un job y confirmar que aparece **Reanudar**.
7. Abrir la pestaña **Cobertura** y comprobar los grupos/representantes.
8. Confirmar que una auditoría >50 páginas usa `/api/jobs/*` y no `/api/audit` directamente.

## Límites deliberados de V0.11

- La persistencia de jobs es temporal, no una base de datos histórica.
- El procesamiento avanza mientras un cliente reanuda/impulsa los lotes; todavía no es una cola autónoma en background.
- Los grupos de plantillas son heurísticos.
- Chromium representativo usa una muestra pequeña para controlar coste/tiempo.
- PageSpeed no se ejecuta automáticamente sobre cada plantilla.
- El detalle extremadamente grande de una página puede compactarse para almacenamiento temporal y queda marcado como tal.

## Próximo paso para V1.0

La base del plan inicial queda prácticamente cerrada. Antes de declarar V1.0 conviene realizar:

- validación end-to-end real en el deployment Vercel con una auditoría de 100/250/500 páginas;
- reintentos/cancelación/errores de jobs validados con tráfico real;
- pulido final del PDF y cobertura multi-plantilla;
- decisión de si V1.0 mantendrá el job client-driven o utilizará Vercel Workflows/Queues para ejecución autónoma.

## Fase plataforma posterior

Usuarios, clientes, proyectos, PostgreSQL, histórico, comparación antes/después, auditorías programadas, monitorización/alertas, almacenamiento permanente de evidencias ISO, API pública, white-label, Search Console, Analytics y pruebas de seguridad activas únicamente con autorización.

## Empresa

CYBERGCODE SOLUCIONES TECNOLOGICAS S.A.C.  
RUC 20615849988  
cybergcode.com · Lambayeque, Perú
