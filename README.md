# CYBERGCODE Web Audit Intelligence v0.10.0

Plataforma de auditoría web integral para Vercel. Frontend HTML/CSS/JavaScript y backend Node.js/Vercel Functions.

## Principio de integridad

**Datos medidos, no simulaciones.** Un módulo no seleccionado o sin fuente real no recibe una puntuación ficticia. Las heurísticas UX/CRO, cobertura CSS observable y sugerencias IA se identifican expresamente como tales.

## Novedades V0.10.0

- Modos **Rápida / Completa / Personalizada**.
- La auditoría personalizada permite seleccionar SEO, H1-H6, contenido, imágenes, rendimiento, CrUX, accesibilidad, UX/CRO, diseño/CSS, seguridad, infraestructura, Perú e ISO.
- Selector independiente **Móvil / Escritorio** para fuentes y capturas que dependen de dispositivo.
- La configuración completa forma parte de la huella de caché estable; dos auditorías con módulos o dispositivos distintos no reutilizan resultados incompatibles.
- Tabs del dashboard se ocultan cuando el usuario no seleccionó su módulo.
- Auditoría CSS observable mediante CSSOM + `getComputedStyle()`:
  - hojas accesibles/inaccesibles;
  - selectores estáticos evaluados;
  - proporción de selectores sin coincidencia en la vista actual;
  - estilos inline;
  - custom properties;
  - familias, tamaños y pesos tipográficos;
  - spacing y border-radius observados;
  - presencia observable de `:hover`, `:focus`, `:focus-visible`, `:disabled` y `:checked`.
- Nuevas remediaciones `CSS-*` y revisión de foco.
- Nuevo módulo **Accesibilidad** con resultados automáticos y checklist humano guiado para teclado, foco, lector de pantalla, zoom/reflow, multimedia, errores, movimiento y significado.
- El checklist manual se guarda localmente por auditoría y se incorpora al PDF; marcarlo como revisado no equivale a certificación WCAG.
- PageSpeed soporta selección de dispositivo y conserva resultados válidos si solo uno de los dispositivos responde.
- CrUX respeta los dispositivos seleccionados.
- Plan de acción incorpora matriz visual de impacto/severidad frente a esfuerzo declarado.
- PDF ampliado con configuración de auditoría, CSS observable y revisión manual de accesibilidad.
- Perfil estable actualizado a `CG-STABLE-2`.

## Modos

### Rápida

Pensada para diagnóstico inicial de bajo coste. Incluye HTTP/HTML, SEO, H1-H6, contenido determinístico, imágenes básicas, UX observable y seguridad pasiva. Omite Chromium, Lighthouse/CrUX, ISO y cumplimiento para reducir tiempo.

### Completa

Ejecuta todos los módulos automáticos disponibles. PageSpeed, CrUX e IA siguen dependiendo de sus respectivas fuentes/configuración.

### Personalizada

Solo presenta y puntúa los módulos seleccionados. Chromium se activa internamente cuando es dependencia necesaria de Rendimiento, Accesibilidad o Diseño, sin convertir por ello módulos no seleccionados en puntuaciones.

## Variables de entorno

```env
PAGESPEED_API_KEY=
CRUX_API_KEY=
OPENAI_API_KEY=
OPENAI_MODEL=gpt-5.6-luna
CHROME_EXECUTABLE_PATH=
CHROMIUM_PACK_URL=
```

## Desarrollo

```bash
npm install
npm test
npm run check
npx vercel dev
```

## Endpoint principal

`POST /api/audit`

Ejemplo personalizado:

```json
{
  "url": "https://example.com",
  "auditMode": "custom",
  "maxPages": 25,
  "stableMode": true,
  "pageSpeed": true,
  "aiReview": false,
  "devices": {
    "mobile": true,
    "desktop": false
  },
  "modules": {
    "seo": true,
    "headings": true,
    "content": true,
    "images": true,
    "performance": true,
    "crux": true,
    "accessibility": true,
    "ux": true,
    "visual": true,
    "security": true,
    "infrastructure": true,
    "compliance": false,
    "iso": false
  }
}
```

## Interpretación de CSS

La métrica de selectores sin coincidencia **no equivale automáticamente a CSS sin usar**. Solo evalúa selectores estáticos en hojas accesibles por CSSOM sobre la vista renderizada. Estados dinámicos, rutas distintas, componentes diferidos y hojas cross-origin pueden justificar reglas no coincidentes. Cualquier eliminación requiere validación por plantillas.

## Accesibilidad

axe-core, contraste, responsive y targets táctiles son comprobaciones automáticas parciales. La sección manual guía pruebas que no deben declararse aprobadas automáticamente: teclado, foco, lector de pantalla, zoom/reflow, multimedia, formularios, movimiento y significado.

## Despliegue GitHub -> Vercel

1. `package.json`, `vercel.json`, `api/`, `lib/` y `public/` deben quedar en la raíz.
2. Configurar solo las variables de entorno que se vayan a utilizar.
3. Hacer push a la rama conectada a Vercel.
4. Confirmar en producción `ENGINE 0.10.0`.
5. Probar Rápida, Completa y Personalizada.
6. Confirmar que tabs no seleccionados desaparezcan y que sus categorías no reciban score.
7. Verificar PageSpeed/CrUX/IA como fuentes opcionales y explícitas.

## Pendiente para cerrar V1.0

- Crawler grande de **100-500 páginas mediante jobs/cola persistente**. No se fuerza dentro de una única Function Vercel de 300 s.
- Cobertura CSS multi-plantilla para reducir incertidumbre de selectores dinámicos/no visitados.
- Flujo de revisión manual con almacenamiento persistente y adjuntos de evidencia (actualmente local en navegador).
- Pulido final del PDF/plan de acción y validación end-to-end en Vercel con las APIs externas configuradas.

## Fase plataforma posterior a V1.0

Usuarios, clientes, proyectos, PostgreSQL, históricos, comparativas antes/después, auditorías programadas, monitorización/alertas, evidencias ISO persistentes, API, white-label, Search Console, Analytics y pruebas activas de seguridad únicamente con autorización.

## Empresa

CYBERGCODE SOLUCIONES TECNOLOGICAS S.A.C.  
RUC 20615849988  
cybergcode.com · Lambayeque, Perú
