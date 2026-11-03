# 006 — Versiones y herramientas

Estado: implementada · Fecha: 28/10/2026

Todas las dependencias están fijadas a versión exacta en `package.json` (`--save-exact`), comprobadas con `npm view` el 28/10/2026.

| Paquete                         | Versión          | Nota                                                                                                                                            |
| ------------------------------- | ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| vite / @vitejs/plugin-react     | 8.3.5 / 6.1.2    |                                                                                                                                                 |
| react / react-dom               | 19.3.1           |                                                                                                                                                 |
| tailwindcss / @tailwindcss/vite | 4.3.3            | Configuración con plugin de Vite, sin `tailwind.config`                                                                                         |
| **typescript**                  | **6.0.3**        | La última publicada es la 7.0.2, pero `typescript-eslint` 8.72.1 exige `<6.1.0`. Se fija la 6.0.3 y se revisa al actualizar `typescript-eslint` |
| eslint / typescript-eslint      | 10.13.0 / 8.72.1 | Configuración plana                                                                                                                             |
| vitest                          | 5.0.5            |                                                                                                                                                 |
| zod                             | 4.6.7            |                                                                                                                                                 |
| tsx                             | 4.23.15          |                                                                                                                                                 |
| @playwright/test                | 1.64.1           | Chromium descargado con `npx playwright install chromium`                                                                                       |

## Notas

- Node del entorno: v24.19.0; `engines` pide ≥22. Los workflows usan Node 24.
- npm 11.17 avisa de que `esbuild` (dependencia de `tsx`) tiene un script `postinstall` sin aprobar (`allow-scripts`). `tsx` funciona sin aprobarlo; no se ha tocado esa configuración.
- Acciones de GitHub fijadas a la versión mayor vigente: checkout v7, setup-node v7, configure-pages v6, upload-pages-artifact v5, deploy-pages v5. Dependabot las mantiene.
- Instalados en la Fase 2: react-router 8.5.1, zustand 5.0.16, lucide-react 1.63.0, @fontsource-variable/inter 5.3.0, @fontsource-variable/plus-jakarta-sans 5.3.0 y, para desarrollo, @axe-core/playwright 4.14.0.
- Aún no instalados: MapLibre, vite-plugin-pwa, @tanstack/react-virtual, vaul. Entran en las fases que los necesitan.
- **Revisar TypeScript:** está fijado a 6.0.3 por el límite de typescript-eslint (<6.1.0). Decisión del usuario (30/10/2026): aceptarlo y volver a mirarlo cuando typescript-eslint admita una versión posterior (comprobar con `npm view typescript-eslint@latest peerDependencies` al actualizar).
