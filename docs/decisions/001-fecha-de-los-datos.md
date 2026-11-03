# 001 — Qué fecha mostrar como «actualización de los datos»

Estado: **aceptada** por el usuario (decisión (a) de la Fase 0) · Fecha: 28/10/2026

## Contexto

El plan (secciones 3.3 y 9.6) mostraría «Datos del Ministerio actualizados el dd/mm/aaaa hh:mm» usando el campo `Fecha` de la API. En la Fase 0 se comprobó que `Fecha` es **la hora de la consulta**, no la de actualización de los precios: dos llamadas separadas 32 s devolvieron horas distintas con datos idénticos. La API no ofrece otra fecha. La `Nota` dice que se actualiza cada media hora.

## Decisión

- `meta.json` guarda `generatedAt` (cuándo se generaron los ficheros) y `sourceDate` (la `Fecha` de la API convertida de hora de Madrid a UTC).
- La interfaz muestra: «Datos del Ministerio consultados el dd/mm/aaaa, hh:mm». No se afirma ninguna frecuencia de actualización, porque no está medida (la versión inicial añadía «Se actualizan cada 30 minutos aproximadamente» y se retiró).
- No se usa «actualizados» como si fuera la hora de cambio de los precios.

## Consecuencias

- Honesto con lo que se sabe; respeta la regla de licencia de citar la fecha sin alterar el contenido.
- Cambia el literal de la sección 9.6 del plan y el del diseño aprobado («actualizados el 28/10/2026 a las 07:30»).
- El texto de atribución del pie (sección 3.4) debe usar la misma fórmula; el literal exacto sigue marcado [VERIFICAR] (ver ADR 007).
- La cadencia real se mide con `npm run cadence` (resultado en `docs/cadencia.json`). Medición del 28/10 al 30/10/2026 (41,6 h): en 6.469 de 11.336 estaciones (57 %) cambió algún precio, con 34 estaciones nuevas y 27 retiradas. Es compatible con una actualización diaria; con dos mediciones separadas por días no se puede confirmar ni descartar la cadencia de 30 minutos que dice la `Nota` de la API. Para afinarla hacen falta mediciones cada pocas horas durante un día.
