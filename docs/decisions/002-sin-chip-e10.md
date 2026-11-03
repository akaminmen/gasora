# 002 — Sin chip de Gasolina 95 E10

Estado: **aceptada** por el usuario (decisión (b) de la Fase 0) · Fecha: 28/10/2026

## Contexto

La sección 5.2 del plan dice que E10 se añade como chip extra solo si un porcentaje relevante de estaciones lo ofrece. En la Fase 0, `Precio Gasolina 95 E10` aparece en 28 de 11.417 estaciones (0,25 %).

## Decisión

- No se añade el chip E10. «Gasolina 95» es siempre E5.
- `fuels` tiene **6 combustibles**, no 7: `["g95e5","g98e5","goa","goap","glp","gnc"]`. Cada fila de `prices.json` tiene 6 valores (el ejemplo de la sección 5.2 del plan, con 7 y `g95e10`, queda sustituido).
- El campo E10 de la API se ignora en la ingesta.

## Consecuencias

- Esas 28 estaciones solo aparecen si venden otro de los 6 combustibles.
- Si E10 gana cobertura, se añade al final de `fuels` y se sube `schemaVersion`.
