# CYBERGCODE Web Audit Intelligence v0.21.0

Plataforma de auditoría web integral preparada para **GitHub → Vercel**, con frontend HTML/CSS/JavaScript y backend Node.js/Vercel Functions.

## Acceso público y privado

V0.18 separa dos experiencias:

- **Demostración pública:** analiza una sola página, no usa PageSpeed, no persiste resultados y entrega únicamente un resumen y tres prioridades reales. Los módulos bloqueados no se ejecutan ni se sustituyen con datos inventados.
- **Plataforma privada:** requiere una cuenta creada por un administrador. Los roles `admin` y `analyst` pueden auditar; `reader` queda limitado a consultas. Los proyectos, auditorías, jobs y PDF se aíslan por organización.

La autenticación usa Supabase Auth en el servidor. Los tokens se guardan en cookies `HttpOnly`, no en `localStorage` ni en campos visibles. Cuando Supabase está configurado, la antigua `CYBERGCODE_AUDIT_KEY` deja de intervenir en el navegador.

### Alta inicial del administrador

1. Crear un proyecto en Supabase y desactivar el registro público si solo habrá cuentas invitadas.
2. En **Authentication → Users**, crear o invitar el primer usuario.
3. En Vercel, abrir **Environment Variables** y configurar `SUPABASE_URL`, `SUPABASE_ANON_KEY` y `SUPABASE_SERVICE_ROLE_KEY` para Production y Preview.
4. Añadir el correo exacto del primer usuario en `CYBERGCODE_ADMIN_EMAILS`. Se admiten varios separados por coma.
5. Configurar en Supabase la URL del deployment como Site URL y `https://tu-dominio/?activate=1` como Redirect URL.
6. Redesplegar. El administrador ya podrá abrir **Usuarios**, asignar una organización existente o dejarla vacía para crear un espacio aislado.

Nunca se debe colocar `SUPABASE_SERVICE_ROLE_KEY` en `public/`, GitHub, `VITE_*` o `NEXT_PUBLIC_*`.

### Rutas de la plataforma

- `/`: sitio público y demostración limitada.
- `/app`: aplicación privada de auditorías, proyectos, histórico, comparación e informes.
- `/account`: perfil, estado de la suscripción, cuota y seguridad del usuario.
- `/admin`: usuarios, organizaciones, roles, concesiones manuales, límites, suspensiones y trazabilidad.

La consola administrativa puede asignar planes manuales y periodos, pero no declara pagos aprobados. El método de pago, cancelación automática, comprobantes y eventos financieros permanecen bloqueados hasta conectar una pasarela y Nubefact.

## Principio de integridad

**Datos medidos, no simulaciones.** Un módulo no ejecutado, una fuente externa sin respuesta o una comprobación manual pendiente no reciben una puntuación inventada. Las heurísticas de UX/CRO, agrupación de plantillas, cobertura CSS e IA se identifican expresamente como tales.

## Novedad principal V0.14: auditorías grandes autónomas de 100–500 páginas

Todas las auditorías privadas usan un **job temporal con progreso verificable**. La interfaz informa URLs procesadas, fase del servidor, fallos y consolidación a partir del estado devuelto por la API; no avanza módulos mediante temporizadores simulados.

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

# Inicio de sesión privado
SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
CYBERGCODE_ADMIN_EMAILS=administrador@empresa.com
CYBERGCODE_DEMO_RATE_LIMIT=5
CYBERGCODE_DEMO_SECRET=
CYBERGCODE_ENFORCE_SUBSCRIPTIONS=1

# Fallback legado: solo se usa si Supabase no está configurado
CYBERGCODE_AUDIT_KEY=
CYBERGCODE_RATE_LIMIT=30
CYBERGCODE_JOB_RATE_LIMIT=180
CYBERGCODE_REPORT_SECRET=
CYBERGCODE_ALLOW_ANONYMOUS_AUDITS=0
CYBERGCODE_ALLOW_ANONYMOUS_PERSISTENCE=0

# Persistencia SQL (Supabase recomendado si ya utilizas Supabase Auth)
DB_PROVIDER=postgres
SUPABASE_DB_URL=postgresql://usuario.proyecto:password@host-pooler:6543/postgres?sslmode=require
DATABASE_URL=
MYSQL_URL=
MARIADB_URL=
POSTGRES_URL=
DB_SSL=1
DB_SSL_REJECT_UNAUTHORIZED=1
DB_POOL_LIMIT=4
DB_CONNECT_TIMEOUT_MS=10000
CYBERGCODE_PLATFORM_KEY=
```

`DB_PROVIDER` admite `mysql`, `mariadb`, `tidb`, `planetscale`, `postgres` y `neon`. Si no se define, el motor intenta inferir el dialecto por la URL. Las claves externas son opcionales; si una fuente no responde, el informe no crea datos sustitutos.

Con Supabase configurado, las sesiones y roles protegen el scanner y la plataforma; `CYBERGCODE_AUDIT_KEY` y `CYBERGCODE_PLATFORM_KEY` permanecen únicamente como compatibilidad local/legada. Sin Supabase, en producción `CYBERGCODE_AUDIT_KEY` vuelve a ser obligatoria y debe tener al menos 32 caracteres. `CYBERGCODE_REPORT_SECRET` siempre es obligatorio para exportar PDF firmados y debe ser largo, aleatorio y diferente de las demás claves. La persistencia anónima permanece desactivada.

Para guardar proyectos, históricos y trazabilidad administrativa todavía se necesita una base SQL compatible. En una instalación existente se debe aplicar `002_multiuser.sql` y luego `003_admin_events.sql` del proveedor correspondiente. La autenticación funciona sin SQL, pero el histórico y el registro administrativo se mostrarán como no disponibles; no se inventará persistencia.

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
3. Confirmar **ENGINE 0.21.0** y perfil **CG-STABLE-6**.
4. Probar primero 12–25 páginas.
5. Probar después 100 páginas y verificar el panel de progreso por lotes.
6. Recargar durante un job y confirmar que aparece **Reanudar**.
7. Abrir la pestaña **Cobertura** y comprobar los grupos/representantes.
8. Confirmar que la interfaz privada usa `/api/jobs/*` y muestra el conteo real de URLs procesadas.

## Procesamiento por lotes

- En Vercel, las auditorías privadas se procesan mediante `/api/jobs/*`; el flujo directo se conserva como API compatible hasta 50 páginas.
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
  └─ PostgreSQL / Supabase / Neon
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

### PostgreSQL / Supabase / Neon

Para Supabase utiliza la URI del **Transaction pooler**, no `SUPABASE_URL` ni la clave publishable:

```env
DB_PROVIDER=postgres
SUPABASE_DB_URL=postgresql://usuario.proyecto:password@host-pooler:6543/postgres?sslmode=require
DB_SSL=1
```

`SUPABASE_URL`, `SUPABASE_ANON_KEY` y `SUPABASE_SERVICE_ROLE_KEY` sirven para autenticación y administración de usuarios. No abren una conexión SQL y no sustituyen `SUPABASE_DB_URL`.

PostgreSQL y Neon también siguen soportados:

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
