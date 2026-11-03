# 012 — Mapa y hoja inferior (Fase 4)

Estado: **implementada y verificada con tests; la apariencia está pendiente de revisión visual** · Fecha: 03/11/2026

## Mapa

- **MapLibre GL JS 6.16.0** (versión exacta en `package.json`) con estilos de OpenFreeMap: `positron` en tema claro y `dark` en tema oscuro (`https://tiles.openfreemap.org/styles/<nombre>`; los dos existen, comprobado el 03/11/2026). Al cambiar de tema se cambia el estilo y se vuelven a añadir las capas de datos.
- **Carga diferida:** el mapa vive en `features/map/MapCanvas.tsx` y se carga con `import()` desde `MapPanel`; el inicio no lo descarga. Si la descarga o WebGL fallan, se muestra «No se ha podido cargar el mapa» y la lista sigue funcionando.
- **Worker:** MapLibre 6 carga su worker como módulo y deduce la ruta del propio fichero, que Vite no copia. Se importa con `?url` y se indica con `setWorkerUrl`. El fichero se emite con extensión `.js` (`vite.config.ts`) para que cualquier servidor lo sirva como JavaScript.
- **Peso del JavaScript** (tamaños de Vite, sin comprimir / gzip):

| Pieza                                          | Antes de la Fase 4  | Después               |
| ---------------------------------------------- | ------------------- | --------------------- |
| JS inicial (`index-*.js`)                      | 410,9 KB / 126,6 KB | 429,0 KB / 132,4 KB   |
| Trozo del mapa (`MapCanvas-*.js`)              | —                   | 1.077,0 KB / 293,6 KB |
| Worker de MapLibre (`maplibre-gl-worker-*.js`) | —                   | 519,4 KB / ≈147 KB    |
| CSS del mapa (`MapCanvas-*.css`)               | —                   | 71,3 KB / 10,3 KB     |

El JS inicial crece 18 KB (5,8 KB en gzip) por la hoja inferior, la selección y la vista de resultados. El mapa añade ≈1,67 MB sin comprimir (≈450 KB en gzip) que solo se descargan al ver resultados.

- **Datos y pines:** una fuente GeoJSON con agrupación (radio 44 px, hasta el zoom 12) con tres capas: clústeres con su número, puntos de tramo y, encima, **pines HTML con el precio para un máximo de 60 estaciones** de la vista que no estén agrupadas (la seleccionada siempre, luego las «más baratas», luego por precio). Cada pin lleva precio, símbolo ▼ — ▲ y nombre accesible; la más barata, corona. El pin seleccionado lleva un anillo índigo.
- **Sincronía:** la selección vive en el store de búsqueda. Pulsar un pin o una tarjeta selecciona la estación, abre la ficha, desplaza la lista hasta su tarjeta (ampliándola si hace falta) y centra el mapa. Mover el mapa no cambia el conjunto de resultados ni los tramos.
- **Encuadre:** al buscar, cambiar el radio o las marcas se encuadran los resultados (y la posición del usuario) teniendo en cuenta la zona tapada por la hoja o los controles. Con «Usar mi ubicación» se dibuja el punto del usuario y hay un botón «Centrar en mi ubicación».
- **Atribución:** MapLibre la toma de la fuente del estilo (`© OpenMapTiles, Data from OpenStreetMap`, con OpenFreeMap) y se muestra sin plegar; en móvil se sube por encima de la hoja. «Acerca de» repite el texto. Un test contra los servidores reales (`map-live.spec.ts`) comprueba que el estilo y la atribución existen y se ven.
- **Controles propios** (acercar, alejar, centrar) de 44×44 px en lugar de los de MapLibre, que son más pequeños. El mapa tiene `role="region"` con nombre; la lista es la alternativa accesible.
- Los tests no usan los servidores de teselas: sustituyen el estilo por uno mínimo (`tests/e2e/fixtures.ts`).

## Maquetación

- **Escritorio (≥ 1024 px):** buscador y combustibles arriba; lista de 400 px · mapa · ficha de 360 px solo con una estación seleccionada.
- **Tablet (640–1023 px):** lista de 340 px y mapa; la ficha se superpone al mapa.
- **Móvil (≤ 639 px):** mapa a pantalla casi completa con el buscador y los chips flotantes, y la hoja inferior. El pie de página no se muestra en esta pantalla (la atribución está en «Acerca de»).
- La ficha usa el componente `StationDetail`; «Compartir» y los favoritos muestran un aviso hasta la Fase 5.

## Hoja inferior

- Tres alturas calculadas según el alto del contenedor: compacta (180 px), intermedia (la mitad, hasta 440 px) y expandida (todo menos la franja del buscador y los chips, que se mide y crece con el tamaño de letra).
- **Gestos:** se arrastra desde el asa y la cabecera con eventos de puntero (táctil o ratón); la altura sigue al dedo y, al soltar, se ajusta a la altura más cercana o, si el gesto fue rápido (> 0,5 px/ms en los últimos 100 ms), a la siguiente en esa dirección. Un movimiento menor de 6 px es un toque.
- **Sin bloquear el mapa:** la hoja solo ocupa su rectángulo; los controles flotantes tienen `pointer-events: none` salvo ellos mismos. `touch-action: none` solo en el asa y la cabecera, no en la lista.
- **Accesibilidad:** el asa es un botón con el nombre de la altura actual; Intro y Espacio cambian de altura, ↑ ↓ suben y bajan, Inicio y Fin van a los extremos. Zonas táctiles de 44 px como mínimo. El botón «Lista» / «Mapa» alterna entre la hoja expandida y el mapa.
- **Movimiento reducido:** con `prefers-reduced-motion` no hay transición de altura ni animación del punto del usuario, y los movimientos del mapa son instantáneos.
- Según el diseño, el radio y el filtro de marcas solo aparecen con la hoja expandida.

## Límites de lo probado

- Chromium sin interfaz dibuja WebGL con SwiftShader (por software): los tests confirman que el mapa se inicia, que hay lienzo, pines, agrupación y eventos. No confirman el aspecto.
- Los gestos táctiles se simulan con eventos de puntero de tipo táctil y con ratón; no se han probado con un dedo real.
