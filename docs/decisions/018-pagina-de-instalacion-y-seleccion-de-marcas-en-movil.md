# 018 — Página de instalación y selección de marcas en móvil

Estado: **implementada y verificada con tests en Chromium, Firefox y WebKit (iPhone 11 Pro emulado); sin probar en un iPhone ni en un Android reales** · Fecha: 11/11/2026

## 1. Selector de marcas en móvil: hoja de selección modal

### Qué fallaba (reproducido en WebKit, iPhone 11 Pro)

El desplegable de marcas colgaba de la **cabecera de la hoja inferior** con `position: absolute; left: 0; width: 16rem` respecto al botón. Causas medidas:

- **Se salía por la derecha:** el botón «Marcas» está a la derecha de la fila de controles (a 375 px empieza en x ≈ 194), y el panel mide 256 px: acababa en x = 450 en una pantalla de 375 px.
- **Recorte por abajo:** la hoja tiene `overflow: hidden`, así que todo lo que sobresale de su rectángulo se corta.
- **Sin scroll con el dedo:** la cabecera de la hoja lleva `touch-action: none` (para poder arrastrarla) y esa restricción vale para todos sus descendientes, incluido el panel. **La hipótesis de que el gesto de arrastre de `BottomSheet` capturaba el toque no se confirma en lo que hace el código JavaScript** (`onPointerDown` ignora los controles interactivos y el grupo con `role="group"`); es el CSS (`touch-action: none`) lo que impide el desplazamiento nativo, más el recorte por `overflow`.
- Los controles (orden y marcas) solo existen con la hoja expandida; no aparecen a altura intermedia.

### Decisión

En móvil (≤ 639 px) el filtro es una **hoja de selección modal** (`BrandSheet`), dibujada en un portal en `document.body`, fuera de la hoja inferior:

- Altura máxima = viewport dinámico (`dvh`) menos la zona segura superior y 16 px; desplazamiento propio (`overflow-y: auto`, `overscroll-behavior: contain`, `touch-action: pan-y`); respeta `env(safe-area-inset-*)`.
- Título «Marcas», contador «N marcas elegidas» (`role="status"`), botones «Limpiar» y «Listo» de 44 px, X para cerrar.
- `role="dialog"`, `aria-modal`, nombre accesible; foco atrapado (Tab y Mayús+Tab), Escape y tocar fuera cierran, el foco vuelve al botón «Marcas». Mientras está abierta, `#root` es `inert` y `html`/`body` tienen `overflow: hidden`.
- Los eventos de puntero y de toque dentro del diálogo no suben a la hoja inferior (los eventos de un portal suben por el árbol de React).
- Animación de entrada desactivada con `prefers-reduced-motion`.
- **La selección es un borrador que se aplica al pulsar «Listo».** Motivo: el diálogo tapa casi todo y aplicar cada marca recolocaría la lista y el mapa (ajuste de encuadre) por detrás sin que se vea. Escape, la X y tocar fuera **descartan** el borrador (el botón de cerrar se llama «Cerrar sin aplicar»). Es una diferencia con el escritorio, donde se sigue aplicando al marcar.
- Tablet y escritorio mantienen el desplegable, ahora con `max-w-[calc(100vw-2rem)]` y `max-h: min(60dvh, 28rem)`; comprobado que cabe en 640, 768, 1023, 1024 y 1440 px y se maneja con teclado.

### Otros defectos de la vista móvil con la hoja

|                                        | Reproducido                                                                                      | Causa                                                                                                                                                                                                                                     | Cambio                                                                                                                                 |
| -------------------------------------- | ------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| a) Buscador recortado por arriba       | **No en emulación** (el documento mide justo el viewport). Causa probable por lectura del código | La raíz usaba `min-h-screen` (`100vh`, viewport _grande_). En iOS Safari con la barra abajo `100dvh` es menor que `100vh`: el documento es más alto que lo visible, la página se desplaza y la cabecera fija (`sticky`) tapa lo de arriba | Raíz con `min-height: 100dvh` (`.app-root`)                                                                                            |
| b) «Mapa»/«Lista» tapa la 3.ª pastilla | **Sí**, con la hoja expandida                                                                    | El botón se colocaba 12 px por encima del borde superior de la hoja, que en esa altura cae sobre la fila de chips                                                                                                                         | Con la hoja expandida el botón va abajo a la derecha, sobre la lista (con relleno inferior de 5 rem); en las otras alturas, como antes |
| c) Orden duplicado                     | **Sí**, con la hoja expandida                                                                    | `controls` repetía `SortControl` que la cabecera de la hoja ya muestra                                                                                                                                                                    | En móvil `controls` no lleva el orden                                                                                                  |
| d) Hueco bajo la hoja                  | **No en emulación**; misma causa probable que a)                                                 | Documento más alto que el área visible y barra inferior fija                                                                                                                                                                              | Misma corrección que a)                                                                                                                |

**a) y d) se confirman por código, no en un iPhone:** Playwright no puede reproducir que `vh` y `dvh` difieran. Hay un test que comprueba que no haya scroll de página y que la raíz use `dvh`.

## 2. Página /instalar

- Ruta `/instalar` (título y descripción propios, un solo `h1`, listas ordenadas para los pasos), en el sitemap, con enlace directo y recarga (base `/`, ADR 017).
- **Contenido:** qué es instalar y qué no (no es una app nativa), qué funciona sin conexión según el service worker real, favoritos y ajustes por dispositivo; secciones para iPhone/iPad, Android y ordenador, con cada navegador; «Si no te aparece la opción» (HTTPS, actualizar, esperar, que algunos navegadores solo crean un acceso directo).
- **Verificación:** todos los pasos salen de documentación oficial consultada el 11/11/2026 y registrada en [`docs/fuentes-instalacion.md`](../fuentes-instalacion.md), con lo que no se pudo leer o verificar (la guía de Apple para iPhone solo en resumen, la etiqueta de Firefox para Android, los nombres de menú en español).
- **Detección:** `detectPlatform` (agente de usuario; iPadOS se distingue de macOS por la pantalla táctil) solo **destaca** la sección y el navegador; ninguna sección se oculta.
- **«Instalar ahora»:** solo si el navegador dispara `beforeinstallprompt` (guardado en el almacén `usePwaStore`); en iOS no existe y no se simula. Si ya está instalada (`display-mode: standalone` o `navigator.standalone`), lo dice.
- **Icono en la cabecera móvil** (< 640 px): descarga (lucide), «Instalar la aplicación», 44 px, oculto si ya se ejecuta instalada. Tablet y escritorio no cambian. En «Acerca de», la tarjeta de instalación se reduce a un texto y el botón «Ver instrucciones».
- **Compactación de la cabecera:** con el texto al 200 % el rótulo «Gasora» (en `rem`) crecía y la cabecera ya desbordaba (3 px a 390 px) y con el icono nuevo no cabía. El rótulo de la cabecera pasa a un tamaño fijo en píxeles (un logotipo no está sujeto al tamaño de texto) y el hueco entre elementos baja de 8 a 6 px en móvil. **Alternativas descartadas o propuestas:** ocultar el rótulo y dejar solo el icono por debajo de 360 px; mover «Instalar» a un menú de overflow; quitar el icono (la página sigue enlazada desde «Acerca de»).

## Consecuencias

- El selector de marcas de móvil se maneja con dedo, teclado y lector de pantalla y no depende del recorte de la hoja.
- Hay más texto que mantener en `/instalar`: los menús de los navegadores cambian. Revisar con `docs/fuentes-instalacion.md`.
- El encabezado de la página y su descripción solo los ven los rastreadores que ejecutan JavaScript (SPA); no hay prerenderizado.

## Cómo se revierte

- Marcas: pasar `modal={false}` a `BrandMultiSelect` en `ResultsView` devuelve el desplegable en móvil (con sus defectos).
- Instalación: quitar la ruta, la entrada de `PUBLIC_PAGES`, el icono de la cabecera y volver a la tarjeta anterior de «Acerca de».
