# 014 — PWA, sin conexión, teclado, navegadores y rendimiento (Fase 6)

Estado: **implementada y verificada con tests y Lighthouse; la prueba con lector de pantalla, el recorrido a mano y el aspecto quedan para el usuario** · Fecha: 04/11/2026

## PWA (manifiesto e iconos)

- `vite-plugin-pwa` 2.0.0 (Workbox 7.4.1) genera `manifest.webmanifest` y `sw.js`. El manifiesto toma `start_url`, `scope` e `id` de la **base** del build (`/gasora/` en GitHub Pages), también cuando se indica con `--base` en la línea de órdenes (se usa para probar la subruta en local).
- Iconos generados con `npm run icons` (`scripts/make-icons.ts`, renderizados con Chromium a partir de `public/favicon.svg`) y guardados en `public/`: 192 y 512 px «any» con fondo transparente, 512 px «maskable» (logo dentro del 80 % central, fondo de la marca), `apple-touch-icon.png` (180 px, sin transparencia), `favicon.ico` (32 y 48 px) e `og-image.png` (1200 × 630). Solo hay que volver a ejecutarlo si cambia el logo.
- Accesos directos del manifiesto: Favoritos y Calculadora.

## Service worker y sin conexión

- **Qué se guarda al instalar:** la aplicación entera (HTML, JS, CSS, fuentes, iconos), incluido el trozo del mapa y su worker (23 entradas, ≈ 2,2 MB sin comprimir), para que recargar sin red funcione también en los resultados. Las rutas de la aplicación (`/favoritos`, `/e/123`…) se sirven con `index.html` (`navigateFallback`); los ficheros con extensión y `/data/` no.
- **Datos:** los JSON de `/data/` **no** pasan por la caché del service worker. La app ya los guarda (con su fecha) en Cache Storage (`gasora-data-v1`, ADR 011) y avisa con «Sin conexión: mostrando datos del …». Se evita así un segundo nivel de caché que pudiera servir precios viejos sin avisar.
- **Aviso de falta de conexión:** una franja bajo la cabecera («Sin conexión. Verás los últimos datos guardados en este dispositivo.») y el aviso con fecha en los resultados. Al volver la conexión, los datos se vuelven a pedir solos y los avisos desaparecen. Antes, el refresco de precios al volver a la pestaña (`watchVisibility`) no llegaba a activarse nunca: ahora sí.
- **Teselas del mapa (límites de OpenFreeMap, ADR 007: 3.000 teselas o 50 MB por descarga, 4 peticiones en paralelo, User-Agent propio):**
  - **No hay descargas en bloque**: no se precargan teselas. Solo se guardan las que el usuario llega a ver (caché de ejecución, `CacheFirst`).
  - Tope de **600 teselas** (una quinta parte del límite) y 7 días de caducidad, con purga si el navegador se queda sin espacio. A 20–60 KB por tesela, entre 12 y 36 MB (< 50 MB). Estilo, sprites y TileJSON (`StaleWhileRevalidate`, 30 entradas) y tipografías (`CacheFirst`, 60 entradas) tienen cachés propias.
  - **Peticiones en paralelo y User-Agent:** al no haber descarga en bloque, el límite de 4 peticiones en paralelo no aplica a la app (cada tesela se pide cuando el mapa la necesita, como en cualquier visita). **Un navegador no permite cambiar el User-Agent de una petición** (cabecera prohibida): OpenFreeMap solo puede identificar la app por el origen de la página (`Origin`/`Referer`, `akaminmen.github.io`). Si exigieran un User-Agent propio habría que usar un proxy, y no se hace.
  - Las expresiones que deciden qué se guarda están en `scripts/pwa-caching.ts` y tienen tests unitarios (solo el host `tiles.openfreemap.org`, sin parámetros).

## Actualizaciones (no dejar a nadie con una versión vieja)

- `registerType: 'prompt'` con `skipWaiting` desactivado: la versión nueva se descarga y **espera**; activarla de golpe cambiaría los trozos de JS bajo una página abierta (los nombres llevan hash y los antiguos dejarían de existir).
- Con la app a la vista aparece «Hay una versión nueva de Gasora. [Actualizar]». Con la app **en segundo plano** (la pestaña pasa a oculta) se activa sola y recarga: no se pierde nada y nadie se queda semanas con una versión antigua. Se busca una versión nueva cada hora, al volver a la pestaña y al recuperar la conexión.
- La activación (`applyWaitingUpdate`) es propia: envía `SKIP_WAITING`, espera a `controllerchange` y recarga (con tope de 4 s). No se usa el reinicio de la biblioteca porque solo recarga si la actualización llega en los primeros 10 s tras abrir la página. Un test publica una «versión nueva» (servidor local que cambia `sw.js`) a los 11 s, y otro con la app en segundo plano.
- «Acerca de» muestra la versión y la confirmación del build (`Versión 0.1.0 (abc1234)`), para comprobar que la actualización ha llegado.
- Instalación: botón «Instalar Gasora» cuando el navegador ofrece el evento `beforeinstallprompt`; en iOS, la explicación de «Añadir a pantalla de inicio».

## SEO y compartir

Etiquetas Open Graph y Twitter con la imagen de 1200 × 630, URL canónica, descripción, `<noscript>`, `robots.txt` y `sitemap.xml` (inicio, favoritos, calculadora y «Acerca de»; las fichas `/e/:id` no se listan). Las direcciones absolutas salen de `GITHUB_REPOSITORY_OWNER` y de la base del build (`GASORA_SITE` las sustituye).

## Teclado y accesibilidad

- **Desplegable de marcas y menú «Cómo llegar»** (antes un `<details>`): Esc los cierra y devuelve el foco al botón, el foco entra al abrir y **da la vuelta** con Tab y Mayús+Tab, y pulsar fuera los cierra (`hooks/useDismissable.ts`). El de marcas tiene un botón «Hecho».
- Al cambiar de pantalla el foco pasa al contenido (`<main tabindex="-1">`); «Saltar al contenido» funciona. El enlace del pie pasó de «Más información» a «Más sobre los datos y el aviso legal» (Lighthouse: texto de enlace descriptivo).
- Tests en Chromium, Firefox y WebKit (`keyboard.spec.ts`): Esc, trampas de foco, foco tras navegar, enlace de salto y un recorrido con Tab por seis pantallas que exige un indicador de foco visible en cada parada y que no haya trampas. WebKit no tabula enlaces ni botones por defecto (ajuste de Safari), así que allí los tests de Tab se omiten.

## Navegadores

`layout.spec.ts` y `a11y.spec.ts` (axe) se ejecutan también en **Firefox y WebKit** (Playwright). Resultado: pasan los 420 tests de layout y axe (210 por motor) sin cambios en el CSS; **`calc()` dentro de `@container` funciona en los tres motores** (ADR 009). WebGL del mapa arranca en los tres (por software). No son los navegadores reales de los móviles (ver STATUS).

## Rendimiento (Lighthouse móvil, throttling simulado)

Medido contra el build de producción servido con gzip, como GitHub Pages:

| Pantalla    | Rendimiento | Accesibilidad | Buenas prácticas | SEO |
| ----------- | ----------- | ------------- | ---------------- | --- |
| Inicio      | 97–99       | 100           | 100              | 100 |
| Favoritos   | 95          | 100           | 100              | 100 |
| Calculadora | 93          | 100           | 100              | 100 |
| Acerca de   | 94          | 100           | 100              | 100 |

Cambios que lo hicieron posible: JS inicial de **446,6 KB (137,3 KB gzip) a 270,9 KB (84,8 KB gzip)** (pantallas, resultados y la carga de datos con zod van en trozos aparte; `lib/fuel-ids.ts` separa las constantes de zod), validación ligera de estaciones y precios en el navegador (cabecera + 40 filas repartidas; la ingesta ya valida todo con los esquemas completos), espacio reservado para lo que llega después (fecha del pie, tabla de «Acerca de», pie oculto mientras llega una pantalla) y descarga de los datos **diferida 3,5 s** en las pantallas que no los necesitan para mostrarse (inicio, «Acerca de», pie, calculadora sin búsqueda, favoritos vacíos).

**Límite de la medición:** las pantallas que necesitan los datos para mostrarse (resultados, ficha, favoritos con contenido, calculadora con búsqueda) sacan 40–70 de rendimiento en Lighthouse móvil, porque descargar ≈ 1,9 MB de JSON (≈ 470 KB en gzip) con 1,6 Mbps simulados tarda segundos, y el mapa añade ≈ 1,7 MB de JS. La nota del inicio es alta en parte porque los datos se piden pasados 3,5 s, fuera de la ventana de medición. Mejoras posibles (no hechas): datos por provincia en lugar de un fichero único, formato binario, `modulepreload` del mapa en cuanto se enfoca el buscador.
