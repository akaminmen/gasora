/**
 * Dos logos de prueba (rectangulares, para comprobar `object-fit`) que solo existen en el build de
 * los tests e2e: `scripts/e2e-data.ts` los escribe en `dist/brands` y el plugin de logos de
 * `vite.config.ts` los añade a la lista. El resto de marcas usa el avatar o los logos reales.
 */
const logo = (color: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 60"><rect width="120" height="60" fill="${color}"/><circle cx="60" cy="30" r="22" fill="#fff"/></svg>`;

export const E2E_LOGOS: Readonly<Record<string, string>> = {
  'ballenoil.svg': logo('#0f766e'),
  'shell.svg': logo('#b45309'),
};
