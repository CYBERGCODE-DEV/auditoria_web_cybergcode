# CYBERGCODE Web Audit Intelligence v0.17.0

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

En Vercel, los endpoints de jobs procesan y consolidan la auditoría por lotes. El navegador coordina el avance, muestra el progreso real y debe permanecer abierto hasta finalizar; el estado permite reanudar mientras conserve su vigencia.

## Persistencia temporal del job

El sistema utiliza **Vercel Runtime Cache** para el estado temporal del job. En desarrollo local conserva un fallback de memoria; tanto en Vercel como en local, la ejecución por lotes se coordina desde el cliente.

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

PLATAFORMA ADMINISTRATIVA
api/platform.js  ← proyectos, histórico y comparación en una Function
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
- registro RDAP con creación, actualización, vencimiento y días restantes;
- cadena CNAME, IP RDAP, propietario de red y alojamiento/CDN observable;
- tecnologías detectadas con confianza y evidencia pública;
- composición frontend por bytes observables de HTML, CSS, JavaScript, JSON y WebAssembly;
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
CYBERGCODE_AUDIT_KEY=
CYBERGCODE_RATE_LIMIT=30
CYBERGCODE_JOB_RATE_LIMIT=180
CYBERGCODE_REPORT_SECRET=
CYBERGCODE_ALLOW_ANONYMOUS_AUDITS=0
CYBERGCODE_ALLOW_ANONYMOUS_PERSISTENCE=0

# Persistencia SQL
DB_PROVIDER=mysql
DATABASE_URL=mysql://usuario:password@host:3306/cybergcode_auditoria
MYSQL_URL=
MARIADB_URL=
POSTGRES_URL=
DB_SSL=0
DB_SSL_REJECT_UNAUTHORIZED=1
DB_POOL_LIMIT=4
DB_CONNECT_TIMEOUT_MS=10000
CYBERGCODE_PLATFORM_KEY=
```

`DB_PROVIDER` admite `mysql`, `mariadb`, `tidb`, `planetscale`, `postgres` y `neon`. Si no se define, el motor intenta inferir el dialecto por la URL. Las claves externas son opcionales; si una fuente no responde, el informe no crea datos sustitutos.

En producción, `CYBERGCODE_AUDIT_KEY` es obligatoria, debe tener al menos 32 caracteres y protege el scanner; solo se permite omitirla si se acepta explícitamente el riesgo mediante `CYBERGCODE_ALLOW_ANONYMOUS_AUDITS=1`. `CYBERGCODE_REPORT_SECRET` es obligatorio para exportar PDFs firmados y debe ser largo, aleatorio y diferente de las demás claves. La persistencia anónima está desactivada salvo que se establezca explícitamente `CYBERGCODE_ALLOW_ANONYMOUS_PERSISTENCE=1`.

Límites operativos verificables: cuando existe una base SQL, el rate limiting y los locks de jobs usan tablas compartidas y actualizaciones atómicas; sin base de datos se declara y utiliza un fallback por instancia. Chromium navega mediante un proxy local que valida DNS y fija una IP pública para cada conexión HTTP/HTTPS, además de la validación por solicitud.

## Desarrollo

```bash
npm install
npm run check
npx vercel dev
```

## Auditorías grandes compatibles con Vercel

Las auditorías de 100–500 páginas usan `/api/jobs/*` por lotes y almacenan su progreso temporal. No existe un trigger experimental en `vercel.json`, lo que mantiene el deployment compatible con el flujo normal de Vercel Functions.

El navegador debe permanecer abierto durante el procesamiento. Si se interrumpe, la interfaz puede reanudar un job vigente sin inventar progreso ni perder los lotes ya guardados.

## Despliegue GitHub → Vercel

1. Mantener `package.json`, `vercel.json`, `api/`, `lib/` y `public/` en la raíz del repositorio.
2. Hacer push a la rama conectada a Vercel.
3. Confirmar **ENGINE 0.17.0** y perfil **CG-STABLE-6**.
4. Probar primero 12–25 páginas.
5. Probar después 100 páginas y verificar el panel de progreso por lotes.
6. Recargar durante un job y confirmar que aparece **Reanudar**.
7. Abrir la pestaña **Cobertura** y comprobar los grupos/representantes.
8. Confirmar que una auditoría >50 páginas usa `/api/jobs/*` y no `/api/audit` directamente.

## Procesamiento por lotes

- En Vercel, las auditorías de más de 50 páginas se procesan mediante `/api/jobs/*`.
- El frontend solicita cada lote, consulta el estado real y ordena la consolidación; el navegador debe permanecer abierto.
- La orquestación no crea Functions adicionales ni depende de triggers experimentales.
- El estado temporal del job se mantiene en Runtime Cache durante hasta 12 horas y registra eventos, reintentos y fase de ejecución.
- Los lotes tienen reintentos controlados y la consolidación dispone de su propio contador de recuperación.
- Los grupos de plantillas son heurísticos; Chromium representativo usa una muestra pequeña para controlar coste/tiempo.
- PageSpeed no se ejecuta automáticamente sobre cada plantilla.
- El detalle extremadamente grande de una página puede compactarse para almacenamiento temporal y queda marcado como tal.

## Plataforma persistente — MySQL/MariaDB + PostgreSQL

La persistencia ahora usa una capa de adaptadores SQL. El motor de auditoría no depende del proveedor:

```text
Proyecto por dominio
  ↓
Auditoría completada
  ↓
Snapshot + resumen
  ↓
DATABASE ADAPTER
  ├─ MySQL / MariaDB / TiDB
  └─ PostgreSQL / Neon
  ↓
Historial + Antes vs Después
```

### MySQL o MariaDB

Configuración mínima en Vercel:

```env
DB_PROVIDER=mysql
DATABASE_URL=mysql://usuario:password@host:3306/cybergcode_auditoria
CYBERGCODE_PLATFORM_KEY=una-clave-administrativa-larga
```

Para MariaDB puedes usar `DB_PROVIDER=mariadb` y URL `mariadb://...`; internamente la conexión se normaliza al protocolo MySQL compatible. El pool serverless utiliza pocas conexiones (`DB_POOL_LIMIT=4` por defecto).

La migración manual está en:

```text
migrations/mysql/001_platform.sql
```

El runtime también ejecuta `CREATE TABLE IF NOT EXISTS`, por lo que la migración manual es opcional. Los JSON históricos se guardan como `LONGTEXT` para mantener compatibilidad amplia entre MySQL y MariaDB y se parsean al leerlos.

### TiDB Cloud

```env
DB_PROVIDER=tidb
DATABASE_URL=mysql://usuario:password@host:4000/cybergcode_auditoria
```

Se utiliza el mismo adaptador MySQL. El runtime activa TLS automáticamente para hosts `tidbcloud.com`.

### PostgreSQL / Neon

Sigue totalmente soportado:

```env
DB_PROVIDER=neon
DATABASE_URL=postgresql://usuario:password@host/base?sslmode=require
```

Migración opcional:

```text
migrations/postgres/001_platform.sql
```

### Endpoints de plataforma

```text
GET  /api/platform?resource=status
GET  /api/platform?resource=projects
POST /api/platform?resource=projects
GET  /api/platform?resource=project&id=...
PATCH /api/platform?resource=project&id=...
GET  /api/platform?resource=history&projectId=...
GET  /api/platform?resource=audit-record&id=...
GET  /api/platform?resource=comparison&before=...&after=...
```

Los endpoints administrativos requieren `CYBERGCODE_PLATFORM_KEY`. La clave se escribe en la interfaz y permanece solo en `sessionStorage`; `DATABASE_URL` nunca se expone al navegador.

Si ninguna base está configurada, el scanner continúa funcionando con todos sus módulos y únicamente desactiva Proyectos/Historial/Comparativas.

### Qué se guarda

Siempre se conserva un snapshot ligero con puntuaciones, severidades, cobertura, SEO, H1–H6, imágenes, contenido y rendimiento disponible. El resultado completo solo se almacena cuando queda por debajo del umbral seguro definido por el motor.

## Siguiente fase plataforma

Después de V0.15 quedan: usuarios y autenticación, clientes/equipos, almacenamiento persistente de PDF/screenshots/evidencias ISO, auditorías programadas, monitorización/alertas, API pública, white-label, Search Console, Analytics y pruebas de seguridad activas únicamente con autorización.

## Empresa

CYBERGCODE SOLUCIONES TECNOLOGICAS S.A.C.  
RUC 20615849988  
cybergcode.com · Lambayeque, Perú

## Validación del paquete

El repositorio incluye pruebas unitarias, de integración y E2E; `.vercelignore` evita incorporarlas al runtime de producción. Ejecuta `npm run check` y `npm test`. GitHub Actions repite ambas validaciones y `npm audit` en cada push y pull request.
