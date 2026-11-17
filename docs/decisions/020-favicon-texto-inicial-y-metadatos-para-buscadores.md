# 020 — Favicon, texto en el HTML inicial y metadatos para buscadores

Estado: **texto inicial, metadatos y datos estructurados: implementados y publicados. Rediseño del favicon: REVERTIDO por decisión del usuario (17/11/2026). Lo que ven Google y Bing no se ha podido comprobar** · Fecha: 17/11/2026

> **Reversión del favicon (17/11/2026).** El rediseño del favicon (pin blanco sobre cuadrado índigo, ICO de 16/32/48 px, PNG de 48 px, icono de iOS a sangre) se hizo y se subió **sin que el usuario lo aprobara**, y el usuario no lo aprobó: quiere conservar el icono de siempre. Se restauraron **byte a byte** (comprobado con sha256) `public/favicon.svg`, `public/favicon.ico` y `public/apple-touch-icon.png` desde el último commit con los iconos originales (`01ac113`), se eliminaron `public/favicon-48x48.png` y `public/logo-mark.svg`, y se devolvieron al estado anterior `scripts/make-icons.ts`, las tres etiquetas de icono del `<head>`, `includeAssets` de `vite.config.ts`, las comprobaciones de `check:build` y las pruebas de iconos. Los iconos de la PWA y la imagen para compartir nunca cambiaron y siguen idénticos. **Se conserva todo lo demás** (texto inicial, metadatos, Twitter, JSON-LD, `lastmod`, pruebas). La sección «Favicon» de abajo describe lo que se hizo y **ya no está vigente**; la mejora técnica queda como propuesta (sección «Propuesta de favicon, sin aplicar»). **Regla:** nada visible de la marca (logotipo, favicon, colores, tipografías, iconos, imágenes para compartir, apariencia) se cambia sin la aprobación previa del usuario.

## Problema

`https://gasora.es/` aparece en Google con el icono genérico gris y en Bing figura como «Discovered but not crawled». La aplicación es una página de una sola página: el HTML inicial no tenía texto (un `<div id="root">` vacío y una frase en `<noscript>`).

## Parte A: auditoría (17/11/2026, sobre lo publicado)

| Comprobación                                                                | Resultado                                                                                                                                                                                                              |
| --------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Las 5 pantallas (`/`, `/acerca`, `/instalar`, `/favoritos`, `/calculadora`) | **200**, `Cache-Control: max-age=600`, `lang="es"`, título, descripción y canónica propios (`https://gasora.es/…`)                                                                                                     |
| Open Graph / Twitter                                                        | OG completo (imagen 1200 × 630, `image/png`, 313 KB); Twitter solo con `twitter:card` (sin título, descripción ni imagen propios)                                                                                      |
| Etiqueta `robots`                                                           | **Ninguna** en las rutas con 200 (no hay `noindex` donde no debe); `404.html` lleva `noindex` a propósito                                                                                                              |
| Datos estructurados                                                         | **Ninguno**                                                                                                                                                                                                            |
| Texto en el HTML inicial                                                    | **17 palabras** (la frase de `<noscript>`); `h1`: ninguno; enlaces: ninguno. Las cinco pantallas eran el mismo HTML salvo etiquetas del `<head>` (12 líneas de diferencia)                                             |
| `robots.txt`                                                                | `User-agent: *`, `Allow: /`, `Sitemap: https://gasora.es/sitemap.xml`; no bloquea nada. Con los agentes `Googlebot-Image`, `Google Favicon` y `bingbot` el servidor responde 200 a `/`, `/robots.txt` y `/favicon.ico` |
| `sitemap.xml`                                                               | 5 direcciones con 200, sin `lastmod`                                                                                                                                                                                   |
| Iconos declarados                                                           | `favicon.svg` (`image/svg+xml`, 858 B), `favicon.ico` (`sizes="48x48"`; contenía solo **32 y 48 px**, sin 16), `apple-touch-icon.png` (180 × 180, sin `sizes`). Los PNG de 192 y 512 solo estaban en el **manifiesto** |
| Cabeceras de los iconos                                                     | todos `200`, tipo correcto (`image/svg+xml`, `image/vnd.microsoft.icon`, `image/png`), `max-age=600`, sin `X-Robots-Tag`                                                                                               |
| Forma del favicon                                                           | pin con surtidor y dos ondas, **sin fondo** (transparente) y con detalles finos: a 16 px la silueta se pierde y las ondas índigo claro quedan sobre el fondo de la pestaña                                             |

### Causa más probable del icono gris

1. **Que Google aún no haya procesado el favicon** del sitio nuevo (la causa más probable). La web pasó a `gasora.es` el 9–10/11/2026, hace una semana; Google refresca los favicons por separado y la documentación avisa de que puede tardar «días o semanas». Evidencia a favor: el icono está declarado en el `<head>` de la portada, responde 200 con el tipo correcto a los agentes de Google y de Bing y `robots.txt` no bloquea nada.
2. **Debilidades que había en los iconos** (observadas en la auditoría; **no se corrigen**, ver la reversión y la propuesta): ICO sin 16 px y con un solo tamaño declarado, ningún PNG en múltiplo de 48 declarado en el `<head>` (Google recomienda un favicon cuadrado en múltiplo de 48 px) y una forma poco legible a 16 px sobre transparente.
3. **Descartado:** ruta con la base antigua `/gasora/` (los iconos usan rutas absolutas desde la raíz), tamaño inválido (todos válidos), `noindex` o bloqueo en `robots.txt`.

**No se puede verificar desde aquí:** qué tiene hoy Google en su caché de favicons, ni cuándo lo recogerá; qué hace Bing. Hay que mirarlo en Search Console y en Bing Webmaster Tools (pasos manuales en `docs/STATUS.md`).

### Causa de «Discovered but not crawled» en Bing (no verificable)

Significa que Bing conoce la dirección (por el sitemap o un enlace) y todavía no la ha rastreado: suele ser cuestión de tiempo y de la prioridad que da a un dominio nuevo, no de un bloqueo (el servidor responde 200 a `bingbot` y `robots.txt` lo permite). Lo que sí se puede mejorar es lo que encontrará cuando venga: HTML con texto, enlaces entre páginas, metadatos propios y datos estructurados.

## Parte B: decisiones

### Favicon (rediseño revertido: esta sección es histórica)

- `public/favicon.svg`: **cuadrado** con esquinas redondeadas, fondo índigo `#4F46E5` y el **pin en blanco** (con el surtidor en índigo), sin las ondas: legible a 16 px. Medido por píxeles: el pin ocupa el 19 % del icono a 16 px, el 26 % a 32 px, con contraste blanco sobre índigo de 6,3:1. **No he visto la imagen** (revisión visual pendiente).
- `public/logo-mark.svg`: el logotipo completo anterior (con ondas, transparente). Es la fuente de los iconos de la PWA y de la imagen para compartir, que **no cambian** (los PNG se regeneraron y son idénticos byte a byte).
- `npm run icons` genera `favicon.ico` con **16, 32 y 48 px**, `favicon-48x48.png` y `apple-touch-icon.png` (180 px a sangre, sin esquinas redondeadas: iOS pone las suyas).
- `<head>` de `index.html` y de las páginas estáticas: `favicon.ico` (`sizes="16x16 32x32 48x48"`), `favicon.svg` (`sizes="any"`), `favicon-48x48.png`, `icons/icon-192.png` (192 px) y `apple-touch-icon.png` (`sizes="180x180"`). El PNG de 512 y el _maskable_ siguen solo en el manifiesto (declarar el de 512 en el `<head>` haría que algunos navegadores lo reduzcan para la pestaña). `theme-color` `#4F46E5`, igual que el manifiesto. Rutas absolutas desde la raíz (base `/`). Nada bloqueado en `robots.txt`.

### Texto en el HTML inicial

- Cada pantalla pública lleva dentro de `#root` un bloque `<main class="static-intro">` con un `h1`, uno o dos párrafos y los enlaces a las demás pantallas, y un `<noscript>` con el aviso de que hace falta JavaScript. Los textos salen de `src/lib/page-meta.ts` (única fuente, la misma del título y la descripción) y solo dicen lo que la web ya dice: fuente de los datos, búsqueda por código postal, municipio, provincia o ubicación, lista y mapa, favoritos, calculadora, sin registro ni cookies, instalación. **No hay ninguna afirmación sobre la frecuencia de actualización.**
- **Sin parpadeo, sin CLS y sin lectura doble:** el `<head>` añade la clase `js` a `<html>` antes del primer pintado y una regla `.js .static-intro { display: none }`. Con JavaScript el bloque no se ve ni está en el árbol de accesibilidad y la aplicación lo sustituye al arrancar (`createRoot` vacía `#root`); sin JavaScript (o en un rastreador que lee el HTML) se ve y se lee. Es decir, quien ejecuta JavaScript ve exactamente lo de antes. Un test bloquea los scripts de la aplicación y comprueba que el texto sigue oculto y que no hay ningún `h1` en el árbol de accesibilidad.
- **Rendimiento (Lighthouse móvil, servidor local que imita a GitHub Pages):** el texto añade ≈ 1,5 KB por página. Midiendo con y sin el bloque **bajo la misma carga** (el equipo estaba ocupado y las notas absolutas bajaron de 97–99 a 83–87 en ambas variantes), Inicio da 85–86 en las dos y Acerca 82–84 frente a 82–86: **sin diferencia**. El CLS no cambia (0,013 en Inicio, 0–0,017 en las demás). Detalle en `docs/STATUS.md`.
- **Qué no es:** no es prerenderizado de la aplicación; la lista, el mapa y los precios siguen necesitando JavaScript. Las fichas `/e/<id>` siguen sin indexarse (ADR 019).
- **Riesgo conocido:** si Google considerase el bloque «texto oculto», solo lo vería en el HTML sin renderizar, y es el mismo texto que ofrece la aplicación; no hay palabras clave ocultas.

### Metadatos

- `title` y `description` propios por pantalla con la marca «Gasora» (ya estaban, ADR 019); `canonical` y `og:url` con `https://gasora.es/…`; **Twitter**: `twitter:title`, `twitter:description`, `twitter:image` y `twitter:image:alt` (con la imagen de 1200 × 630 del logotipo de Gasora; sin logos de otras marcas); `og:image:type`.
- **Datos estructurados JSON-LD** solo en la portada: `WebSite` (`name`, `url`, `description`, `inLanguage: es`) y `WebApplication` (`name`, `url`, `description`, `applicationCategory: UtilitiesApplication`, `operatingSystem: Web`, `inLanguage: es`, `isAccessibleForFree: true`, `offers` de precio 0 EUR, `image`: el icono de 512 px). **No lleva `logo`**: esa propiedad no existe en `WebApplication` (es de `Organization`, `Brand` o `Product`) y el validador de schema.org la marcaría; el logotipo va como `image`.
- **Cómo validarlos:** (1) con el código publicado, abre <https://validator.schema.org/>, elige «Fetch URL» con `https://gasora.es/` y comprueba que detecta `WebSite` y `WebApplication` sin errores; (2) en el **Rich Results Test** de Google (<https://search.google.com/test/rich-results>) pega la dirección: detectará la aplicación, pero **no mostrará resultado enriquecido de «aplicación de software»** porque Google exige además `aggregateRating` o `review`, que no se pueden inventar; ese aviso no es un error del marcado. Localmente, `tests/e2e/seo.spec.ts` y `tests/unit/static-pages.test.ts` comprueban que es JSON válido con los tipos y valores esperados (no sustituyen a esas dos herramientas).
- `robots.txt`: sin cambios (ya permitía todo y declaraba el sitemap); un test comprueba que no hay `Disallow`. `sitemap.xml`: cada dirección lleva `lastmod` con la **fecha del commit que se compila** (`git log -1 --format=%cs`): cambia con el código y los textos y **no** con cada actualización de precios, porque los precios no están en las páginas del sitemap; así no se anuncia a los buscadores un cambio que no existe. Solo rutas con 200.

### Pruebas

`tests/e2e/seo.spec.ts` (proyecto `pwa`, servidor que imita a GitHub Pages): HTML inicial de cada pantalla (título, descripción, canónica, Open Graph y Twitter, ausencia de `noindex` y de etiqueta `robots`, un `h1`, más de 45 palabras, enlaces a las otras cuatro pantallas, `noscript`), títulos y descripciones no repetidos, JSON-LD válido solo en la portada, `404.html` con `noindex`, iconos declarados (existen, tipo y tamaño de cada uno, ICO con 16/32/48), manifiesto, imagen de 1200 × 630, `robots.txt`, sitemap con `lastmod` y todas sus rutas con 200, y el comportamiento con y sin JavaScript. `tests/e2e/static-a11y.spec.ts` (Chromium, Firefox y WebKit): axe, ausencia de desbordes de 320 a 1440 px en claro y oscuro, y teclado sobre el texto inicial. `scripts/check-build.ts` falla si falta alguna de esas piezas en `dist/`.

## IndexNow (propuesta, sin aplicar)

[IndexNow](https://www.indexnow.org/) avisa a Bing (y a Yandex, Seznam, Naver…) de que una dirección ha cambiado; **Google no lo usa**.

- **Archivo clave:** una cadena de 8 a 128 caracteres (letras, números y guiones), p. ej. un UUID, y un archivo `public/<clave>.txt` cuyo contenido es esa misma cadena. Se publica en la raíz (`https://gasora.es/<clave>.txt`). Es público por diseño: demuestra que eres el dueño del dominio; no es un secreto, pero tampoco conviene reutilizarlo en otro sitio.
- **Llamada:** `POST https://api.indexnow.org/indexnow` con `{"host":"gasora.es","key":"<clave>","keyLocation":"https://gasora.es/<clave>.txt","urlList":[ …las 5 direcciones del sitemap… ]}`; respuestas `200` o `202` (aceptada), `403` (clave no encontrada), `422` (direcciones que no son del dominio), `429` (demasiadas peticiones).
- **Cuándo, desde `deploy.yml` (no se ha tocado):** un paso final, después de `verify-site` y solo si **cambió el código y no solo los datos**. La señal ya existe: `compare:published` compara el commit publicado (`version.json`) con el de la ejecución; si son distintos (`el código publicado … no es el de esta ejecución`) hay código nuevo. Habría que exponerlo como salida (`code_changed`) y condicionar el paso a `needs.build.outputs.code_changed == 'true'` y a que `verify-site` haya visto el commit nuevo. Con `continue-on-error: true` y reintentos, para no poner en rojo un despliegue. En una actualización de precios (cada 15 minutos) **no** se envía nada.
- **Riesgos:** (1) enviar en cada ejecución de datos (≈ 100 al día) sería spam y podría hacer que Bing ignore o limite el dominio; (2) no garantiza el rastreo ni la indexación, solo el aviso; (3) la clave queda en el repositorio y en la web (inocua, pero visible); (4) si la clave desaparece del sitio, la API responde 403; (5) añade un paso a un workflow crítico: debe ser opcional y con tiempo límite; (6) las fichas `/e/<id>` no se enviarían nunca (no se indexan, ADR 019).
- **Alternativa sin código:** Bing Webmaster Tools → «Submit URLs» (hasta cientos al día) y subir el sitemap; o importar el sitio desde Google Search Console.

## Consecuencias

- Los rastreadores que no ejecutan JavaScript ven un texto propio en español y los enlaces entre páginas; quien ejecuta JavaScript no nota ningún cambio.
- El favicon vuelve a ser el de siempre; los iconos no cambian.
- **No se garantiza** que Google cambie el icono ni que Bing rastree: depende de ellos.

## Cómo se revierte

- Texto inicial: quitar el plugin `staticIntro()` de `vite.config.ts` (queda el marcador `<!--static-intro-->` vacío) y los marcadores de `index.html`.
- Favicon: ya revertido. Para reaplicar la propuesta de abajo haría falta la aprobación explícita del usuario (el commit del rediseño es `e2044a4`).

## Propuesta de favicon, sin aplicar

**Solo se haría con la aprobación explícita del usuario, viendo antes una muestra, y conservando el diseño original del pin** (el mismo dibujo, con sus colores y su fondo). La mejora técnica, que no cambia el dibujo:

- Un `favicon.ico` con **16, 32 y 48 px** generados a partir del mismo `favicon.svg` original (hoy lleva 32 y 48).
- Un `favicon-48x48.png` (Google recomienda un favicon cuadrado en múltiplo de 48 px) declarado en el `<head>`, y `sizes` en las etiquetas del SVG y del icono de iOS.
- Las comprobaciones de `check:build` y de `seo.spec.ts` se ampliarían a esos tamaños.

**Qué no se haría:** cambiar la forma, los colores, el fondo o las ondas del logotipo, ni recortarlo en un cuadrado. Si a 16 px el pin original se ve poco, **se propone al usuario y se espera**: no se decide aquí.

**Lo que probablemente explica el icono gris no es el dibujo** sino que Google aún no ha reprocesado el favicon del sitio nuevo (ver «Causa más probable»); no hay ninguna garantía de que cambiar el icono lo arregle antes.
