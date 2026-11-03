# 007 — Atribuciones y límites de uso de las fuentes

Estado: aceptada (información aportada por el usuario) · Fecha: 28/10/2026

## OpenFreeMap (resuelto por el usuario)

- **Atribución obligatoria:** «© OpenMapTiles, Data from OpenStreetMap». MapLibre la añade sola desde el estilo; no hay que quitarla ni ocultarla. Hay que comprobarla con un test en la Fase 4.
- **Descargas offline:** como máximo 3.000 teselas o 50 MB por descarga, con 4 peticiones en paralelo como máximo y un `User-Agent` que identifique la app.
- Consecuencia para la PWA (Fase 6): la caché de ejecución de teselas debe quedar acotada por debajo de esos límites, sin descargas masivas.
- Términos leídos el 28/10/2026 (versión del 14/10/2026): prohíben recopilar datos de forma automatizada salvo las descargas offline anteriores.

## datos.gob.es / Ministerio

- El catálogo declara actualización diaria, **pero no publica texto de licencia**.
- El literal de atribución sigue marcado **[VERIFICAR]**. Texto provisional (sección 3.4 del plan, ya con la fórmula del ADR 001): «Fuente: Ministerio para la Transición Ecológica y el Reto Demográfico — Precio de carburantes en las gasolineras españolas (datos.gob.es). Datos consultados el {fecha}.»
- La cadencia real de actualización de precios se mide con `npm run cadence` (no se puede deducir de la API; ver ADR 001).
