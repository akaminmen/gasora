# 013 — Favoritos, calculadora, ficha y URL compartible (Fase 5)

Estado: **implementada y verificada con tests; la apariencia está pendiente de revisión visual** · Fecha: 03/11/2026

## Favoritos (F8)

- Clave `gasora:favorites:v1`: un JSON con un array de `IDEESS`, el último guardado primero, máximo 100. Lo que no sea un array de identificadores numéricos se ignora (almacenamiento corrupto o manipulado).
- El corazón de las tarjetas, de la ficha lateral y de `/e/:id` comparten el mismo estado.
- La pantalla de favoritos muestra el precio actual del combustible elegido, con tramo y ahorro calculados contra las gasolineras a menos de 10 km (la «zona» de la estación). Si una estación ya no está en los datos, sale «Ya no disponible» con opción de quitarla; si no vende el combustible elegido, «No vende …».

## Ficha real `/e/:id` (F7, F14)

- Muestra el precio del combustible elegido (o el primero que venda, con un aviso), los seis precios, dirección, código postal, municipio, horario tal cual, fecha de consulta, «Cómo llegar» y «Compartir». Título de la pestaña con el nombre.
- «Compartir» usa la Web Share API y, si no existe, copia el enlace y lo avisa. Cancelar el diálogo no avisa de nada.
- Un id inexistente muestra «Esta gasolinera ya no está disponible» con salida (y quitar de favoritos si lo era).

## Calculadora (F9)

- Litros 1–120 (por defecto 50; botones de ±5, valores habituales y campo numérico) guardados en `gasora:liters:v1` y usados también para el «Ahorras X € por depósito» de las tarjetas.
- Compara la más barata de la zona buscada con la media de la zona o con la más cercana (esta última solo si hay un origen: ubicación o código postal). El ahorro nunca es negativo.
- El importe cuenta hasta su valor final en 0,7 s; con `prefers-reduced-motion` aparece ya final. El texto que cuenta es decorativo para lectores de pantalla; el valor final se anuncia aparte, una sola vez.
- Sin una búsqueda previa explica qué hacer.

## URL compartible (F14)

- `/?q=29002&fuel=g95e5&r=5&sort=price`. `q` es un código postal (`29002`), un municipio (`m4800`) o una provincia (`p29`); `x=1` marca un municipio ampliado; `r` el radio (1–50); `sort` solo si es `distance`.
- Se restaura al abrir el enlace (cargando el índice de búsqueda) y se mantiene al día con `replace`, sin añadir entradas al historial. Los parámetros inválidos se ignoran; una zona inexistente avisa y deja el inicio limpio.
- **La ubicación del usuario nunca se escribe en la URL** (privacidad): «cerca de ti» no es compartible.

## Pantallas secundarias en escritorio

Favoritos, calculadora, ficha y «Acerca de» van en una columna centrada de 720 px como máximo.

## Datos de los e2e

Los e2e ya no dependen de lo que publique el Ministerio ni de `public/data`: `npm run build:e2e` genera tras el build unos datos de prueba deterministas en `dist/data` (`scripts/e2e-data.ts`: la muestra de `fixtures/` con Málaga ×6 y Albacete ×4). Motivo: con los datos de demostración de la CI (140 estaciones), 12 tests de las Fases 3 y 4 fallaban, y los tests con datos reales cambian con el día. Los tests leen esos mismos ficheros (`tests/e2e/data.ts`).

## Prueba contra OpenFreeMap

`map-live.spec.ts` (estilos y atribución reales) queda fuera de `npm run test:e2e` (`testIgnore`) y se lanza con `npm run test:e2e:live` (`playwright.live.config.ts`: 2 reintentos, 1 trabajador, se omite si no hay red). En la CI va en un trabajo aparte (`map-live`) con `continue-on-error`, para que un fallo del servicio externo no rompa la integración.
