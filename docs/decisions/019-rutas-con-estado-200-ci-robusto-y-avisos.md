# 019 — Rutas con estado 200, CI robusto, privacidad exacta y avisos de datos

Estado: **implementada y verificada en local (Chromium, Firefox, WebKit); sin ejecutar todavía en el CI de Linux ni en producción** · Fecha: 16/11/2026

Responde a los hallazgos de la auditoría final del 12/11/2026 (I1–I3, I6–I8 y los menores).

## 1. Rutas con estado 200 (I3)

### Lo medido en GitHub Pages (12/11/2026, `gasora.es`)

| Petición                          | Respuesta                                         |
| --------------------------------- | ------------------------------------------------- |
| `/index`                          | **200** (sirve `index.html`)                      |
| `/404`                            | **200** (sirve `404.html`, con estado 200)        |
| `/data`, `/icons`, `/assets`      | **301** a la misma ruta con barra final           |
| `/data/`, `/icons/` (sin `index`) | 404                                               |
| `/favoritos` (antes)              | **404** con el HTML de la aplicación (`404.html`) |
| `//favoritos`                     | 404                                               |

Es decir, GitHub Pages sirve `/algo` con el fichero `algo.html` y estado 200 y **sin redirección**, y redirige los directorios a su dirección con barra.

### Decisión

El build escribe un `favoritos.html`, `calculadora.html`, `instalar.html` y `acerca.html` junto a `index.html` (`gasora-static-pages` en `vite.config.ts`, `scripts/static-pages.ts`). Cada uno es el `index.html` compilado con **su** `<title>`, descripción, dirección canónica y datos para compartir (`src/lib/page-meta.ts` es la única fuente; la aplicación usa los mismos textos con `usePageMeta`). Se descartó la alternativa `favoritos/index.html`: obliga a una redirección 301 a `/favoritos/` y cambia la dirección canónica.

- **Sitemap:** solo la portada y esas cuatro pantallas, **sin barra final** (todas con 200). `check:build` falla si el sitemap, los ficheros o los metadatos no coinciden, y si el service worker guarda los ficheros duplicados en la precarga.
- **Service worker:** sin cambios en `navigateFallback` (`index.html` para cualquier navegación). Los ficheros nuevos se excluyen de la precarga (`globIgnores`): son copias.
- **`/e/<id>` y rutas desconocidas** siguen con `404.html` (estado 404). Consecuencias: los buscadores no indexan las fichas de estación (11.400 direcciones sin prerenderizar) ni las dan como válidas; quien comparte un enlace a una ficha muestra la vista previa genérica de la portada; la aplicación funciona igual. Se añade `<meta name="robots" content="noindex">` solo a `404.html`, porque **`/404` responde 200** con ese mismo HTML y, sin `noindex`, sería un duplicado indexable de la portada. Prerenderizar las fichas queda fuera de alcance (v1.1 del plan).
- **Barra final:** `/favoritos/` no es un fichero ni un directorio: recibe `404.html` (404) y la aplicación lo resuelve igual. El router ignora la barra final. Los enlaces internos y el sitemap usan siempre la forma sin barra.
- **Pruebas:** `tests/e2e/deep-links.spec.ts` usa un servidor que imita lo medido (`.html` implícito, 301 de directorios, 404.html con 404), comprueba el **estado de cada documento**, título y canónica, y que `/404` lleva `noindex`. `npm run verify:site` descarga el `sitemap.xml` publicado y exige 200 con HTML en cada dirección, y que `version.json` lleve el commit esperado.
- **No verificado hasta publicar:** que el comportamiento de `favoritos.html` en producción es el medido con `/index` y `/404` (se infiere de esas dos pruebas). Tras el despliegue: `npm run verify:site` (ahora incluye el sitemap).

### Lighthouse (móvil, servidor local que imita a Pages: gzip, `max-age=600`, estado 200 en las cuatro pantallas)

| Pantalla    | Rendimiento | Accesibilidad | Buenas prácticas | SEO |
| ----------- | ----------- | ------------- | ---------------- | --- |
| Inicio      | 97–99       | 100           | 100              | 100 |
| Favoritos   | 99          | 100           | 100              | 100 |
| Calculadora | 99          | 100           | 100              | 100 |
| Instalar    | 95–97       | 100           | 100              | 100 |
| Acerca de   | 96–98       | 100           | 100              | 100 |

Producción (`https://gasora.es/`, Inicio, mismos ajustes): **97–98**. Las otras rutas no se pueden medir en producción hasta publicar (hoy dan 404 y Lighthouse se niega). El 90 de la auditoría procede de usar `--preset=perf` (perfil reducido) en una sola ejecución con LCP de 2,7 s; con los ajustes por defecto el LCP es de 1,4 s. Las cifras varían ±3 entre ejecuciones.

## 2. CI robusto (I1, I2)

- **Tiempos reales** (ejecuciones del 03 al 11/11/2026): `npm ci` 35–60 s; compilar y tests unitarios < 10 s; instalar los navegadores 15–120 s normalmente y hasta **650 s** con los espejos de apt lentos (y **7.644 s** el 11/11, con el DNS del runner caído); e2e 11–15 min con ≈ 900 pruebas (≈ 16–22 min estimados con las 1.258 actuales).
- **`ci.yml`:** `timeout-minutes` 45 (job `quality`) y 15 (`map-live`); 35 min para el paso e2e; instalación de navegadores en un bucle de 3 intentos con `timeout` de 360 s (150 s en `map-live`), espera creciente y `apt-get update` entre intentos; reintentos de apt (`Acquire::Retries 5`, tiempos de 30 s); caché de `~/.cache/ms-playwright` (clave: `package-lock.json`; solo evita la descarga, las dependencias de apt se instalan siempre); subida de `test-results` si falla. Solo acciones de `actions/*`.
- **Playwright:** con `CI=true`, `retries: 1`, traza en la repetición y reportero `github`. Una prueba que pasa a la segunda aparece como **flaky** en el informe; no se oculta, pero no pone el CI en rojo. Si se prefiere un CI estricto, basta quitar la línea `retries`.
- **Clasificación de los 17 rojos de las últimas 30 ejecuciones:**

| Causa                                                                                                     | Ejecuciones  | Tipo                                                               | Acción                                                                |
| --------------------------------------------------------------------------------------------------------- | ------------ | ------------------------------------------------------------------ | --------------------------------------------------------------------- |
| Red del runner (`playwright install --with-deps`, DNS)                                                    | 1 (2 jobs)   | Infraestructura                                                    | Reintentos, tiempos límite                                            |
| `npm ci` con TypeScript 7 (PR de Dependabot)                                                              | 1            | Regresión real, PR cerrada                                         | Regla de Dependabot (ADR 006)                                         |
| `licenses.test` con una versión nueva de `zustand`                                                        | 2            | Defecto del test (el índice llevaba versiones)                     | Corregido                                                             |
| Pruebas antiguas de la primera semana (clics que agotan el tiempo y un recuento), 4 ejecuciones del 03/11 | 4            | Regresión real, corregida en el código posterior                   | —                                                                     |
| Firefox sin WebGL en Linux (`layout.spec` «resultados reales», `explore-a11y`)                            | 5 (04–06/11) | Entorno del runner                                                 | Se omiten en Firefox sin WebGL (con motivo); ya no fallan desde 08/11 |
| `area-search` (3 pruebas distintas) y `keyboard` «Saltar al contenido»                                    | 4 (08–10/11) | **Flaky** (la misma confirmación pasa y falla con el mismo commit) | Esperas explícitas (ver abajo)                                        |

- **Carreras corregidas con esperas explícitas, sin subir tiempos:** el mapa publica ahora `data-moving` (entre `movestart` y `moveend`) y las pruebas esperan a que no se mueva y al mismo encuadre en tres lecturas (`settleMap`) en lugar de `waitForTimeout(700/900)` (afectaba al radio de 50 km, a la URL de la zona y a «Buscar en esta zona»); la altura compacta de la hoja se espera con `expect.poll` sobre la geometría, no sobre `data-snap`; y «Saltar al contenido» espera al encabezado de la pantalla y quita el foco antes del primer `Tab`. En local las dos hojas se repitieron 4 veces con 4 trabajadores (108 pruebas, sin fallos), una carga mayor que la del runner.
- **Causa de `keyboard` «Saltar al contenido» (sin confirmar):** la hipótesis es que el primer `Tab` caía en una pantalla a medio montar; el corte de red de Linux no se puede reproducir desde Windows. Si vuelve a aparecer, la traza guardada en el artefacto `resultados-e2e` lo dirá.
- **No se omite ninguna prueba en CI** por este motivo. Las que se omiten (Tab en WebKit, texto al 200 % en escritorio, Firefox sin WebGL) están en el README.
- **Primera ejecución de las 1.258 pruebas en Linux:** será el primer `push` posterior a esta tarea; el run del commit anterior (`187f614`) falló antes de empezar los tests (red) y no ha ejecutado ninguna. No puedo anticipar cuántas fallarán; lo medido en Windows (local, `CI=true`) está en `docs/STATUS.md`.

## 3. Privacidad (I6)

Antes: «No usamos cookies, ni analítica de terceros, ni te pedimos cuenta. Tus favoritos y preferencias (combustible, tema) se quedan en tu dispositivo. Tu ubicación nunca sale de él.» (omitía los litros, las cachés y que el mapa y el alojamiento ven la IP; y «nunca sale» no distinguía entre la ubicación del dispositivo y la zona del mapa que se pide a OpenFreeMap).

Ahora («Acerca de», tarjeta «Privacidad», y la misma información en README y `docs/licencias-y-atribuciones.md`): lista exacta de lo guardado (favoritos, combustible, tema, litros y las cachés de la aplicación), que la ubicación se usa solo en el dispositivo y no va a la URL salvo el centro del mapa de «Buscar en esta zona», que **OpenFreeMap** (teselas, y con ellas la zona que se mira) y **GitHub Pages** (alojamiento) ven la IP, y que «Cómo llegar» abre servicios de terceros con las coordenadas de la estación. Un test (`privacy.spec.ts`) comprueba que las claves guardadas son exactamente esas cuatro y que el texto las menciona. **No** se ha redactado una política legal; es información. Propuesta sin aplicar: redondear el centro de la URL de zona a 3 decimales (≈ 110 m).

## 4. Ingesta silenciosa (I7)

**Problema:** si la API del Ministerio falla, la ingesta conserva el último dato bueno y la ejecución sale en **verde**; nadie lo nota.

**Medición:** `sourceDate` es la fecha que devuelve la API en cada descarga y coincide con la hora de la descarga (3–5 s de diferencia en las 4 mediciones de `docs/cadencia.json`); con datos de reserva se queda quieta.

**Decisión (lo menos invasivo):**

1. `npm run check:freshness` (en `build`, tras `check:data`, con `continue-on-error`): calcula la antigüedad de `sourceDate` y publica las salidas `age_hours` y `alert`. Nunca falla por sí mismo, así que **no cambia** «si no hay datos válidos, falla sin desplegar» ni el despliegue con datos de reserva.
2. Un último trabajo, `data-freshness` (`needs: [build, deploy]`, `if: always() && …`), falla cuando `alert` es `true`. Así GitHub envía el correo de fallo.
3. **Umbral de 6 h:** con el disparador cada 15 min son ≈ 24 descargas fallidas seguidas (una interrupción corta del Ministerio no avisa) y es menos que la jornada de precios (el dato no es de un día). **Para no enviar 4 correos por hora**, `alert` solo vale `true` en una ventana de 15 min al cruzar las 6 h y una vez cada 24 h mientras dure (`scripts/check-freshness.ts`, con tests de que exactamente una ejecución por ventana cae dentro con un disparo cada 15 min).

**Correos de GitHub** (documentación consultada el 16/11/2026, [Notifications for workflow runs](https://docs.github.com/en/actions/monitoring-and-troubleshooting-workflows/notifications-for-workflow-runs)): recibes un aviso de las ejecuciones **que has lanzado tú** y puedes limitarlo a las fallidas; las programadas (`schedule`) avisan al usuario que **creó el workflow** o el último que modificó el `cron`. La página no menciona `workflow_dispatch` por API: se espera que el aviso vaya al propietario del token (tú), **sin verificar**; ajusta Settings → Notifications → Actions («Send notifications for failed workflows only»). **Prueba pendiente:** simular una caída (p. ej. `FRESHNESS_ALERT_HOURS=0` en una ejecución manual de prueba) y comprobar que llega el correo; no se ha hecho para no romper el despliegue.

**Propuesta sin aplicar:** un aviso en la propia web cuando `meta.sourceDate` tenga más de 6 h («Los precios llevan X horas sin actualizarse; es posible que el Ministerio tenga una incidencia»), con la misma regla que el aviso de «Hay precios nuevos». No se aplica porque cambia la interfaz y requiere decidir el texto y el umbral.

## 5. Verificación tras el despliegue (decisión del usuario)

`deploy.yml` tiene un trabajo `verify-site` que solo corre si el despliegue fue correcto: ejecuta `npm run verify:site` contra `https://gasora.es/` con `EXPECT_SHA=${{ github.sha }}`, hasta 6 intentos con 40 s de espera (la CDN tarda uno o dos minutos), escribe el resultado en el resumen del job y, si no cuadra, deja un `::warning::` **sin poner la ejecución en rojo** (`continue-on-error`). Los tres YAML se validan con `tests/unit/workflows.test.ts` y el paquete `yaml`.

## 6. Límite de 60 días (I8)

Sin aplicar (el Worker está fuera del repositorio y no se debe tocar): el fragmento para `C:\dev\gasora-trigger` está en `docs/disparo-externo.md` («Autorreparación diaria»): un reloj diario comprueba `state` y llama a `PUT …/enable`, y un `422` en el disparo reintenta tras reactivar. La documentación de GitHub **no define «actividad»**; la red de seguridad no depende de adivinarlo.

## Otros cambios

- `LICENSE` queda con el texto MIT estándar (GitHub lo reconoce); la aclaración sobre datos, teselas y logos pasa a `docs/licencias-y-atribuciones.md` («Alcance de la licencia MIT»), al README y a la web.
- `vite.config.ts` sin avisos de carga nativa: extensiones `.ts` en las importaciones (`allowImportingTsExtensions` en `tsconfig.json`) e importación por defecto de `package.json`.
- `tests/unit/licenses.test.ts` ignora las versiones también en el índice: una actualización de Dependabot de una dependencia de producción ya no lo pone en rojo (el archivo publicado se sigue regenerando con `npm run licenses`).
- `docs/operacion.md`: runbook.

## Consecuencias

- Las cuatro pantallas estáticas responden 200 y tienen título propio; `/e/<id>` sigue con 404 y `noindex`.
- Un fallo prolongado del Ministerio llega al correo del propietario.
- El CI tarda como mucho 45 min y no se queda colgado por la red; las pruebas que pasan a la segunda se ven como «flaky» en el informe.

## Cómo se revierte

- Rutas: quitar `staticPages()` de `vite.config.ts` (vuelve `spaFallback`: copia de `index.html` a `404.html` sin `noindex`) y el sitemap a la lista anterior.
- Reintento de Playwright: quitar `retries` en `playwright.config.ts`.
- Aviso de datos: quitar los trabajos `data-freshness` y `verify-site` y el paso `freshness` de `deploy.yml`.
