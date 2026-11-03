# 011 — Capa de datos, búsqueda y ubicación (Fase 3)

Estado: **implementada y verificada con tests** · Fecha: 03/11/2026

## Datos publicados

- Las estaciones ya no llevan municipio ni provincia (`m` y `p`): solo `pid` y `mid`. Los nombres viven en `search-index.json` (provincias y municipios con su centroide, límites y nº de estaciones).
- El índice de búsqueda **no forma parte de la carga inicial**: se descarga al enfocar el buscador o al escribir en él. La carga inicial son `meta.json`, `stations.{hash}.json` y `prices.json`.
- Tamaño medido con `npm run size` (gzip nivel 9, brotli calidad 11) sobre 11.357 estaciones:

| Fichero                             | Bruto            | gzip             | brotli           |
| ----------------------------------- | ---------------- | ---------------- | ---------------- |
| `stations.{hash}.json` (antes)      | 2.254 KB         | 475 KB           | 311 KB           |
| `stations.{hash}.json` (ahora)      | 1.880 KB         | 395 KB           | 282 KB           |
| `prices.json`                       | 436 KB           | 78 KB            | 61 KB            |
| `search-index.json` (bajo demanda)  | 645 KB           | 152 KB           | 106 KB           |
| **Carga inicial (antes → ahora)**   | 2.690 → 2.316 KB | 553 → **474 KB** | 372 → **343 KB** |
| Todo, con el índice (antes → ahora) | 3.334 → 2.962 KB | 704 → 626 KB     | 478 → 449 KB     |

La carga inicial queda por debajo de los 600 KB en gzip y en brotli. Con el índice descargado, gzip supera los 600 KB (626 KB), pero el índice solo se pide cuando se usa el buscador. Los servidores de GitHub Pages sirven gzip; brotli depende del cliente y de la red de reparto.

## Carga y caché

- Una sola descarga compartida (`stores/data.ts`). `meta.json` y `prices.json` se piden sin caché HTTP; `stations.{hash}.json` y el índice usan la caché normal (el nombre lleva el hash).
- Cada fichero descargado se copia en Cache Storage (`gasora-data-v1`). Si la red falla, se usa esa copia y la pantalla de resultados avisa con «Sin conexión: mostrando datos del …». Sin red y sin copia, aparece el error con «Reintentar».
- Al volver a la pestaña tras más de 10 minutos se vuelven a pedir `meta.json` y `prices.json`; si el hash de las estaciones cambió, se recarga todo.
- El service worker y la política completa de caché sin conexión son de la Fase 6.

## Conjunto de resultados y ranking

- `buildResultSet` (`lib/resultset.ts`): estaciones de la búsqueda que venden el combustible elegido. Ubicación y CP: radio desde el punto (por defecto 5 km, 1–50). Municipio: sus estaciones; «Ampliar a 10 km» pasa a radio desde su centroide. Provincia: todas las suyas.
- Los tramos (P20/P60/P85, o escala mínimo–máximo con menos de 5 resultados), la marca «Más barata» y el ahorro se calculan sobre el conjunto completo **antes** del filtro de marcas. Así los colores no cambian al filtrar. El filtro solo recorta la lista.
- Ahorro por depósito: `(media − precio) × litros` con 50 litros por defecto, redondeado a céntimos; la tarjeta solo lo muestra si es positivo.
- La distancia solo se calcula con un origen concreto (ubicación o CP). Por municipio o provincia no se muestra ni se ofrece ordenar por distancia.
- Orden por precio (desempata la distancia) o por distancia (desempata el precio). La lista muestra 50 y «Ver más» añade de 50 en 50 hasta 200.

## Marcas

- El filtro agrupa en «Otras» las marcas con menos de 40 estaciones en toda España y los rótulos sin marca conocida. El umbral y el agrupado viven en `lib/brands.ts`.
- La tarjeta muestra siempre el rótulo real de la estación (`Station.n`).

## Búsqueda

- Índice en memoria, insensible a acentos y mayúsculas. Solo dígitos: códigos postales que empiecen por ellos. Texto (mínimo 2 letras): provincias y municipios, primero los que empiezan por la consulta, luego los que tienen una palabra que empieza por ella y por último los que la contienen; a igualdad, más estaciones primero.
- Teclado: ↓ y ↑ recorren las sugerencias, Enter elige la resaltada (o la primera), Esc cierra la lista. Si Enter llega antes de que el índice se haya descargado, espera a la descarga y busca.
- Debounce de 120 ms.

## Ubicación

- Flujo: explicación previa → solicitando → resultados, o denegado, o error (tiempo agotado, no disponible, contexto no seguro o navegador sin soporte).
- Si la API de permisos informa de «concedido», se salta la explicación; si informa de «denegado», se va directo a la alternativa. Si la API no existe, se muestra la explicación.
- Tiempo máximo de 10 s, sin alta precisión, con una posición reciente admitida (5 min). La posición no se guarda en ningún sitio: solo fija el lugar de la búsqueda en memoria.

## Pendiente de otras fases

- URL compartible (`?q=…&fuel=…`, F14) y restauración del estado: Fase 5.
- Lista virtualizada, mapa y sincronización: Fase 4. Favoritos reales: Fase 5.
