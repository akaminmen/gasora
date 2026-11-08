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

## Actualización (Fase 7c): la fecha es la de la última publicación

Desde que la ingesta omite compilar y desplegar cuando los datos publicados ya son iguales (`deploy.yml`, `scripts/compare-published.ts`), `sourceDate` es la hora de la consulta **con la que se publicaron** los datos, no necesariamente la de la última comprobación. La frase «Datos del Ministerio consultados el …» sigue siendo literalmente cierta (esos datos se consultaron entonces), por lo que no se cambia en el pie, en «Acerca de» ni en la atribución. «Acerca de» añade que, si una consulta no trae cambios, no se vuelve a publicar y la fecha puede ser anterior a la última comprobación. No se afirma ninguna frecuencia de actualización.

No se usa «última variación» porque dejaría de ser exacto: un despliegue de código (un `push`), uno manual con `force` o uno por duda (falla abierto) vuelven a publicar los mismos datos con una consulta más reciente. Si se quisiera esa redacción habría que guardar en `meta.json` una fecha del último cambio de contenido (`changedAt`), copiada de lo publicado mientras la huella no cambie.
