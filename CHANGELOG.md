# Changelog

## v0.12.0 — responsive system, loader adaptativo y navegación móvil

- Loader de auditoría rediseñado para **móvil, tablet y desktop** con composición fluida, escalado progresivo y distribución apilada en pantallas estrechas.
- Los **8 nodos orbitales** ahora usan iconografía SVG representativa (SEO, DOM, Imágenes, Accesibilidad, Seguridad, Perú, ISO y PDF) y animaciones sutiles de flotación/brillo para reforzar la sensación interactiva.
- Nuevo **selector móvil de secciones** para el dashboard (`dashboardTabSelect`) que complementa la barra horizontal de pestañas y evita desbordes en pantallas pequeñas.
- Tablas del análisis adaptadas a formato **stacked cards** en móvil, preservando todas las métricas sin desbordes laterales.
- Ajustes responsivos globales en textos, KPIs, paneles, grids, botones, gráficas e imágenes para mejorar la lectura en cualquier dispositivo.
- Todos los assets públicos y el motor visual se actualizan a **ENGINE 0.12.0**.

# CHANGELOG

## v0.11.0 — crawler 100–500 páginas, jobs por lotes y muestreo por plantillas

- Auditorías de 51–500 páginas derivadas automáticamente al flujo `/api/jobs/*`.
- La Function `/api/audit` no intenta procesar auditorías grandes en una sola invocación.
- Job temporal con Vercel Runtime Cache y fallback local de memoria.
- TTL de 2 horas.
- Rastreo en lotes de 20 URLs con concurrencia controlada.
- Progreso basado en URLs realmente procesadas, exitosas, fallidas, descubiertas y pendientes.
- Reanudación después de recargar mediante referencia local + endpoint de estado.
- Cancelación explícita de jobs temporales.
- Almacenamiento de páginas por chunks comprimidos.
- Auto-división de chunks grandes para respetar un margen seguro frente al límite de tamaño por entrada del Runtime Cache.
- Ficha completa por página recuperable bajo demanda mediante `/api/jobs/page`.
- Resultado principal compacto para controlar el payload del dashboard.
- Agrupación heurística de páginas por tipo/plantilla usando URL, headings y structured data.
- Nueva pestaña **Cobertura**.
- Selección de URL representativa por grupo.
- Muestreo Chromium adicional sobre hasta 3 plantillas no-home cuando el navegador está habilitado.
- El muestreo representativo no altera ni inventa el score PageSpeed principal.
- PDF ampliado con cobertura del crawler, grupos de plantillas y muestras representativas.
- Perfil estable actualizado a `CG-STABLE-3`.
- ENGINE `0.11.0`.
- Política measured-only preservada.

## v0.10.0 — modos de auditoría, CSS avanzado y accesibilidad manual guiada

- Modos Rápida / Completa / Personalizada.
- Selección real de módulos y dispositivos.
- Configuración incluida en fingerprint/caché.
- Scoring excluye categorías no seleccionadas.
- Tabs no seleccionados se ocultan del dashboard.
- CSSOM + computed styles para cobertura CSS observable, inline styles, variables, tipografías, spacing, radios y estados.
- Hallazgos y remediaciones CSS nuevas.
- Accesibilidad manual guiada con persistencia local por auditoría.
- Tab Accesibilidad independiente.
- PageSpeed y CrUX respetan Mobile/Desktop.
- PageSpeed conserva resultados parciales por dispositivo cuando uno falla.
- Matriz visual impacto/esfuerzo del plan de acción.
- PDF ampliado con modo, dispositivos, CSS y revisión manual.
- Perfil reproducible CG-STABLE-2.
- 49+ pruebas automatizadas de la base, más pruebas específicas de V0.10.

## v0.9.0 — performance fiable, CrUX, UX/CRO y revisión IA opcional

- CrUX API e History API opcionales.
- Chromium Lab como fallback medido y separado de Lighthouse.
- UX/CRO observable.
- IA editorial opcional sin impacto en score técnico.
- SEO e imágenes avanzadas.
- Plan de acción y Quick Wins.
