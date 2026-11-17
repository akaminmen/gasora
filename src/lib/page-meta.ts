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
  /** Encabezado y párrafos del texto del HTML inicial (para rastreadores y sin JavaScript). */
  heading: string;
  intro: readonly string[];
  /** Nombre del enlace en la navegación del texto inicial. */
  linkLabel: string;
}

export const HOME_META: PageMeta = {
  path: '',
  title: 'Gasora · La gasolina más barata, más cerca',
  description:
    'Gasora: encuentra la gasolina más barata cerca de ti con los datos abiertos de precios de carburantes de España. Sin registro ni cookies.',
  heading: 'Gasora: las gasolineras más baratas de España',
  intro: [
    'Gasora te ayuda a encontrar en segundos dónde repostar más barato cerca de ti. Compara los precios de carburantes de las gasolineras de toda España con los datos abiertos del Ministerio para la Transición Ecológica y el Reto Demográfico.',
    'Busca por código postal, municipio o provincia, o usa tu ubicación: verás las estaciones en una lista y en un mapa, ordenadas por precio o por distancia. Puedes guardar tus favoritas y calcular cuánto te ahorras. Es gratuita, no pide registro y no usa cookies.',
  ],
  linkLabel: 'Inicio',
};

/** Pantallas con su propia dirección que el build publica como fichero HTML con estado 200. */
export const STATIC_PAGES: readonly PageMeta[] = [
  {
    path: 'favoritos',
    title: 'Gasora · Favoritos',
    description:
      'Tus gasolineras favoritas con su precio actual. Se guardan solo en este dispositivo, sin cuenta.',
    heading: 'Tus gasolineras favoritas en Gasora',
    intro: [
      'Marca una gasolinera con el corazón desde la lista o desde su ficha y aparecerá aquí con su precio actual. Tus favoritos se guardan solo en este dispositivo y no se sincronizan con otros: Gasora no tiene cuentas.',
      'Si todavía no tienes ninguno, busca una zona en la portada y marca las gasolineras que te interesen.',
    ],
    linkLabel: 'Favoritos',
  },
  {
    path: 'calculadora',
    title: 'Gasora · Calculadora de ahorro',
    description:
      'Calcula cuánto te ahorras al llenar el depósito en la gasolinera más barata de tu zona.',
    heading: 'Calculadora de ahorro de carburante',
    intro: [
      'Calcula cuánto te ahorras al llenar el depósito en la gasolinera más barata de tu zona. Eliges el combustible y los litros del depósito, y Gasora compara con los precios de la búsqueda que hayas hecho.',
    ],
    linkLabel: 'Calculadora de ahorro',
  },
  {
    path: 'instalar',
    title: 'Instalar Gasora',
    description:
      'Cómo instalar Gasora en el iPhone, iPad, Android y el ordenador: pasos para Safari, Chrome, Edge, Samsung Internet y Firefox.',
    heading: 'Instalar Gasora en el móvil o el ordenador',
    intro: [
      'Instalar Gasora es añadir un acceso directo a la web en la pantalla de inicio o en el escritorio: se abre en su propia ventana, sin pasar por ninguna tienda de aplicaciones y sin cuenta.',
      'Aquí tienes los pasos para el iPhone y el iPad (Safari), Android (Chrome, Samsung Internet y Firefox) y el ordenador (Chrome, Edge y Safari); Firefox de escritorio no instala aplicaciones web.',
    ],
    linkLabel: 'Instalar',
  },
  {
    path: 'acerca',
    title: 'Gasora · Acerca de',
    description:
      'Fuente y fecha de los datos, privacidad, licencias y límites de uso de Gasora, la web de precios de carburantes de España.',
    heading: 'Acerca de Gasora',
    intro: [
      'Los precios proceden del Ministerio para la Transición Ecológica y el Reto Demográfico (Precio de carburantes en las gasolineras españolas, datos.gob.es). Aquí se explica la fuente y la fecha de los datos, qué guarda Gasora en tu dispositivo, qué servidores ven tu dirección IP y las licencias de terceros.',
      'Gasora no usa cookies ni cuentas, y tu ubicación se usa solo en tu dispositivo.',
    ],
    linkLabel: 'Acerca de',
  },
];

/** Todas las direcciones del sitemap: la portada y las pantallas estáticas. */
export const PUBLIC_PATHS: readonly string[] = [HOME_META.path, ...STATIC_PAGES.map((p) => p.path)];

export function pageMeta(path: string): PageMeta {
  const found = STATIC_PAGES.find((page) => page.path === path);
  if (!found) throw new Error(`Pantalla sin metadatos: ${path}`);
  return found;
}
