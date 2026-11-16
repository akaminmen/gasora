/**
 * Título y descripción de cada pantalla pública. Es la única fuente: el build la usa para escribir
 * un HTML propio por ruta (`scripts/static-pages.ts`) y la aplicación para mantener el título al
 * navegar sin recargar (`usePageMeta`).
 */
export interface PageMeta {
  /** Ruta sin la barra inicial; la portada es la cadena vacía. */
  path: string;
  title: string;
  description: string;
}

export const HOME_META: PageMeta = {
  path: '',
  title: 'Gasora · La gasolina más barata, más cerca',
  description:
    'Gasora: encuentra la gasolina más barata cerca de ti con los datos abiertos de precios de carburantes de España. Sin registro ni cookies.',
};

/** Pantallas con su propia dirección que el build publica como fichero HTML con estado 200. */
export const STATIC_PAGES: readonly PageMeta[] = [
  {
    path: 'favoritos',
    title: 'Gasora · Favoritos',
    description:
      'Tus gasolineras favoritas con su precio actual. Se guardan solo en este dispositivo, sin cuenta.',
  },
  {
    path: 'calculadora',
    title: 'Gasora · Calculadora de ahorro',
    description:
      'Calcula cuánto te ahorras al llenar el depósito en la gasolinera más barata de tu zona.',
  },
  {
    path: 'instalar',
    title: 'Instalar Gasora',
    description:
      'Cómo instalar Gasora en el iPhone, iPad, Android y el ordenador: pasos para Safari, Chrome, Edge, Samsung Internet y Firefox.',
  },
  {
    path: 'acerca',
    title: 'Gasora · Acerca de',
    description:
      'Fuente y fecha de los datos, privacidad, licencias y límites de uso de Gasora, la web de precios de carburantes de España.',
  },
];

/** Todas las direcciones del sitemap: la portada y las pantallas estáticas. */
export const PUBLIC_PATHS: readonly string[] = [HOME_META.path, ...STATIC_PAGES.map((p) => p.path)];

export function pageMeta(path: string): PageMeta {
  const found = STATIC_PAGES.find((page) => page.path === path);
  if (!found) throw new Error(`Pantalla sin metadatos: ${path}`);
  return found;
}
