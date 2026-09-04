# CYBERGCODE Web Audit Intelligence

Base V0.1 para una plataforma de auditoría web integral orientada a **GitHub → Vercel**.

## Qué funciona en esta entrega

- Entrada de dominio/URL.
- Normalización y protección SSRF inicial.
- Resolución DNS y bloqueo de redes privadas/reservadas.
- Revalidación de destino en redirecciones HTTP.
- Rastreo interno hasta 50 páginas.
- Estado HTTP y cadena de redirecciones.
- SEO: `title`, meta description, canonical, robots, idioma.
- Encabezados H1–H6, encabezados vacíos y saltos jerárquicos.
- Imágenes: `alt`, `width`, `height`, `loading`, `srcset`.
- Enlaces internos descubiertos.
- JSON-LD: conteo y tipos principales.
- Seguridad pasiva: HTTPS, HSTS, CSP, nosniff, Referrer-Policy, Permissions-Policy, divulgación Server/X-Powered-By y mixed content.
- Hallazgos estructurados con severidad, evidencia, impacto, recomendación, confianza y origen.
- Scoring CYBERGCODE provisional únicamente sobre módulos medidos.
- Dashboard minimalista responsive.
- PDF real generado en servidor con `pdf-lib` y datos corporativos.

## Módulos todavía NO fingidos

La aplicación marca como `planned` y **no puntúa** todavía:

- Lighthouse / PageSpeed / Core Web Vitals.
- Accesibilidad avanzada (axe/WCAG).
- CSS, paleta y contraste computado.
- Screenshots responsive con Chromium.
- Análisis de contenido/IA.
- Cumplimiento visible Perú.
- Históricos y usuarios.

## Desarrollo local

```bash
npm install
npm run dev
```

Vercel CLI abrirá el proyecto en una URL local.

## GitHub → Vercel

1. Crear un repositorio nuevo en GitHub.
2. Subir el contenido de esta carpeta.
3. En Vercel: **Add New → Project → Import Git Repository**.
4. Framework preset: **Other**.
5. No se requieren variables de entorno en V0.1.
6. Deploy.

## Próximo bloque P0 recomendado

1. Chromium compatible con Vercel.
2. DOM renderizado vs HTML inicial.
3. Lighthouse/PageSpeed representativo (no en cada URL).
4. axe-core y contraste.
5. screenshots mobile/desktop.
6. PDF corporativo enriquecido con capturas y gráficas.

## Seguridad

Este proyecto realiza únicamente comprobaciones pasivas. No ejecuta pentesting ni intenta explotar vulnerabilidades. El `urlGuard` es una primera barrera SSRF y debe mantenerse como componente P0 durante toda la evolución del producto.
