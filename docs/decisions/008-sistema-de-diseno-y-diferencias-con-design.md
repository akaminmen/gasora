# 008 — Sistema de diseño (Fase 2): decisiones y diferencias con `design/`

Estado: implementada; pendiente de revisión visual del usuario · Fecha: 30/10/2026

Se leyó todo `design/` (CSS, las 13 pantallas y `README.md`). En conflicto manda `GASORA-PLAN.md`. Esta es la lista de lo que se aplicó y de dónde se desvía el código del diseño aprobado.

## Tokens y tema

- Los tokens son los de la sección 9.2 del plan (`src/styles/tokens.css`). Difieren del CSS del diseño en el enlace del tema claro (plan `#4338CA`, diseño `#4F46E5`) y en los fondos suaves del oscuro (plan `#1B2147` / `#232B5E`, diseño `#1B2145` / `#272F6B`).
- Tokens extra (no están en la tabla del plan): `--on-brand`, `--brand-logo` (el «ora» del logotipo: `#818CF8` en oscuro porque `#4F46E5` sobre `#0A1220` da 2,98:1), `--brand-logo-arc`, `--handle`, `--avatar-1..3`, sombras y la escala de precios.
- Tema: `data-theme="light|dark"` en `<html>`; el tema por defecto es el claro y no se consulta `prefers-color-scheme` (ADR 010). Un script en línea de `index.html` aplica la elección antes del primer pintado. Se guarda en `gasora:theme:v1`. El combustible, en `gasora:fuel:v1`.
- Tailwind v4 con `@theme inline` apunta a los tokens (`bg-surface`, `text-ink`, `border-line`…): no se usan variantes `dark:`.

## Fuentes

Autoalojadas con `@fontsource-variable/inter` y `@fontsource-variable/plus-jakarta-sans`, solo el subconjunto **latino** (`src/styles/fonts.css`; 48 KB + 27 KB). Variable en vez de pesos estáticos del plan: un archivo por familia. Cubre todo el español; un carácter fuera del subconjunto cae a la fuente del sistema.

## Logo y favicon

SVG propio derivado del diseño (gota de marcador, surtidor y dos arcos). `LogoMark` y `Wordmark` en `src/components/ui/Logo.tsx` y `public/favicon.svg`. Iconos PWA: Fase 6.

## Diferencias deliberadas con `design/`

| Diseño                                                         | Implementación                                                           | Motivo                                             |
| -------------------------------------------------------------- | ------------------------------------------------------------------------ | -------------------------------------------------- |
| «GasRadar», eslogan «Tu radar de gasolina barata»              | «Gasora», eslogan del plan                                               | Plan 9.1                                           |
| «Datos oficiales del Ministerio» / «precios oficiales»         | «Datos abiertos del Ministerio»                                          | La licencia (3.4) prohíbe sugerir respaldo oficial |
| «actualizados el 28/10/2026 a las 07:30»                       | «consultados el dd/mm/aaaa, hh:mm»                                       | ADR 001                                            |
| Tarjeta: badge junto al nombre, precio de 26 px                | Estructura de la sección 9.7 (badge en su fila, precio de 24 px / 20 px) | Defecto de solape del diseño                       |
| «Ahorras…» y «X € más que la media» / «En la media de la zona» | Solo «Ahorras X,XX € por depósito» si es positivo                        | Plan 6                                             |
| «Abierto · 24 horas»                                           | Texto del horario tal cual                                               | Plan 6 (sin «abierto ahora» en el MVP)             |
| Tramos por posición (0,375 / 0,625 / 0,875)                    | Cuantiles P20/P60/P85                                                    | Plan 6 (se implementan en la Fase 3)               |
| Iconos propios `i i-xxx`                                       | `lucide-react`                                                           | Plan 4                                             |
| ▼ — ▲ como texto                                               | SVG                                                                      | No depender de que la fuente tenga el glifo        |
| Pin de 32 px de alto                                           | Botón de 44×44 px con el pin visible de 32 px dentro                     | Zonas táctiles (plan 9.3)                          |
| Favorito centrado                                              | Arriba a la derecha                                                      | Plan 9.7                                           |
| Móvil inicio = mapa + hoja                                     | Hero apilado                                                             | El mapa y la hoja son de la Fase 4                 |
| Favoritos / Calculadora / Acerca solo en móvil                 | Columna centrada de ≈720 px                                              | Plan 9.8                                           |
| Mapa dibujado con CSS                                          | `.map-sample` solo en `/ui-kit` y en la ilustración del inicio           | Mapa real: Fase 4                                  |

## Pantallas: hecho y pendiente

- **Hechas:** shell (cabecera, navegación móvil, pie con atribución), Inicio (hero), Acerca de, 404, `/ui-kit`.
- **Marcadores de posición:** Favoritos (estado vacío), Calculadora, Ficha `/e/:id`. Su contenido real es de la Fase 5.
- **Controles sin función todavía:** el buscador y «Usar mi ubicación» del inicio y de la cabecera muestran un aviso («La búsqueda estará disponible muy pronto»). Llegan en la Fase 3.
- **Ilustración del inicio:** replica la vista previa del diseño con importes de ejemplo y el rótulo «Ejemplo ilustrativo»; es decorativa (`aria-hidden`) y no usa botones.

## Filtro de marcas

`BrandMultiSelect` recibe una lista de opciones ya agrupada. Decisión del usuario (Fase 1): las marcas pequeñas se agrupan en «Otras» **solo en el filtro**; la tarjeta recibe el rótulo real de la estación (`name`) y el avatar usa su inicial. El agrupado se calcula en la Fase 3.

## `/ui-kit`

Solo en desarrollo y en el build de tests (`npm run build:e2e`, modo `e2e` con `.env.e2e`). `npm run check:build` falla si el chunk o sus textos aparecen en el build de producción (y se ejecuta en los dos workflows). Un fallo real que detectó: el acceso `import.meta.env['VITE_UI_KIT']` no se sustituye de forma estática y el chunk llegaba a producción; con `import.meta.env.VITE_UI_KIT` se elimina.

## Fuera del alcance de esta fase (previsto en el plan)

Gestos de arrastre de la hoja (Fase 4), navegación con teclado del buscador (Fase 3), iconos y manifiesto PWA (Fase 6).
