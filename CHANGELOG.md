# Changelog

## 0.6.0 - 2026-09-04

- Rediseña el dashboard con **8 menús interactivos**: Resumen, Rendimiento, Diseño, Infraestructura, Perú, ISO, Observaciones y Páginas.
- Añade animaciones de entrada por sección, tarjetas, estadísticas, filas y observaciones, respetando `prefers-reduced-motion`.
- Sustituye la puntuación plana por un **anillo animado**, contador progresivo, color por nivel y barras por categoría.
- Mejora la paleta de los temas claro/oscuro con acentos cyan, verde y violeta manteniendo contraste legible.
- Normaliza la tipografía a unidades `rem`, base 16 px equivalente, `line-height: 1.6`, controles heredados y foco visible.
- Corrige el footer mediante layout flex para que permanezca al fondo del viewport cuando el contenido es corto.
- Añade **Modo estable** activado por defecto.
- Chromium usa perfil fijo `CG-STABLE-1`, locale `es-PE`, zona `America/Lima`, UA fijo, cache desactivada y reduced motion.
- El crawler ordena URLs de sitemap y enlaces internos para reducir diferencias por orden de descubrimiento.
- PageSpeed ejecuta hasta **3 muestras mobile + 3 desktop** y usa la mediana para categorías y métricas.
- El dashboard muestra número de muestras y rango de variación de Performance/LCP.
- Añade Vercel Runtime Cache con compresión gzip durante 30 minutos para reutilizar exactamente la misma auditoría entre dispositivos.
- Añade huella estable de auditoría y cabeceras `X-CYBERGCODE-Cache` / `X-CYBERGCODE-Stability`.
- Fija la Function a la región `iad1` para reducir variación de infraestructura.
- Añade `@vercel/functions 3.9.5`.
- Amplía el PDF con perfil de consistencia, huella y agregación PageSpeed.
- Aumenta la batería a **20 tests**.

## 0.5.0 - 2026-09-04

- Añade auditoría de infraestructura de dominio: A, AAAA, NS, MX, CAA y DNSSEC.
- DNSSEC usa una consulta DoH con validación DNSSEC cuando está disponible y evita afirmar ausencia si la comprobación externa no responde.
- Añade prueba TLS con protocolo, cipher, autorización, vigencia, emisor y certificado observable.
- Añade SPF, DMARC, búsqueda DKIM por selectores comunes, MTA-STS y TLS-RPT.
- DKIM se clasifica correctamente como `requiere selector/evidencia` cuando no existe un selector conocido; no se declara ausencia de forma concluyente.
- Chromium registra cookies, hosts terceros y plataformas conocidas de analítica/marketing cargadas en la visita inicial.
- Añade observaciones de cookies sensibles sin Secure, HttpOnly o SameSite explícito cuando aplican.
- Añade **Cumplimiento y Confianza Digital — Perú** con señales visibles de privacidad, Libro de Reclamaciones, trackers y revisión heurística de patrones coercitivos.
- Las comprobaciones Perú se etiquetan como alertas/revisión de aplicabilidad; no constituyen declaración jurídica de infracción.
- Añade **ISO Evidence Center**: lista de controles ISO que requieren evidencia interna, estado local de disponibilidad y exportación al PDF.
- Amplía ISO/IEC 27001 con una señal observable de certificado TLS cuando el módulo de infraestructura está disponible.
- Añade paneles de Infraestructura, Perú y Evidence Center al dashboard, compatibles con tema claro/oscuro.
- Amplía el PDF con DNS/TLS/correo, cookies/terceros, cumplimiento Perú y evidencias ISO pendientes/disponibles.
- Amplía el motor de remediación con acciones y criterios de cierre para infraestructura, email, cookies y cumplimiento Perú.
- Aumenta pruebas unitarias a **13**.

## 0.4.0 - 2026-09-04

- Añade **ISO Web Readiness** con catálogo de normas relevantes para seguridad, privacidad, accesibilidad, calidad, usabilidad, nube, continuidad y gestión de servicios.
- Distingue `cumple observablemente`, `observación`, `requiere evidencia interna` y `no aplica`.
- Añade score de **alineamiento ISO observable**, explícitamente no equivalente a certificación.
- Añade recomendaciones, acción correctiva y criterio de cierre por control ISO.
- Integra ISO/IEC 40500:2025, 29184:2020, 27701:2025, 27001:2022/27002:2022, 27034-1:2011, 25010:2023/25023:2016, ISO 9241-11/210, 29147/30111, 27017:2026, 27018:2025, 27035:2023, ISO 22301:2019 e ISO/IEC 20000-1:2018.
- Detecta señales visibles de privacidad: enlaces de privacidad/cookies, formularios, campos potencialmente PII y controles de consentimiento.
- Prueba `/.well-known/security.txt` y `/security.txt` como evidencia técnica útil de divulgación de vulnerabilidades.
- Añade observaciones remediables ISO-29184-PRIVACY-001, ISO-29184-CONSENT-001 e ISO-29147-VDP-001.
- Añade panel ISO al dashboard y sección ISO al PDF.
- El score global usa la categoría compliance únicamente como alineamiento observable y mantiene la advertencia metodológica.
- Aumenta pruebas unitarias a **11**.

## 0.3.0 - 2026-09-04

- Añade tema **claro y oscuro** con selector en la interfaz.
- Detecta preferencia inicial del sistema mediante `prefers-color-scheme`.
- Persiste el tema elegido en `localStorage` y actualiza `theme-color`.
- Añade `lib/config/remediations.js` como catálogo central de soluciones CYBERGCODE.
- Cada hallazgo incorpora recomendación, solución, pasos, criterio de cierre, ejemplo y esfuerzo estimado cuando aplica.
- El dashboard presenta observaciones expandibles con sección **Solución para levantar la observación**.
- El PDF incorpora recomendación, solución, pasos y criterio de cierre por hallazgo.
- Añade `axe-core 4.13.0` dentro de Chromium para accesibilidad automática adicional.
- axe-core devuelve violaciones, nodos afectados, casos incompletos, evidencia y referencias.
- Los hallazgos dinámicos de axe-core reciben remediación y criterio de validación.
- Ajusta scoring: una puntuación agregada externa actúa como techo y no oculta deducciones objetivas propias más restrictivas.
- Reduce el payload prioritario del dashboard a 300 hallazgos debido al mayor detalle de remediación por observación.
- Aumenta pruebas unitarias a **9**.

## 0.2.0 - 2026-09-04

- Añade Chromium/Puppeteer compatible con Vercel mediante chromium-min y pack generado en postinstall.
- Añade request guard del navegador para reducir SSRF desde recursos cargados por páginas auditadas.
- Añade DOM renderizado y comparación con HTML inicial.
- Añade errores JavaScript de runtime.
- Añade colores y tipografías desde estilos computados.
- Añade contraste automático orientativo WCAG AA.
- Añade overflow móvil y targets táctiles pequeños.
- Añade screenshots desktop y móvil.
- Añade PageSpeed Insights/Lighthouse móvil y desktop.
- Añade métricas LCP, CLS, TBT y FCP.
- Añade puntuaciones Lighthouse de Performance, Accessibility, Best Practices y SEO.
- Actualiza scoring con límites de deducción por regla.
- Limita y prioriza payload de hallazgos para compatibilidad con Vercel.
- Amplía PDF con datos de rendimiento y DOM renderizado.
- Refuerza cabeceras de seguridad del propio auditor.
