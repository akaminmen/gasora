# 005 — Formato de datos y reglas de la ingesta (Fase 1)

Estado: implementada; pendiente de revisión del usuario · Fecha: 28/10/2026

## Cambios respecto a las secciones 5.1 y 5.2 del plan

- **`stations`**: se añade `mid` (ID de municipio, necesario para el filtro «por municipio» y el índice de búsqueda). `pid` y `mid` son números; los IDs del API vienen como texto con ceros (`"02"`).
- **`meta.json`**: se añade `demo` (true si los datos vienen de `fixtures/`, para el rótulo «Datos de demostración»). `sourceDate` es la `Fecha` de la API en UTC (ADR 001).
- **`prices.json`**: `updatedAt` = `sourceDate`.
- **`search-index.json`**: provincias, municipios y códigos postales con centroide, **bbox** `[latMin, lngMin, latMax, lngMax]` (para `fitBounds`) y nº de estaciones.
- **`priceHash`**: hash solo de los precios (`prices.p`), no de `updatedAt`, que cambia en cada consulta aunque los precios no cambien.
- **Nombres**: provincia y municipio se muestran en forma natural (`PALMAS (LAS)` → «Las Palmas», `BALEARS (ILLES)` → «Illes Balears»). Los rótulos se limpian de espacios.

## Reglas de descarte (cada una se cuenta en el informe de la ingesta)

`sinId`, `idDuplicado`, `ventaRestringida` (todo lo que no sea `Tipo Venta = P`), `coordenadasACero`, `coordenadasIntercambiadas`, `fueraDeEspana`, `sinCombustibleMvp`. Los precios fuera de 0,500–4,000 €/L se ponen a `null` y se cuentan (no se descarta la estación).

## Marcas

`brands.ts` reconoce las 34 marcas más frecuentes. Cepsa y Moeve son **claves distintas** (conviven en los datos). Todo lo demás (3.500 rótulos distintos, incluidos `Nº …` y «sin rótulo») va a `otras`; la ingesta lista los 15 rótulos desconocidos más frecuentes para ampliar la tabla.

## Descarga y respaldo

- Cabeceras de navegador, timeout de 60 s, 4 reintentos con backoff exponencial y jitter, **alternando los dos dominios** del Ministerio (ambos devuelven lo mismo).
- Si la API falla, la respuesta no valida o las estaciones caen más del 20 %: se conserva el dataset anterior (la carpeta `public/data` o, en CI, la URL publicada en `GASORA_PREVIOUS_URL`) con un aviso `::warning::`. Sin dato anterior, el job falla y no despliega.
- `npm run ingest:fixtures` genera datos de demostración sin red.

## Deuda conocida (decisiones del usuario del 30/10/2026)

- El rango de precios sigue siendo el del plan (0,500–4,000); es laxo (Fase 0, punto 8). Se puede estrechar por combustible.
- `stations` pesa 2,3 MB sin comprimir (el objetivo del plan era <1 MB en bruto); con brotli son 318 KB. **Decidido:** en la Fase 3 se quitan `m` y `p` de las estaciones (están en el índice) y el índice de búsqueda se carga bajo demanda. Al hacerlo hay que **volver a medir el tamaño en gzip y en brotli** y comprobar si baja de 600 KB en gzip (hoy 721 KB en gzip y 489 KB en brotli).
- **Marcas:** decidido que las marcas pequeñas se agrupan en «Otras» **solo para el filtro**; la tarjeta muestra siempre el rótulo real. Se implementa en la Fase 3 (ver ADR 008).
