# 003 — Sin «Gasolina 95 Premium» ni otros productos extra en el MVP

Estado: **aceptada** por el usuario (decisión (c) de la Fase 0) · Fecha: 28/10/2026

## Contexto

La API trae 23 productos con precio. Con cobertura relevante y fuera del plan hay: Gasolina 95 E5 Premium (1.109 estaciones), Diésel Renovable (1.620), Gasóleo B (2.254, agrícola) y AdBlue (2.942).

## Decisión

- El MVP solo ofrece los 6 combustibles del plan: Gasolina 95, Gasolina 98, Diésel (Gasóleo A), Diésel premium, GLP y GNC.
- No se añade «95 Premium» ni ningún otro producto.
- Una estación que solo vende productos no incluidos se descarta (`sinCombustibleMvp`): en la Fase 0 eran 83.

## Consecuencias

- Las estaciones que venden 95 Premium pero no 95 E5 no aparecen en «Gasolina 95».
- Añadir productos más adelante es un cambio de `FUELS` y de `schemaVersion` (ver ADR 002).
