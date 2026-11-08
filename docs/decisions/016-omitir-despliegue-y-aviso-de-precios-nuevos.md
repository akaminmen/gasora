# 016 — Omitir el despliegue sin cambios y avisar de «Hay precios nuevos»

Estado: **implementada y verificada con tests; el comportamiento de omitir el despliegue solo se puede comprobar de verdad cuando `deploy.yml` esté en `main`** · Fecha: 06/11/2026

## Contexto

Un disparador externo lanza «Ingesta y despliegue» unas 128 veces al día. Compilar y desplegar en cada una, con los datos idénticos, no aporta nada. Además, la web solo pedía precios al abrir y al volver a la pestaña; una pestaña abierta no se actualizaba nunca.

## Huella de contenido

`meta.json` lleva `contentHash` (16 caracteres): huella de las estaciones (altas, bajas, direcciones, marcas, horarios), los precios y el índice de búsqueda. **No incluye ninguna fecha**: no cambia porque cambie la hora de la consulta. `priceHash` (solo precios) se mantiene; `stationsFile` ya llevaba el hash de las estaciones. El campo es opcional en el esquema (`metaSchema`), así que los datos publicados antes de este cambio siguen siendo válidos (sin huella → se despliega).

## Omitir compilación y despliegue (`deploy.yml`, `scripts/compare-published.ts`)

Tras la ingesta y la comprobación de datos, `npm run compare:published` descarga el `meta.json` y el `version.json` que sirve GitHub Pages (con un parámetro único y cabeceras `no-cache`, `no-store`) y decide:

- **Se omite** (la ejecución termina en verde con el resumen «sin cambios, no se despliega») solo si el evento es `schedule` o `workflow_dispatch` sin `force`, el código publicado es el de esta ejecución (`version.json` lleva el commit) y coinciden `contentHash`, `stationsFile`, `schemaVersion` y `demo`.
- **Siempre se despliega:** evento `push`; `workflow_dispatch` con `force=true` (entrada booleana, falsa por defecto); huella distinta; código publicado distinto; cualquier error al descargar o leer lo publicado, o falta de huella (falla abierto: ante la duda se despliega). El paso `compare` lleva `continue-on-error`, y las condiciones comprueban `!= 'false'`: si el propio script se rompe, se despliega.
- Se mantienen `concurrency`, los disparadores, `check:data` y el fallo sin desplegar si no hay datos válidos. Solo se omiten `npm test`, la compilación, `check:build` y la subida del artefacto; el trabajo `deploy` no se ejecuta.

### Riesgos analizados

- **Respuesta obsoleta de la caché de GitHub Pages** (`max-age=600`). La consulta usa un parámetro único y cabeceras de no caché, pero la CDN podría igualmente servir algo viejo. Si lo publicado aparece más antiguo de lo real: la huella difiere → **un despliegue de más** (inofensivo). Si aparece una versión vieja idéntica a lo recién ingerido mientras lo realmente publicado ya es otra (el caso de un cambio que **vuelve al valor anterior** en menos de unos minutos): se omite por error → **un cambio real se retrasa** hasta la siguiente ejecución (≤ 15 minutos con el disparador, ≤ 30 con el `cron`), que ya verá la diferencia. No se pierde un cambio de forma permanente, porque cada ejecución compara de nuevo con lo publicado.
- **Código nuevo sin desplegar.** Si un `push` queda en cola y lo sustituye una ejecución posterior (`concurrency` cancela la espera más antigua), la ejecución que sigue ve el commit nuevo pero datos iguales; por eso se compara el commit publicado (`version.json`): si no coincide, se despliega.
- **Cambios que vuelven al valor anterior** (A → B → A): cada ejecución compara con lo publicado en ese momento; no hay estado oculto.
- **Interacción con el `cron` de respaldo.** Idéntica al disparador externo: todas las ejecuciones aplican la misma regla; las duplicadas no hacen nada o se cancelan en la cola. El `cron` sigue siendo «mejor esfuerzo».
- **Límite de 60 días de GitHub.** Ver `docs/disparo-externo.md` y STATUS: la documentación no define «actividad» ni dice si las ejecuciones cuentan.

## La fecha de los datos

Con esto, `sourceDate` es la hora de la consulta con la que se publicaron los datos, no necesariamente la de la última comprobación. La frase «Datos del Ministerio consultados el …» sigue siendo literalmente cierta y no se cambia (es parte de la atribución; ver ADR 001). «Acerca de» explica que una consulta sin cambios no se vuelve a publicar. No se afirma ninguna frecuencia.

## Aviso «Hay precios nuevos · Actualizar» (cliente)

- Con la pestaña visible, **cada 10 minutos** (y al volver a la pestaña o recuperar la conexión tras más de 10 minutos) se pide solo `meta.json` con revalidación (`cache: 'no-cache'`: el navegador pregunta con ETag y no se queda con los hasta 10 minutos de la CDN). Si la huella (`contentHash`; si falta, `priceHash` y fichero de estaciones) es la de lo que se ve, no se hace nada.
- Si cambió, los precios (y las estaciones, si cambió su fichero) se descargan **en segundo plano** y quedan pendientes; la pantalla, la lista y el ranking no se tocan. Un `meta.json` nuevo con precios a medio publicar (distinta fecha) cuenta como error y se reintenta.
- La franja **«Hay precios nuevos» + botón «Actualizar»** (44 px, `role="status"`, `aria-live="polite"`) va en el flujo, bajo la cabecera, como la de «Sin conexión»; las pantallas de alto fijo descuentan su altura (`--top-strips`), así que no tapa la hoja, los controles del mapa ni la atribución. Al pulsar se aplican los datos nuevos (búsqueda, combustible, orden, filtros, zona y ficha se mantienen), se anuncia «Precios actualizados» y el foco pasa al contenido.
- **Pausas y reintentos:** sin comprobaciones con la pestaña oculta, sin conexión o con el ahorro de datos del navegador (`saveData`); tras un fallo, espera creciente (30 s, 60 s, 120 s… tope 10 minutos) sin avisar al usuario; ±10 % de variación aleatoria para repartir las peticiones.
- **Service worker:** los datos no están en la precarga ni en ninguna caché de ejecución. El nombre del fichero de estaciones en `index.html` no cuenta para su revisión de precarga (ADR 014) y los trozos de JS no cambian con los datos: una compilación con otros datos produce un `sw.js` **idéntico byte a byte** (comprobado), así que una actualización solo de datos no dispara «Hay una versión nueva de Gasora».
