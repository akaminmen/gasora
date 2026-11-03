# 009 — Tarjeta de resultado: cómo se evita el solape (sección 9.7)

Estado: implementada y verificada con tests de layout · Fecha: 30/10/2026

## Problema

El diseño aprobado solapa el precio con el badge «Más barata»: la fila del nombre y el badge no se encoge y empuja el precio. La sección 9.7 manda estructura, no medidas.

## Solución (`src/styles/components.css`, `src/components/ui/Station.tsx`)

- CSS Grid de cuatro columnas `44px minmax(0,1fr) auto 2.75rem` (avatar · información · precio · favorito). Sin `position: absolute` para el contenido; la única capa absoluta es la que extiende el enlace a toda la tarjeta.
- Información en filas: nombre (una línea, elipsis) → badge en su propia fila → distancia + dirección (la distancia no se trunca, la dirección sí) → ahorro (máx. 2 líneas).
- Precio: `white-space: nowrap`, sin encogerse; el círculo de tramo debajo.
- El badge no puede ser más ancho que su columna (si no cabe, acorta el texto), como último recurso.

## Umbrales (container queries, en `px + rem`)

Los anchos fijos (avatar y huecos) están en px; el favorito, el padding, el precio y el badge, en rem. Por eso el ancho mínimo de cada modo es «px fijos + rem de texto» y crece solo cuando el usuario sube el tamaño de fuente:

| Ancho de la tarjeta                          | Layout                                        |
| -------------------------------------------- | --------------------------------------------- |
| ≥ 80 px + 17,25 rem (356 px a fuente normal) | 4 columnas, avatar de 44 px y precio de 24 px |
| ≥ 60 px + 15,75 rem (312 px)                 | 4 columnas, avatar de 36 px y precio de 20 px |
| ≥ 52 px + 10 rem                             | Precio en su propia fila                      |
| menos                                        | Además, la información en su propia fila      |

Desviación del plan: el plan fija el paso a avatar de 36 px y precio de 20 px en 340 px; aquí es 356 px a fuente normal (16 px más) porque por debajo de 356 px el badge no cabe junto al precio en 4 columnas.

## Defectos que los tests encontraron antes de corregirlos

1. Badge «Más barata» bajo el precio en tarjetas estrechas (el defecto del diseño aprobado), detectado en la primera ejecución de los tests.
2. Favorito de 88 px dentro de una columna de 44 px con la fuente al 200 % (el botón de Tailwind es `rem`).
3. Favorito que sobresalía 4 px de la tarjeta por mezclar px y rem en el padding.
4. Información más estrecha que «distancia · dirección» con texto al 200 % en móviles de 320–390 px.
5. Pines de 32 px de alto (por debajo de 44 px de zona táctil).
6. Esqueleto de ficha con `aria-label` sin rol y pines enfocables dentro de un bloque `aria-hidden` (axe).
7. Galería `/ui-kit` que desbordaba la página en móviles (rejilla que no encogía).

## Tests

`tests/e2e/layout.spec.ts`: en 7 anchos (320–1440) y 2 temas, sobre el rótulo de 86 caracteres y la dirección de 104 (`src/features/ui-kit/samples.ts`), mide con `getBoundingClientRect` que no hay solapes (tolerancia 0), que el precio no se recorta ni lo tapa ningún ancestro, que no hay desbordamiento horizontal y que las zonas táctiles miden ≥ 44×44 px. Repite con la fuente al 200 % y con un barrido del ancho de la tarjeta de 200 a 480 px cada 4 px.
