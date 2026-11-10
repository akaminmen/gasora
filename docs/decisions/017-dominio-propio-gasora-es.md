# 017 — Dominio propio: gasora.es, con la web en la raíz

Estado: **implementada y verificada con tests en local; la web real bajo el dominio y la redirección desde la URL antigua solo se pueden comprobar tras el despliegue (`npm run verify:site`)** · Fecha: 09/11/2026

## Contexto

La web se publicó en `https://akaminmen.github.io/gasora/`, una subruta del dominio de GitHub Pages, y se compilaba con la base `/gasora/`. Se ha añadido el dominio propio `gasora.es` en Settings → Pages (DNS en el registrador, dominio verificado, certificado aprobado). Con un dominio propio GitHub Pages sirve el artefacto en la **raíz** (`https://gasora.es/index.html`, no `…/gasora/index.html`), así que una build con base `/gasora/` carga el HTML pero pide `/gasora/assets/…`, que da 404: la página se queda en blanco.

## Decisión

- La build usa la base `/` y la dirección pública `https://gasora.es/` (`GASORA_BASE` y `GASORA_SITE` en `deploy.yml`; el valor por defecto de `vite.config.ts` para la base `/` es también `https://gasora.es/`).
- La dirección canónica, Open Graph, `robots.txt`, `sitemap.xml` y el manifiesto (`start_url`, `scope`, `id`, atajos) salen de esa base.
- **No hay fichero `CNAME` en el repositorio.** Con el despliegue por Actions (Source: GitHub Actions) el dominio se configura en Settings → Pages y un `CNAME` en el artefacto se ignora.
- `npm run compare:published` y `GASORA_PREVIOUS_URL` leen `https://gasora.es/`. La URL antigua redirige (301) y el `fetch` la sigue, así que habría funcionado igual, pero se apunta a la dirección definitiva para no depender de la redirección.
- Se mantiene la capacidad de servir en una subruta (el código usa `import.meta.env.BASE_URL` en todas partes): no hay ninguna ruta `/gasora/` escrita a mano.

## Cómo queda garantizado que el primer despliegue siempre despliega

1. El primer despliegue tras el cambio es un `push` a `main`, y los `push` **siempre** despliegan (ADR 016).
2. Además, `version.json` lleva ahora la **dirección con la que se compiló** (`site`) y `compare:published` omite el despliegue solo si coincide con la actual (`SITE_URL`). El `version.json` publicado hoy no tiene ese campo: cualquier ejecución programada que llegara antes de que se publique la build nueva vería «lo publicado no indica la dirección» y desplegaría. Lo mismo ocurre si algún día se vuelve a cambiar de dominio o de base, aunque los datos sean idénticos.
3. Sigue fallando abierto: cualquier error al leer lo publicado despliega.

## Comprobación de lo publicado

- `npm run check:build` (en cada despliegue, antes de subir el artefacto) comprueba que `version.json` lleva la dirección y que todos los ficheros que pide `index.html` están bajo la ruta base de esa dirección. Una build con la base equivocada falla en la CI, antes de publicarse.
- `npm run verify:site [dirección]` (solo lectura, a mano tras un despliegue) descarga la web publicada, extrae scripts, hojas de estilo, precargas, iconos, imagen social y manifiesto, y comprueba que todo responde **200 con un tipo de contenido coherente** (un 200 con HTML donde debería haber un script cuenta como fallo). También comprueba `start_url` y `scope` del manifiesto, `version.json`, `data/meta.json`, `sw.js`, `robots.txt`, `sitemap.xml` y `404.html`. Sale con código 1 si algo falla.
- **No se añade como paso de `deploy.yml`** en esta decisión (la edición de `deploy.yml` autorizada era solo para la URL). Sería razonable un trabajo final con `continue-on-error: true`, que solo se ejecutara cuando hubo despliegue, con reintentos (la CDN de Pages puede tardar uno o dos minutos en servir lo nuevo) y que emitiera `::warning::` en lugar de poner la ejecución en rojo. Queda como propuesta.

## Enlaces profundos

`/favoritos`, `/calculadora`, `/acerca` y `/e/<id>` no son ficheros: GitHub Pages responde con `404.html` (copia de `index.html`, con estado 404) y la aplicación resuelve la ruta. Con la base `/` los ficheros se piden con rutas absolutas desde la raíz, así que funcionan en cualquier profundidad. `tests/e2e/deep-links.spec.ts` reproduce ese comportamiento con un servidor que devuelve `404.html` con estado 404, y comprueba la visita directa, la recarga y que no haya ningún fichero con 404.

## Qué le pasa a quien ya tenía la web

Esto es lo que se sabe por cómo funcionan los navegadores y GitHub Pages; **no está probado con una instalación real** y no hay migración automática posible.

- **El origen cambia.** `akaminmen.github.io` y `gasora.es` son orígenes distintos. El almacenamiento (`gasora:favorites:v1`, `gasora:theme:v1`, `gasora:fuel:v1`, `gasora:liters:v1`), las cachés y el service worker son **por origen**: los favoritos, el tema, el combustible y los litros elegidos en la web antigua **no se trasladan** a `gasora.es`, y desde `gasora.es` no se puede leer el almacenamiento del otro origen. Quien entre en `gasora.es` empieza sin favoritos. No hay solución técnica sin mantener una página en el origen antiguo, y `github.io/gasora/` ya solo redirige. Habría que volver a marcar los favoritos.
- **Quien tenga la PWA instalada desde `github.io/gasora/`** la sigue teniendo: su service worker antiguo sirve la aplicación desde la caché (precarga) sin pedirla a la red. Pero esa copia **queda congelada**: la comprobación de actualización pide `/gasora/sw.js`, que ahora redirige (301) a otro origen, y los navegadores no aceptan que el script de un service worker venga de una redirección, así que no se actualiza. Los datos (`/gasora/data/…`) no están en la precarga y se piden a la red: pasan por la redirección y puede que el navegador los admita o no (depende de las cabeceras CORS de la redirección); si no, la app antigua mostrará su aviso de datos sin conexión. No se sabe con certeza cuál de las dos cosas ocurre.
- **Qué hacer:** abrir `https://gasora.es/`, instalar la PWA nueva (es otra aplicación para el sistema: otro `id`/`scope`) y desinstalar la antigua. Los enlaces antiguos a `github.io/gasora/…` redirigen (301) a `gasora.es/…` conservando la ruta, así que un enlace a una ficha antigua abre la ficha nueva.
- No se ha escrito ninguna migración ni un service worker «de limpieza» en el origen antiguo: no es posible desplegar nada allí mientras el dominio propio esté activo.

## Alternativas descartadas

- **Dejar la base `/gasora/` y servir `gasora.es/gasora/`:** habría que mover el contenido a una subcarpeta del artefacto y la raíz de `gasora.es` quedaría vacía o redirigiendo. No tiene sentido con un dominio propio.
- **Mantener las dos direcciones sirviendo la web a la vez:** GitHub Pages redirige la antigua a la nueva en cuanto hay dominio propio; no se puede servir en ambas.
- **Añadir `public/CNAME`:** innecesario con el despliegue por Actions.
- **Una base relativa (`./`):** rompería las rutas profundas (`/e/<id>` pediría `/e/assets/…`).

## Consecuencias

- Las URL son más cortas y no dependen del nombre del repositorio.
- Los favoritos y ajustes de quien usaba la dirección antigua se pierden (ver arriba).
- La ruta base ya no sigue al nombre del repositorio: renombrarlo no cambia la web.
- Queda pendiente activar «Enforce HTTPS» en Settings → Pages (el certificado está aprobado); hasta entonces `http://gasora.es/` también responde.

## Cómo se revierte

1. En Settings → Pages, quitar el dominio personalizado (la web vuelve a `https://akaminmen.github.io/gasora/`).
2. En `deploy.yml`: `GASORA_BASE: /${{ github.event.repository.name }}/`, `GASORA_SITE: https://akaminmen.github.io/gasora/`, y `GASORA_PREVIOUS_URL` y `SITE_URL` con esa dirección. El valor por defecto de `vite.config.ts` ya calcula `github.io` + base cuando la base no es `/`.
3. En `tests/e2e/pwa.spec.ts`, `playwright.config.ts` y `package.json` (`build:e2e:base`, `preview:base`) volver a la base `/gasora/` y a las direcciones de `github.io`.
4. Desplegar. La build compara su `site` con lo publicado y, al ser otra, despliega sola.
5. Se vuelve a perder el almacenamiento y la PWA instalada del dominio propio (otro origen).
