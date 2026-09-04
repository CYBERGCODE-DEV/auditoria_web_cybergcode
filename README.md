# CYBERGCODE Web Audit Intelligence v0.8.0

Plataforma de auditoría web integral construida con HTML, CSS y JavaScript en frontend y Node.js/Vercel Functions en backend.

## Principio de la V0.8

**Mostrar datos medidos, no completar huecos con simulaciones.**

La interfaz solo puntúa categorías que dispongan de una fuente real. PageSpeed, Chromium u otros módulos que fallen aparecen como `no disponible` y no reciben una nota inventada.

## Novedades de V0.8

- Logo principal CYBERGCODE implementado en UI y PDF.
- Dashboard full-width con sidebar y rail de observaciones.
- Navegación interactiva: Resumen, SEO, H1–H6, Páginas, Imágenes, Rendimiento, Diseño, Seguridad, Perú, ISO y Observaciones.
- Loader profesional con identidad visual real del dominio auditado.
- `/api/identity` busca logo, icono o favicon mediante conexiones protegidas por SSRF Guard.
- Resumen SEO real: robots, sitemap, indexabilidad, title, description, canonical, H1, enlaces y Schema.
- Matriz H1–H6 y ficha SEO por URL.
- Inventario de imágenes.
- DOM renderizado, axe-core, paleta, tipografías, contraste y screenshots cuando Chromium está disponible.
- Seguridad pasiva, DNS/TLS/correo, Perú e ISO Readiness.
- Observaciones con evidencia, recomendación, solución, pasos y criterio de cierre.
- Tema claro/oscuro y `prefers-reduced-motion`.
- Modo estable y caché para reducir variación entre dispositivos.

## Desarrollo

```bash
npm install
npm test
npm run check
npx vercel dev
```

## Despliegue recomendado

1. Subir el repositorio a GitHub.
2. Importarlo en Vercel.
3. Configurar `PAGESPEED_API_KEY` si se utilizará PageSpeed de forma frecuente.
4. Desplegar.

## Endpoints

- `POST /api/audit`
- `POST /api/identity`
- `POST /api/report`

## Seguridad

El auditor bloquea localhost, redes privadas/reservadas y protocolos no HTTP/HTTPS. El endpoint de identidad también revalida cada redirección antes de descargar un logo/icono y limita el peso del recurso.

## Empresa

CYBERGCODE SOLUCIONES TECNOLOGICAS S.A.C.  
RUC 20615849988  
cybergcode.com · Lambayeque, Perú
