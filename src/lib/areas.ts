import { haversineKm } from './geo';
import { MAX_RADIUS_KM, MIN_RADIUS_KM, usesRadius, type Place } from './place';

/** Círculo de búsqueda: centro y radio en km. */
export interface Circle {
  lat: number;
  lng: number;
  radiusKm: number;
}

/** Rectángulo visible del mapa, en grados (sin giro ni inclinación). */
export interface ViewRect {
  north: number;
  south: number;
  east: number;
  west: number;
}

/** Parte del ancho visible (25 %) que el centro puede salirse del área buscada sin ofrecer buscar. */
export const OFFER_MARGIN = 0.25;

export const viewCenter = (view: ViewRect) => ({
  lat: (view.north + view.south) / 2,
  lng: (view.east + view.west) / 2,
});

export function viewWidthKm(view: ViewRect): number {
  const { lat } = viewCenter(view);
  return haversineKm(lat, view.west, lat, view.east);
}

export function viewHeightKm(view: ViewRect): number {
  const { lng } = viewCenter(view);
  return haversineKm(view.south, lng, view.north, lng);
}

/**
 * Zona buscada que corresponde a lo que se ve: centro del mapa y radio = mitad del lado mayor,
 * redondeado hacia arriba a km enteros (el deslizador es de enteros) y limitado a [1, 50] km.
 * `limited` indica que se ha recortado al máximo (hay más mapa visible que radio buscado).
 */
export function areaFromView(view: ViewRect): Circle & { limited: boolean } {
  const center = viewCenter(view);
  const raw = Math.max(viewWidthKm(view), viewHeightKm(view)) / 2;
  const radiusKm = Math.min(MAX_RADIUS_KM, Math.max(MIN_RADIUS_KM, Math.ceil(raw)));
  return {
    lat: Number(center.lat.toFixed(5)),
    lng: Number(center.lng.toFixed(5)),
    radiusKm,
    limited: raw > MAX_RADIUS_KM,
  };
}

/**
 * Área que cubre la búsqueda activa. Con radio es el círculo; sin radio (municipio, provincia),
 * el círculo mínimo centrado en el centro de sus resultados que los contiene a todos.
 */
export function searchedRegion(
  place: Place,
  radiusKm: number,
  points: readonly { lat: number; lng: number }[],
): Circle {
  if (usesRadius(place)) return { lat: place.lat, lng: place.lng, radiusKm };
  if (points.length === 0) return { lat: place.lat, lng: place.lng, radiusKm: MIN_RADIUS_KM };
  let north = -90;
  let south = 90;
  let east = -180;
  let west = 180;
  for (const p of points) {
    north = Math.max(north, p.lat);
    south = Math.min(south, p.lat);
    east = Math.max(east, p.lng);
    west = Math.min(west, p.lng);
  }
  const center = viewCenter({ north, south, east, west });
  const far = Math.max(...points.map((p) => haversineKm(center.lat, center.lng, p.lat, p.lng)));
  return { ...center, radiusKm: Math.max(MIN_RADIUS_KM, far) };
}

const inside = (view: ViewRect, p: { lat: number; lng: number }) =>
  p.lat <= view.north && p.lat >= view.south && p.lng <= view.east && p.lng >= view.west;

/**
 * ¿Se ofrece «Buscar en esta zona»? Cuando, terminado un gesto, el centro del mapa queda a más de
 * un 25 % del ancho visible fuera del área buscada, o ningún resultado cae dentro de lo visible.
 */
export function shouldOfferAreaSearch(
  view: ViewRect,
  region: Circle,
  points: readonly { lat: number; lng: number }[],
): boolean {
  const center = viewCenter(view);
  const away = haversineKm(center.lat, center.lng, region.lat, region.lng);
  if (away > region.radiusKm + OFFER_MARGIN * viewWidthKm(view)) return true;
  return points.length > 0 && !points.some((p) => inside(view, p));
}
