# Gasora

**La gasolina más barata, más cerca.**

Gasora es una web app (PWA) gratuita y sin registro para conductores de España. Responde a una pregunta: «¿dónde repostar más barato cerca de mí ahora mismo?», con los datos abiertos de precios de carburantes del Ministerio para la Transición Ecológica y el Reto Demográfico.

> Estado: **Fase 5 de 7** (favoritos, calculadora, ficha y URL compartible). Hay ingesta de datos reales, tema claro (por defecto) y oscuro, búsqueda por provincia, municipio o código postal con autocompletado y teclado, «Usar mi ubicación», filtros de combustible, radio, orden y marcas, resultados con ranking por tramos sobre un mapa (MapLibre + OpenFreeMap) con hoja inferior en móvil, ficha de cada gasolinera (`/e/:id`), favoritos guardados en el navegador, calculadora de ahorro por depósito y enlaces que restauran la búsqueda (`/?q=29002&fuel=g95e5&r=5`). Pendientes: estados finales, PWA y sin conexión completo, pulido y lanzamiento.

## Cómo funciona

```
Ingesta (scripts/) → public/data/*.json → app estática (Vite + React)
```

Un script descarga el listado del Ministerio, lo normaliza y valida con zod, y genera cuatro ficheros JSON (`meta`, `stations.{hash}`, `prices`, `search-index`). La app solo lee esos ficheros: nunca llama al Ministerio desde el navegador. Más detalle en [docs/decisions/](docs/decisions/).

## Requisitos

- Node.js 22 o superior (desarrollado con 24).
- Windows, macOS o Linux. Los scripts funcionan con PowerShell.

## Empezar (PowerShell)

```powershell
npm ci
npm run ingest            # descarga datos reales del Ministerio (≈12 MB, unos 5 s)
npm run dev               # http://localhost:5173 (incluye /ui-kit)
```

Para ver el build de producción:

```powershell
npm run build
npm run preview           # http://127.0.0.1:4173
```

Sin conexión, o para probar con datos de demostración:

```powershell
npm run ingest:fixtures
```

## Scripts

| Script                                                  | Qué hace                                                                                                                                                                                                  |
| ------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run dev`                                           | Servidor de desarrollo de Vite                                                                                                                                                                            |
| `npm run build` / `npm run preview`                     | Compila y sirve el build de producción                                                                                                                                                                    |
| `npm run build:e2e`                                     | Build para los tests: incluye la galería `/ui-kit` y unos datos de prueba deterministas en `dist/data` (`scripts/e2e-data.ts`)                                                                            |
| `npm run check:build`                                   | Falla si `dist/` lleva la galería o le falta `404.html`                                                                                                                                                   |
| `npm run ingest`                                        | Descarga, normaliza, valida y genera `public/data/`                                                                                                                                                       |
| `npm run ingest:fixtures`                               | Igual, con la muestra de `fixtures/` (datos de demostración)                                                                                                                                              |
| `npm run check:data`                                    | Valida el contenido de `public/data/`                                                                                                                                                                     |
| `npm run cadence`                                       | Mide cada cuánto cambian los precios (ejecutar varias veces con horas de diferencia; resultado en `docs/cadencia.json`)                                                                                   |
| `npm run size`                                          | Tamaño de los ficheros de datos en bruto, gzip y brotli (carga inicial y con el índice de búsqueda)                                                                                                       |
| `npm test`                                              | Tests unitarios (Vitest)                                                                                                                                                                                  |
| `npm run test:e2e`                                      | Tests de navegador (Playwright): humo, **layout**, accesibilidad (axe). Compila con `build:e2e` y sirve la app solos. Requiere `npx playwright install chromium` la primera vez y datos en `public/data/` |
| `npm run test:e2e:live`                                 | Prueba contra los servidores reales de OpenFreeMap (estilos y atribución); aparte porque depende de un servicio externo                                                                                   |
| `npm run lint` / `npm run typecheck` / `npm run format` | Calidad de código                                                                                                                                                                                         |

Si un test e2e se queda esperando, puede haber un servidor antiguo en el puerto 4173: ciérralo antes de volver a lanzarlos.

## Estructura

```
.github/workflows/   ci.yml (calidad) y deploy.yml (ingesta + despliegue a GitHub Pages)
docs/                decisions/ (ADR) y mediciones
fixtures/            muestra real recortada de la API del Ministerio
scripts/             ingesta: ministry, normalize, brands, validate, search-index, run-ingest…
src/                 la app: app/ (router, shell), components/ui/, features/, lib/, stores/, styles/
tests/               unit/ (Vitest) y e2e/ (Playwright: smoke, layout, a11y)
```

## Datos y atribución

Fuente: Ministerio para la Transición Ecológica y el Reto Demográfico — Precio de carburantes en las gasolineras españolas (datos.gob.es). Los datos se reutilizan al amparo de la Ley 37/2007; el literal exacto de atribución está pendiente de verificar.

Gasora es un proyecto independiente, no afiliado ni respaldado por el Ministerio. Los precios pueden diferir de los del surtidor. La fecha que muestra la app es la de la **consulta** al Ministerio, no la de actualización de los precios ([ADR 001](docs/decisions/001-fecha-de-los-datos.md)).

Mapa: © OpenMapTiles, Data from OpenStreetMap, servido por OpenFreeMap.

## Licencia

[MIT](LICENSE) © 2026 Balta Caro. La licencia cubre el código de este repositorio, no los datos del Ministerio ni las teselas del mapa.
