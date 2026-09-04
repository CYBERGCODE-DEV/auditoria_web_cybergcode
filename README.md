# CYBERGCODE Web Audit Intelligence v0.6.0

Auditoría web integral orientada a despliegue **GitHub -> Vercel**, desarrollada con HTML, CSS, JavaScript y Node.js/Vercel Functions.

**Empresa:** CYBERGCODE SOLUCIONES TECNOLOGICAS S.A.C.  
**RUC:** 20615849988  
**Dominio:** cybergcode.com

## Qué cambia en V0.6

V0.6 refuerza dos áreas: **experiencia visual del dashboard** y **reproducibilidad de resultados entre dispositivos**.

### Dashboard por menús interactivos

La auditoría se separa en ocho vistas:

```text
Resumen
Rendimiento
Diseño
Infraestructura
Perú
ISO
Observaciones
Páginas
```

El cambio de menú utiliza transiciones accesibles, mantiene una sola sección visible y evita una página interminable. Las tarjetas, filas, hallazgos y secciones tienen animaciones escalonadas; `prefers-reduced-motion` desactiva el movimiento para usuarios que lo solicitan.

### Puntuación animada y visual

La puntuación global utiliza un anillo dinámico, contador progresivo y color por nivel. Las categorías incluyen barras animadas. No se modifica la metodología de scoring por motivos puramente visuales.

### Tipografía y layout accesibles

La base usa `1rem` (equivalente normal a 16 px), unidades escalables, `line-height: 1.6`, controles con tipografía heredada, foco visible y layouts flexibles. El footer usa `body` flex + `main { flex: 1 }` + `footer { margin-top: auto }`, por lo que permanece al final del viewport cuando el contenido es corto.

### Modo estable entre dispositivos

La diferencia entre dos auditorías puede deberse a condiciones variables de Lighthouse/PageSpeed, A/B tests, publicidad, recursos dinámicos, red y estado del servidor. V0.6 añade un modo estable activado por defecto:

- perfil de Chromium fijo `CG-STABLE-1`;
- `Accept-Language: es-PE`;
- zona horaria `America/Lima`;
- viewports fijos desktop 1366×768 y móvil 390×844;
- caché del navegador desactivada;
- `prefers-reduced-motion: reduce` en el navegador de auditoría;
- crawler con orden lexicográfico determinista de URLs;
- tres muestras PageSpeed por estrategia y **mediana**;
- variabilidad de Performance/LCP visible en el dashboard;
- Vercel Function fijada a `iad1`;
- Vercel Runtime Cache durante 30 minutos;
- huella de auditoría para comparar ejecuciones.

Con el mismo dominio y la misma configuración, una auditoría cacheada conserva el mismo ID y la misma base de resultados entre dispositivos durante la ventana estable. El usuario puede desactivar `Modo estable` para solicitar una medición completamente en vivo.

### Runtime Cache de Vercel

V0.6 usa `@vercel/functions` y `getCache()` cuando se ejecuta en Vercel. El JSON se comprime con gzip antes de guardarse para respetar el límite por item del Runtime Cache. En desarrollo local se utiliza un fallback en memoria.

## Cambios heredados de V0.5

V0.5 añade una capa de **infraestructura y cumplimiento operativo**: DNS/TLS, seguridad de correo, cookies/trackers, Cumplimiento y Confianza Digital — Perú e ISO Evidence Center.

### Infraestructura: DNS, TLS y correo

La auditoría incorpora:

- A y AAAA;
- nameservers (NS);
- MX;
- CAA;
- DNSSEC mediante validación DoH/DNSSEC y señal `AD` cuando la consulta está disponible;
- certificado TLS, cadena observable, protocolo, cipher, vigencia y errores de validación;
- SPF;
- DMARC;
- búsqueda DKIM por selectores comunes, sin afirmar ausencia cuando el selector real es desconocido;
- MTA-STS;
- TLS-RPT.

Cada observación dispone de remediación y criterio de cierre. DKIM se presenta como **requiere selector/evidencia** cuando no puede verificarse de forma concluyente.

### Cookies y terceros

Chromium registra las cookies y hosts cargados en la visita inicial. Se revisan especialmente cookies con nombres compatibles con sesión/autenticación y atributos `Secure`, `HttpOnly` y `SameSite`. También se identifican plataformas conocidas de analítica/marketing cargadas durante la visita.

La presencia de un tracker se trata como una señal para revisión de privacidad/consentimiento; no se presenta automáticamente como infracción.

### Cumplimiento y Confianza Digital — Perú

V0.5 añade reglas orientativas y versionadas para señales visibles relacionadas con:

- Ley N.° 29733 y D.S. N.° 016-2024-JUS (protección de datos personales);
- Ley N.° 29571, Ley N.° 32495 y D.Leg. N.° 1729 (protección al consumidor y comercio electrónico);
- política/aviso de privacidad;
- formularios y campos potencialmente PII;
- Libro de Reclamaciones en sitios con señales de comercio electrónico;
- trackers/cookies;
- controles opcionales preseleccionados y revisión de posibles patrones coercitivos.

**No constituye asesoría jurídica ni declaración automática de infracción.** La aplicabilidad y vigencia reglamentaria deben confirmarse con revisión jurídica.

### ISO Evidence Center

Los controles ISO que requieren documentación interna se convierten en una lista de evidencias pendientes. El dashboard permite marcar localmente que una evidencia está disponible y ese estado se incorpora al PDF.

Marcar `Disponible` **no significa que la evidencia haya sido validada**. Una futura fase incorporará carga de archivos, revisión, responsable, fecha, versión y aprobación.



### ISO Web Readiness

El módulo **ISO Web Readiness**, introducido en V0.4 y ampliado en V0.5, evalúa **alineamiento ISO observable**. No presenta el resultado como certificación ISO. Separa cuatro estados:

```text
Cumple observablemente
Observación / requiere acción
Requiere evidencia interna
No aplica
```

El catálogo inicial incluye:

- ISO/IEC 40500:2025 (WCAG 2.2);
- ISO/IEC 29184:2020 (avisos de privacidad y consentimiento online);
- ISO/IEC 27701:2025 (gestión de privacidad);
- ISO/IEC 27001:2022 + ISO/IEC 27002:2022 (seguridad de la información);
- ISO/IEC 27034-1:2011 (seguridad de aplicaciones);
- ISO/IEC 25010:2023 + ISO/IEC 25023:2016 (calidad de software);
- ISO 9241-11:2018 e ISO 9241-210:2019 (usabilidad y diseño centrado en personas);
- ISO/IEC 29147:2018 + ISO/IEC 30111:2019 (divulgación y tratamiento de vulnerabilidades);
- ISO/IEC 27017:2026 e ISO/IEC 27018:2025 (cloud y PII);
- ISO/IEC 27035-1/2:2023 (gestión de incidentes);
- ISO 22301:2019 (continuidad);
- ISO/IEC 20000-1:2018 (gestión de servicios TI).

Cada control ISO muestra evidencia, recomendación, **acción para levantar la observación** y criterio de cierre. Los requisitos organizativos se marcan como evidencia interna necesaria.

La plataforma también detecta señales de privacidad en formularios y prueba `/.well-known/security.txt` como evidencia útil de un canal de divulgación de vulnerabilidades.

### Tema claro y oscuro

La interfaz incorpora:

- tema oscuro;
- tema claro;
- detección inicial de `prefers-color-scheme`;
- selector manual en el encabezado;
- persistencia en `localStorage`;
- actualización de `theme-color` del navegador;
- animaciones y transiciones respetando `prefers-reduced-motion`.

### Motor de remediación

Cada hallazgo puede incluir ahora:

```text
Evidencia
Resultado esperado
Impacto
Qué recomendamos hacer
Solución para levantar la observación
Pasos recomendados
Criterio de cierre / observación levantada
Ejemplo técnico o código
Esfuerzo estimado
Confianza
Fuente
```

Las soluciones comunes están centralizadas en:

```text
lib/config/remediations.js
```

Esto permite modificar la metodología CYBERGCODE sin dispersar textos de remediación por todo el crawler.

### axe-core

Se integra `axe-core 4.13.0` dentro del Chromium de auditoría para ampliar comprobaciones automatizables de accesibilidad.

La salida registra:

- reglas con violaciones;
- nodos afectados;
- casos `incomplete` que necesitan revisión adicional;
- reglas superadas;
- severidad;
- selector de muestra;
- evidencia/failure summary;
- referencia de axe-core;
- solución y criterio de cierre.

**Importante:** axe-core y Lighthouse no equivalen a una certificación WCAG completa. El sistema distingue comprobación automática de revisión manual.

## Medido actualmente

- URL Guard / protección SSRF inicial.
- Validación DNS y bloqueo de IP privadas/reservadas.
- Revalidación de redirecciones en el crawler HTTP.
- Crawler interno, robots.txt y sitemap.
- HTTP/HTTPS, redirects y cabeceras.
- SEO: title, description, canonical, robots, lang.
- H1-H6 y saltos de jerarquía.
- JSON-LD básico.
- Imágenes: alt, dimensiones, loading, srcset y HEAD limitado.
- Seguridad pasiva: HTTPS, HSTS, CSP, nosniff, Referrer-Policy, Permissions-Policy, disclosure y mixed content.
- **Chromium/Puppeteer en Vercel** mediante `puppeteer-core` + `@sparticuz/chromium-min`.
- Comparación **Raw HTML vs Rendered DOM**.
- Errores JavaScript en renderizado.
- Paleta y tipografías obtenidas desde estilos computados.
- Contraste automático orientativo WCAG AA.
- Responsive móvil: overflow horizontal y targets pequeños.
- Screenshots desktop y mobile comprimidos.
- **axe-core** para accesibilidad automática adicional.
- **PageSpeed Insights / Lighthouse** móvil y desktop, con mediana de 3 muestras en modo estable.
- LCP, CLS, TBT, FCP y puntuaciones de Performance, Accessibility, Best Practices y SEO de Lighthouse.
- Dashboard por menús interactivos, animaciones accesibles, puntuación animada y remediación expandible.
- PDF corporativo CYBERGCODE con solución y criterio de cierre por hallazgo.
- DNS/TLS, SPF, DMARC, DKIM orientativo, DNSSEC, CAA, MTA-STS y TLS-RPT.
- Cookies de Chromium y terceros/trackers de la visita inicial.
- Cumplimiento y Confianza Digital — Perú.
- ISO Evidence Center con estado local de evidencia disponible.
- Modo estable, huella de auditoría y Runtime Cache compartida en Vercel.

## Pendiente / siguientes fases

- Screenshots y análisis Chromium por múltiples páginas/plantillas.
- CrUX API separada de PageSpeed.
- Análisis avanzado de CSS/spacing/components.
- Estados visuales hover/focus/disabled más profundos.
- Contenido, ortografía e IA.
- UX/CRO.
- Carga real, revisión y almacenamiento de evidencias ISO/legales en base de datos.
- Rate limiting persistente, cuentas, base de datos y almacenamiento de informes/screenshots.
- Histórico, usuarios, proyectos y auditorías programadas.
- Auditoría de seguridad activa exclusivamente con autorización.

## Compatibilidad con Vercel

El proyecto evita empaquetar Chromium completo dentro de la Function.

Durante `npm install`, el script `postinstall` crea:

```text
public/chromium-pack.tar
```

usando `@sparticuz/chromium`. En runtime, la Function carga `@sparticuz/chromium-min` y descarga el pack desde el propio deployment de Vercel.

Versiones fijadas deliberadamente:

```text
puppeteer-core           25.1.0
@sparticuz/chromium      149.0.0
@sparticuz/chromium-min  149.0.0
axe-core                 4.13.0
@vercel/functions        3.9.5
```

## Despliegue GitHub -> Vercel

1. Descomprime el proyecto.
2. Crea un repositorio privado o público en GitHub.
3. Sube todo el proyecto.
4. En Vercel: **Add New -> Project -> Import Git Repository**.
5. Framework Preset: **Other**.
6. No hace falta Build Command especial; `npm install` ejecutará `postinstall`.
7. Activa Fluid Compute en el proyecto si no estuviera activo.
8. Despliega.

El archivo `vercel.json` ya define hasta 300 segundos para `/api/audit.js` y fija la región de ejecución en `iad1` para reducir variación regional.

## Validación actual

```text
20 / 20 tests passed
npm run check passed
```

## Variables de entorno

Copia `.env.example` cuando trabajes localmente.

### `PAGESPEED_API_KEY`

Opcional, pero recomendado para uso frecuente y automatizado de PageSpeed Insights.

### `CHROME_EXECUTABLE_PATH`

Solo desarrollo local cuando Chrome/Chromium no está en una ruta estándar.

```env
CHROME_EXECUTABLE_PATH=/usr/bin/google-chrome
```

### `CHROMIUM_PACK_URL`

Opcional en Vercel. Normalmente no hace falta: el runtime intenta usar el pack del deployment actual y como fallback el deployment de producción.

## Desarrollo local

```bash
npm install
npm run dev
```

Para validar sintaxis y pruebas:

```bash
npm run check
npm test
```

## Flujo de auditoría V0.4

```text
URL
 ↓
URL Guard / DNS / SSRF
 ↓
Crawler HTTP + robots + sitemap
 ↓
SEO / headings / imágenes / seguridad
 ↓
┌──────────────────────┬────────────────────────┐
│ Chromium             │ PageSpeed Insights     │
│ Rendered DOM         │ Lighthouse mobile      │
│ Visual / responsive  │ Lighthouse desktop     │
│ axe-core             │ Core lab metrics       │
└──────────┬───────────┴───────────┬────────────┘
           ↓                       ↓
        Hallazgos estructurados JSON
                    ↓
          Motor de remediación
                    ↓
                 Scoring
              ┌─────┴─────┐
              ↓           ↓
         Dashboard        PDF
                    ↓
         ISO Web Readiness
```

## Modelo de hallazgo V0.5

Ejemplo simplificado:

```json
{
  "ruleId": "SEC-CSP-001",
  "severity": "high",
  "title": "Content-Security-Policy no detectada",
  "evidence": "Cabecera content-security-policy ausente.",
  "impact": "Falta una capa de endurecimiento HTTP recomendada.",
  "recommendation": "Implementar una CSP basada en los recursos reales.",
  "solution": "La respuesta debe incluir una CSP que restrinja orígenes sin romper funciones legítimas.",
  "remediationSteps": ["Inventariar orígenes", "Probar Report-Only", "Activar CSP"],
  "acceptanceCriteria": "La cabecera CSP está presente, probada y no rompe funcionalidades.",
  "codeExample": "Content-Security-Policy: default-src 'self'; ...",
  "effort": "Media/Alta"
}
```

## Scoring

La puntuación global solo utiliza módulos realmente medidos. Los módulos todavía no implementados permanecen en `null` y no afectan el resultado.

En V0.4 una puntuación externa como Lighthouse actúa como **techo**, no como reemplazo absoluto. Ejemplo: si Lighthouse Accessibility devuelve 99 pero las reglas propias/axe-core generan deducciones objetivas hasta 92, la categoría conserva 92.

Esto evita que una puntuación agregada oculte observaciones comprobadas por el motor CYBERGCODE.

La puntuación automática de accesibilidad **no es una certificación WCAG**. El score de `compliance` representa únicamente **alineamiento ISO observable** y tampoco equivale a certificación o declaración formal de conformidad.

## PDF

`/api/report.js` genera un PDF corporativo con `pdf-lib` y consume los mismos hallazgos que el dashboard. Para cada observación prioritaria incluye:

- evidencia;
- impacto;
- resultado esperado;
- recomendación;
- solución para levantar la observación;
- pasos recomendados;
- criterio de cierre;
- ejemplo técnico cuando exista;
- esfuerzo, confianza y fuente.

## Límites deliberados de V0.5

- Chromium visualiza solo la URL principal; el crawler HTTP puede revisar hasta 50 URLs.
- axe-core se ejecuta actualmente sobre la URL principal renderizada.
- PageSpeed se ejecuta para la URL principal en móvil y desktop.
- Las capturas son del viewport, no full-page, para controlar el payload.
- Si una auditoría produce más de **300 hallazgos**, el score y los conteos se calculan con todos, pero el dashboard recibe los 300 de mayor prioridad para controlar el tamaño de respuesta en Vercel.
- El análisis de contraste propio es automatizado y no cubre todos los fondos complejos, gradientes, imágenes o estados interactivos.
- Los resultados `incomplete` de axe-core deben considerarse candidatos a revisión humana.
- PageSpeed puede aplicar cuotas o fallar temporalmente; el resto de la auditoría continúa.

## Seguridad del propio auditor

`lib/security/url-guard.js` bloquea localhost, rangos privados/reservados, metadata cloud y protocolos no HTTP/HTTPS. Chromium utiliza además un request guard para los destinos solicitados por la página auditada.

Antes de convertir el servicio en un scanner público de alto volumen siguen siendo recomendables rate limiting persistente, cuotas por cuenta y aislamiento adicional.

## Estructura relevante

```text
api/
  audit.js
  report.js
lib/
  audit/
    finding.js
    scoring.js
  browser/
    browser.js
    browser-audit.js
  config/
    rules.js
    remediations.js
  performance/
    pagespeed.js
  compliance/
    iso.js
    peru.js
  infrastructure/
    domain-audit.js
  security/
    url-guard.js
    safe-fetch.js
  report/
    pdf.js
scripts/
  build-chromium-pack.js
public/
  index.html
  css/app.css
  js/theme.js
  js/app.js
```
