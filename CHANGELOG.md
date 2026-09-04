# CHANGELOG

## v0.8.1 — hotfix de loader, branding y despliegue

- Loader oscuro de pantalla completa basado en el diseño acordado.
- 8 módulos orbitando la identidad visual del sitio.
- Logo real del dominio en el centro mediante `/api/identity`; fallback textual cuando no existe un logo utilizable.
- El porcentaje visual fue sustituido por tiempo real transcurrido para mantener la política `measured-only`.
- Logo CYBERGCODE aprobado integrado en topbar; símbolo + wordmark legible en sidebar y loader.
- Nuevo `cybergcode-symbol.png` para favicon/sidebars.
- Detección de logo ampliada a imágenes lazy, contexto header/nav, metadatos y JSON-LD.
- Cache-busting `?v=0.8.1` y reglas de caché de Vercel para evitar servir la UI antigua.
- ZIP preparado con archivos en la raíz para despliegue GitHub → Vercel.
- 30/30 pruebas automatizadas aprobadas.


## v0.8.1 — interfaz de producto + integridad de datos

- Nuevo logo principal CYBERGCODE Web Audit Intelligence implementado en la interfaz y portada PDF.
- Dashboard rediseñado como workspace de ancho completo con sidebar, barra de secciones y rail lateral de observaciones.
- El resumen utiliza mejor el espacio horizontal y evita paneles vacíos.
- Las tarjetas de puntuación solo aparecen para categorías realmente medidas; los módulos sin fuente quedan fuera de la puntuación visual.
- Badge explícito `Datos reales · sin simulación` y política de integridad `measured-only` dentro del JSON de auditoría.
- Nuevo bloque resumen con SEO, H1–H6, páginas inspeccionadas, observaciones prioritarias e información de auditoría.
- Loader profesional rediseñado con anillos/orbitas, fases de auditoría y sin porcentaje ficticio.
- Nuevo `/api/identity`: detecta de forma segura logo/icono real del sitio auditado y lo muestra en el centro del loader; si no puede obtenerse, utiliza el dominio como fallback.
- El endpoint de identidad aplica validación SSRF, límites de redirección y límite de peso de imagen.
- Estados PageSpeed/Chromium no disponibles se presentan como fuente no disponible, sin inventar métricas.
- Logo corporativo incorporado al PDF cuando el asset está disponible.
- User-Agent interno actualizado a v0.8.
- Nuevas pruebas para branding, loader, workspace, datos reales y puntuaciones medidas.

## v0.7.0

- SEO técnico y H1–H6 convertidos en módulos principales.
- Resumen SEO por dominio y tablas por URL.
- Inventario de imágenes y ficha SEO por página.
