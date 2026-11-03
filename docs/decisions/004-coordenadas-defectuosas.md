# 004 — Coordenadas defectuosas: descartar y registrar, no corregir

Estado: **aceptada** por el usuario (decisión (d) de la Fase 0) · Fecha: 28/10/2026

## Contexto

En la Fase 0 aparecieron 5 estaciones con coordenadas inservibles: 4 con `0,000000 / 0,000000` (IDEESS 11988, 16499, 12883 y 2115) y 1 con latitud y longitud intercambiadas (16268, Tui: `-8,659472 / 42,037472`).

## Decisión

- La ingesta **descarta** toda estación sin coordenadas, a `0,0` o fuera de España (latitud 27–44, longitud −19–5; incluye Canarias, Ceuta y Melilla).
- **No se corrigen**, ni siquiera las intercambiadas, para no alterar los datos del Ministerio (condición de la licencia, sección 3.4).
- Cada descarte se registra con ID, rótulo y motivo (`coordenadasACero`, `coordenadasIntercambiadas`, `fueraDeEspana`) en la salida de la ingesta y en el resumen del job de GitHub Actions.

## Consecuencias

- Esas estaciones no aparecen en la app aunque tengan precio.
- Está cubierto por tests con la muestra real (`tests/unit/dataset.test.ts`) y con casos sintéticos.
- Si el Ministerio corrige los datos, las estaciones vuelven solas.
