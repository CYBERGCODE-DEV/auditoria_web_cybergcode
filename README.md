# CYBERGCODE Web Audit Intelligence v0.8.1

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


## Verificación después de desplegar en Vercel

La web pública que se revisó antes de este hotfix seguía mostrando `ENGINE 0.7.0`. Para confirmar que Vercel está sirviendo este paquete y no el deployment anterior:

1. Los archivos de este ZIP deben quedar en la **raíz del repositorio** (`package.json`, `vercel.json`, `api/`, `lib/`, `public/`).
2. Haz commit/push a la rama conectada a Vercel.
3. En Vercel verifica que el deployment corresponda a ese commit y promociónalo a Production.
4. Abre la web y confirma que arriba aparece `ENGINE 0.8.1`.
5. Haz una recarga forzada (`Ctrl+F5`) una vez. Los CSS/JS llevan `?v=0.8.1` y la página principal usa `Cache-Control: no-store`.
6. Al iniciar una auditoría, la barra superior desaparece y se abre el loader oscuro de pantalla completa. El centro muestra el logo detectado del dominio si el sitio publica uno accesible; en caso contrario muestra un fallback textual explícito.

### Loader 0.8.1

- CYBERGCODE usa el símbolo/logo aprobado en el producto.
- El dominio auditado se muestra dinámicamente.
- `/api/identity` busca un logo real en HTML, metadatos y JSON-LD y descarga el recurso con protección SSRF.
- No hay porcentaje ficticio: el valor central es el **tiempo real transcurrido**.
- Si no existe un logo seguro/usable, la interfaz lo declara y usa iniciales del dominio.
