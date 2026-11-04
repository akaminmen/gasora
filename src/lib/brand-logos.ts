/**
 * Logos de marca (ADR 015). Cada marca (`brandKey` de la ingesta) se asocia a un nombre de archivo
 * sin extensión; el archivo vive en `public/brands/` y es `<nombre>.svg`, o `<nombre>.webp` o
 * `<nombre>.png` si no hay SVG (se usa el primero que exista, en ese orden). Si no existe ninguno,
 * la interfaz usa el avatar con la inicial.
 *
 * Dos marcas pueden compartir archivo (por ejemplo, `cepsa: 'moeve'`) si el usuario lo decide.
 * Esta tabla se valida con `npm run brands:check`.
 */
export const BRAND_LOGO_FILES: Readonly<Record<string, string>> = {
  repsol: 'repsol',
  moeve: 'moeve',
  cepsa: 'cepsa',
  galp: 'galp',
  ballenoil: 'ballenoil',
  plenergy: 'plenergy',
  shell: 'shell',
  petroprix: 'petroprix',
  petronor: 'petronor',
  carrefour: 'carrefour',
  bp: 'bp',
  avia: 'avia',
  q8: 'q8',
  esclatoil: 'esclatoil',
  bonarea: 'bonarea',
  campsa: 'campsa',
  valcarce: 'valcarce',
  agla: 'agla',
  alcampo: 'alcampo',
  ham: 'ham',
  eni: 'eni',
  eroski: 'eroski',
  gasexpress: 'gasexpress',
  beroil: 'beroil',
  meroil: 'meroil',
  tamoil: 'tamoil',
  molgas: 'molgas',
  ids: 'ids',
  disa: 'disa',
  naturgy: 'naturgy',
  autonetoil: 'autonetoil',
  easygas: 'easygas',
  petrocat: 'petrocat',
  pcan: 'pcan',
};

/** Extensiones admitidas, por orden de preferencia. */
export const LOGO_EXTENSIONS = ['svg', 'webp', 'png'] as const;

/**
 * Archivo del logo de una marca entre los que existen (`available`: nombres con extensión), o
 * `undefined` si la marca no tiene logo (la interfaz usa entonces el avatar).
 */
export function logoFileFor(
  brandKey: string,
  available: ReadonlySet<string>,
  table: Readonly<Record<string, string>> = BRAND_LOGO_FILES,
): string | undefined {
  const name = table[brandKey];
  if (!name) return undefined;
  return LOGO_EXTENSIONS.map((ext) => `${name}.${ext}`).find((file) => available.has(file));
}
