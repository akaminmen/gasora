import type { Station } from './data-schema';

/** Clave del grupo «Otras» del filtro (coincide con la marca desconocida de la ingesta). */
export const OTHER_BRAND = 'otras';

/** Marcas con menos estaciones que esto en toda España se agrupan en «Otras» en el filtro. */
export const MIN_BRAND_STATIONS = 40;

const SPECIAL_LABELS: Record<string, string> = {
  bp: 'BP',
  q8: 'Q8',
  ham: 'HAM',
  ids: 'IDS',
  pcan: 'PCAN',
  agla: 'AGLA',
  eni: 'ENI',
  disa: 'DISA',
  moeve: 'Moeve',
  [OTHER_BRAND]: 'Otras',
};

/** Etiqueta legible de una brandKey para el filtro. */
export function brandLabel(key: string): string {
  return SPECIAL_LABELS[key] ?? key.charAt(0).toUpperCase() + key.slice(1);
}

/**
 * Mapa brandKey → clave del filtro. Las marcas pequeñas pasan a «Otras» solo aquí: la tarjeta de
 * cada estación sigue mostrando su rótulo real (`Station.n`).
 */
export function buildBrandGroups(
  stations: readonly Pick<Station, 'b'>[],
  minStations = MIN_BRAND_STATIONS,
): Map<string, string> {
  const counts = new Map<string, number>();
  for (const s of stations) counts.set(s.b, (counts.get(s.b) ?? 0) + 1);
  const groups = new Map<string, string>();
  for (const [key, count] of counts) {
    groups.set(key, key !== OTHER_BRAND && count >= minStations ? key : OTHER_BRAND);
  }
  return groups;
}
