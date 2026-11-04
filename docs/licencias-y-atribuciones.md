# Licencias y atribuciones

Revisión de todo lo que Gasora distribuye o muestra: datos, mapa, fuentes, librerías, logos, código propio e imágenes generadas. Fecha: 04/11/2026. Este documento es informativo y no sustituye a la lectura de las licencias originales ni a asesoramiento jurídico.

## Resumen

| Elemento                                                                         | Origen                                                                                                                             | Licencia o condiciones                                                                                                                         | Atribución en la web                                                                                                                                           | Estado                                                                                                                                                              |
| -------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Precios y estaciones                                                             | Ministerio para la Transición Ecológica y el Reto Demográfico, «Precio de carburantes en las gasolineras españolas» (datos.gob.es) | Reutilización de la información del sector público (Ley 37/2007). El catálogo no publica un texto de licencia                                  | «Acerca de», pie de página y README                                                                                                                            | **Literal exacto de atribución pendiente de verificar** ([ADR 001](decisions/001-fecha-de-los-datos.md), [ADR 007](decisions/007-atribuciones-y-limites-de-uso.md)) |
| Teselas y estilos del mapa                                                       | [OpenFreeMap](https://openfreemap.org), con datos de OpenStreetMap y esquema de OpenMapTiles                                       | Datos: ODbL (OpenStreetMap contributors). Esquema y diseño: CC-BY 4.0 (OpenMapTiles). Servicio gratuito, sin clave; condiciones propias de uso | En la esquina del mapa (MapLibre), en «Acerca de» y en la ilustración del inicio («OpenFreeMap © OpenMapTiles Data from OpenStreetMap»)                        | Cumplido; límites de uso en el [ADR 007](decisions/007-atribuciones-y-limites-de-uso.md) y [ADR 014](decisions/014-pwa-sin-conexion-teclado-y-rendimiento.md)       |
| Fondo de la ilustración del inicio                                               | Captura de OpenFreeMap (Málaga) generada con `npm run hero-map`                                                                    | Misma que las teselas (ODbL y CC-BY 4.0)                                                                                                       | Rótulo dentro de la ilustración                                                                                                                                | Cumplido                                                                                                                                                            |
| Fuentes tipográficas                                                             | Inter y Plus Jakarta Sans, paquetes `@fontsource-variable/*`, autoalojadas                                                         | SIL Open Font License 1.1                                                                                                                      | No exige atribución visible; exige conservar el aviso de copyright y la licencia al redistribuir                                                               | Cumplido: el texto de la OFL de cada fuente está en `licencias-de-terceros.txt`                                                                                     |
| Librerías                                                                        | Ver tabla de más abajo                                                                                                             | MIT, ISC, BSD-2/3-Clause, OFL-1.1                                                                                                              | Conservar el aviso de copyright y la licencia                                                                                                                  | Cumplido: `licencias-de-terceros.txt`, enlazado desde «Acerca de»                                                                                                   |
| Iconos de interfaz                                                               | `lucide-react`                                                                                                                     | ISC                                                                                                                                            | Aviso de copyright en la licencia del paquete                                                                                                                  | Cumplido: `licencias-de-terceros.txt`, enlazado desde «Acerca de»                                                                                                   |
| Código de Gasora                                                                 | Este repositorio                                                                                                                   | MIT © 2026 Balta Caro ([LICENSE](../LICENSE))                                                                                                  | README                                                                                                                                                         | Cumplido                                                                                                                                                            |
| Logo e iconos de Gasora (`favicon.svg`, iconos de la PWA, imagen para compartir) | Propios                                                                                                                            | MIT, como el código                                                                                                                            | —                                                                                                                                                              | Cumplido                                                                                                                                                            |
| Logos de marcas (`public/brands/`)                                               | Aportados por el propietario del proyecto                                                                                          | **Marcas de sus respectivos propietarios; no están bajo la licencia MIT**                                                                      | «Los logos son marcas de sus respectivos propietarios y se muestran solo para identificar la estación; Gasora no está afiliada a ellas» (README y «Acerca de») | **El origen y el permiso de cada archivo los debe confirmar el propietario**                                                                                        |
| Alojamiento                                                                      | GitHub Pages                                                                                                                       | Condiciones de uso de GitHub                                                                                                                   | —                                                                                                                                                              | —                                                                                                                                                                   |

## Datos del Ministerio

- Fuente: Ministerio para la Transición Ecológica y el Reto Demográfico. Servicio REST de «Precios de carburantes en las gasolineras españolas», publicado en datos.gob.es.
- Marco: Ley 37/2007, de reutilización de la información del sector público. El catálogo declara actualización diaria, pero no incluye un texto de licencia ni un literal de atribución.
- Texto provisional que muestra la web: «Fuente: Ministerio para la Transición Ecológica y el Reto Demográfico — Precio de carburantes en las gasolineras españolas (datos.gob.es). Datos consultados el {fecha}.» La fecha que se muestra es la de la **consulta** al Ministerio, no la de actualización de los precios (ADR 001).
- Gasora es un proyecto independiente, no afiliado ni respaldado por el Ministerio; los precios pueden diferir de los del surtidor.
- **Pendiente:** contrastar el literal con el aviso legal de la sede del Ministerio y con la ficha del conjunto en datos.gob.es, y sustituirlo si exigen otro.

## Mapa

- **OpenFreeMap** sirve estilos, tipografías y teselas sin clave ni registro. Sus condiciones piden mantener la atribución «© OpenMapTiles, Data from OpenStreetMap» (MapLibre la muestra desde el propio estilo) y limitan las descargas sin conexión a 3.000 teselas o 50 MB por descarga, con 4 peticiones en paralelo como máximo y un `User-Agent` que identifique la aplicación.
- Gasora no hace descargas masivas: solo guarda las teselas que se llegan a ver (600 como máximo, 7 días). Un navegador no permite fijar el `User-Agent`, así que OpenFreeMap solo ve el origen de la página.
- **OpenStreetMap:** los datos son © OpenStreetMap contributors y están bajo la Open Database License (ODbL). **OpenMapTiles:** el esquema y el diseño de las teselas están bajo CC-BY 4.0.
- Las dos capturas del fondo de la ilustración (claro y oscuro) son obras derivadas de esos datos y llevan la atribución dentro de la imagen.

## Fuentes tipográficas

Inter (© The Inter Project Authors) y Plus Jakarta Sans (© The Plus Jakarta Sans Project Authors) se distribuyen con la licencia SIL Open Font License 1.1, que permite el uso, la redistribución y la incrustación en una web siempre que se conserve el aviso de copyright y el texto de la licencia. Los ficheros `.woff2` se sirven desde el propio dominio (no hay peticiones a servidores de fuentes de terceros).

## Librerías de producción

Paquetes que acaban en la web publicada (directos y transitivos, más los módulos de Workbox que lleva el service worker y la librería `idb` de la que dependen; las herramientas de desarrollo, como Vite, Playwright o ESLint, no se distribuyen). `npm run licenses` regenera esta tabla **y** el archivo [`public/licencias-de-terceros.txt`](../public/licencias-de-terceros.txt), que reproduce el aviso de copyright y el texto de la licencia de cada paquete, se publica con la web (`/licencias-de-terceros.txt`) y está enlazado desde «Acerca de».

| Paquete                                | Versión   | Licencia            | Dependencia |
| -------------------------------------- | --------- | ------------------- | ----------- |
| @fontsource-variable/inter             | 5.3.0     | OFL-1.1             | directa     |
| @fontsource-variable/plus-jakarta-sans | 5.3.0     | OFL-1.1             | directa     |
| @mapbox/jsonlint-lines-primitives      | 2.0.3     | MIT                 | transitiva  |
| @mapbox/point-geometry                 | 1.1.0     | ISC                 | transitiva  |
| @mapbox/tiny-sdf                       | 2.3.0     | BSD-2-Clause        | transitiva  |
| @mapbox/unitbezier                     | 1.0.0     | BSD-2-Clause        | transitiva  |
| @mapbox/vector-tile                    | 3.0.0     | BSD-3-Clause        | transitiva  |
| @maplibre/geojson-vt                   | 6.3.0     | ISC                 | transitiva  |
| @maplibre/maplibre-gl-style-spec       | 26.5.1    | ISC                 | transitiva  |
| @maplibre/mlt                          | 1.3.0     | (MIT OR Apache-2.0) | transitiva  |
| @maplibre/vt-pbf                       | 4.3.3     | MIT                 | transitiva  |
| @remix-run/route-pattern               | 0.22.1    | MIT                 | transitiva  |
| @types/geojson                         | 7946.0.16 | MIT                 | transitiva  |
| @types/react                           | 19.3.0    | MIT                 | transitiva  |
| @types/react-dom                       | 19.3.0    | MIT                 | transitiva  |
| bidi-js                                | 1.1.0     | MIT                 | transitiva  |
| cookie-es                              | 3.1.1     | MIT                 | transitiva  |
| csstype                                | 3.2.3     | MIT                 | transitiva  |
| earcut                                 | 3.2.4     | ISC                 | transitiva  |
| gl-matrix                              | 3.4.4     | MIT                 | transitiva  |
| idb                                    | 7.1.1     | ISC                 | transitiva  |
| json-stringify-pretty-compact          | 4.0.0     | MIT                 | transitiva  |
| kdbush                                 | 4.1.0     | ISC                 | transitiva  |
| lucide-react                           | 1.66.0    | ISC                 | directa     |
| maplibre-gl                            | 6.16.0    | BSD-3-Clause        | directa     |
| minimist                               | 1.2.8     | MIT                 | transitiva  |
| murmurhash-js                          | 1.0.0     | MIT                 | transitiva  |
| pbf                                    | 5.1.2     | BSD-3-Clause        | transitiva  |
| potpack                                | 2.1.0     | ISC                 | transitiva  |
| protocol-buffers-schema                | 3.6.1     | MIT                 | transitiva  |
| quickselect                            | 3.0.0     | ISC                 | transitiva  |
| react                                  | 19.3.1    | MIT                 | directa     |
| react-dom                              | 19.3.1    | MIT                 | directa     |
| react-router                           | 8.5.1     | MIT                 | directa     |
| require-from-string                    | 2.0.2     | MIT                 | transitiva  |
| resolve-protobuf-schema                | 2.1.0     | MIT                 | transitiva  |
| scheduler                              | 0.28.0    | MIT                 | transitiva  |
| tinyqueue                              | 3.0.0     | ISC                 | transitiva  |
| workbox-cacheable-response             | 7.4.1     | MIT                 | transitiva  |
| workbox-core                           | 7.4.1     | MIT                 | transitiva  |
| workbox-expiration                     | 7.4.1     | MIT                 | transitiva  |
| workbox-precaching                     | 7.4.1     | MIT                 | transitiva  |
| workbox-routing                        | 7.4.1     | MIT                 | transitiva  |
| workbox-strategies                     | 7.4.1     | MIT                 | transitiva  |
| workbox-window                         | 7.4.1     | MIT                 | transitiva  |
| zod                                    | 4.6.7     | MIT                 | directa     |
| zustand                                | 5.0.16    | MIT                 | directa     |

Notas:

- `murmurhash-js` (MIT, dependencia transitiva de MapLibre) no incluye un archivo de licencia en su paquete; el archivo publicado lo indica y recoge la licencia declarada en su `package.json`.
- Un test (`tests/unit/licenses.test.ts`) falla si una dependencia de producción nueva no aparece en `licencias-de-terceros.txt`: hay que volver a ejecutar `npm run licenses` y subir el archivo. Las versiones del archivo pueden quedar un poco por detrás de las de `package-lock.json` tras una actualización de Dependabot hasta la siguiente ejecución.

## Logos de marcas

- Logos presentes en `public/brands/` a 04/11/2026: Ballenoil, BP, Cepsa, Galp, Moeve, Petronor, Petroprix, Plenergy, Repsol y Shell. Los aportó el propietario del proyecto; Gasora no los descarga ni los dibuja.
- Son marcas registradas de sus titulares. Se muestran solo para identificar la estación, sin sugerir afiliación ni respaldo, y no están cubiertos por la licencia MIT.
- **Pendiente (propietario):** confirmar de dónde procede cada archivo y que su uso está permitido; si un titular pide la retirada, basta con borrar el archivo y la interfaz vuelve al avatar con la inicial. Los archivos publicados quedan en el historial de git.

## Sin cookies ni terceros

La web no usa cookies ni analítica. Lo único que guarda en el dispositivo (almacenamiento local y caché del navegador) lleva el prefijo `gasora:` o son cachés de la propia aplicación. Las únicas peticiones a servidores ajenos son las del mapa a `tiles.openfreemap.org`; un test (`tests/e2e/privacy.spec.ts`) lo comprueba.
