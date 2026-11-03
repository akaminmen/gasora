/** Lugar de búsqueda activo. La ubicación del usuario nunca se guarda (sección 10 del plan). */
export type Place =
  | { kind: 'location'; label: string; lat: number; lng: number }
  | { kind: 'postal'; label: string; lat: number; lng: number; code: string }
  | {
      kind: 'municipality';
      label: string;
      lat: number;
      lng: number;
      id: number;
      pid: number;
      /** true tras «Ampliar a 10 km»: se busca por radio desde el centroide del municipio */
      expanded?: boolean;
    }
  | { kind: 'province'; label: string; lat: number; lng: number; id: number };

/** ¿La distancia tiene sentido? Solo desde un punto concreto (ubicación o código postal). */
export function hasOrigin(place: Place): boolean {
  return place.kind === 'location' || place.kind === 'postal';
}

/** ¿Se filtra por radio? Ubicación y CP siempre; el municipio solo si se amplió. */
export function usesRadius(place: Place): boolean {
  return hasOrigin(place) || (place.kind === 'municipality' && place.expanded === true);
}

export const DEFAULT_RADIUS_KM = 5;
export const MIN_RADIUS_KM = 1;
export const MAX_RADIUS_KM = 50;
export const EXPANDED_MUNICIPALITY_KM = 10;
