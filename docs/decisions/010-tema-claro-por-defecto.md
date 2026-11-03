# 010 — Tema claro por defecto, sin seguir al sistema

Estado: **aceptada** · Fecha: 03/11/2026

## Contexto

La primera versión del tema seguía la preferencia del sistema (`prefers-color-scheme`) hasta que la persona elegía uno. Con el sistema en oscuro, la web se abría oscura sin que nadie lo hubiera pedido, y el diseño aprobado se presenta en claro.

## Decisión

- El tema por defecto es el **claro**, con independencia de `prefers-color-scheme`.
- El oscuro solo se activa si la persona lo elige con el interruptor de la cabecera. La elección se guarda en `gasora:theme:v1` (`light` o `dark`) y se aplica antes del primer pintado con el script en línea de `index.html`.
- Un valor ausente o desconocido en `gasora:theme:v1` equivale a `light`.
- `tokens.css` ya no contiene el bloque `@media (prefers-color-scheme: dark)`: el oscuro vive solo en `[data-theme='dark']`.

## Consecuencias

- Una única fuente de verdad para el tema: el atributo `data-theme` y el valor guardado.
- Los tests de layout y de accesibilidad ya no emulan el esquema de color del sistema: fijan el tema escribiendo `gasora:theme:v1`, igual que lo haría el interruptor.
- Nuevos e2e en `tests/e2e/smoke.spec.ts`: sin elección guardada y con el sistema en oscuro, la página carga clara; con `dark` guardado, carga oscura aunque el sistema esté en claro.
- Quien prefiere el oscuro de forma permanente debe pulsar el interruptor una vez por navegador.
