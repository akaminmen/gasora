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
  | { kind: 'province'; label: string; lat: number; lng: number; id: number }
  | {
      /** «Buscar en esta zona»: círculo (centro del mapa + radio) elegido moviendo el mapa */
      kind: 'area';
      label: string;
      lat: number;
      lng: number;
      /** Ubicación del usuario, si se usó: de ahí se miden las distancias (nunca va a la URL) */
      origin?: { lat: number; lng: number };
    };

/** ¿La distancia tiene sentido? Solo desde un punto concreto (ubicación, código postal o zona). */
export function hasOrigin(place: Place): boolean {
  return place.kind === 'location' || place.kind === 'postal' || place.kind === 'area';
}

/** Punto desde el que se miden las distancias: la ubicación del usuario en una zona, si la hay. */
export function distanceOrigin(place: Place): { lat: number; lng: number } {
  return place.kind === 'area' && place.origin ? place.origin : place;
}

/** ¿Se filtra por radio? Ubicación, CP y zona siempre; el municipio solo si se amplió. */
export function usesRadius(place: Place): boolean {
  return hasOrigin(place) || (place.kind === 'municipality' && place.expanded === true);
}

export const DEFAULT_RADIUS_KM = 5;
export const MIN_RADIUS_KM = 1;
export const MAX_RADIUS_KM = 50;
export const EXPANDED_MUNICIPALITY_KM = 10;
