import { FUELS, type FuelId } from './fuel-ids';
import { DEFAULT_RADIUS_KM, MAX_RADIUS_KM, MIN_RADIUS_KM, usesRadius, type Place } from './place';
import type { SortKey } from './resultset';

/**
 * Estado de la búsqueda en la URL (F14): `/?q=29002&fuel=g95e5&r=5&sort=price`.
 *  - `q`: `29002` (código postal), `m<id>` (municipio) o `p<id>` (provincia). La ubicación del
 *    usuario nunca se escribe en la URL (privacidad): «cerca de ti» no es compartible.
 *  - `a<lat>_<lng>`: zona del mapa («Buscar en esta zona»), con el radio en `r`. Solo se escribe si
 *    la búsqueda no usó la ubicación del usuario (sería una forma de escribirla en la URL); las
 *    coordenadas van redondeadas a 4 decimales (≈ 11 m) y el zoom no se guarda: el mapa se encuadra
 *    a los resultados.
 *  - `x=1`: municipio ampliado a un radio. `r`: radio en km. `sort`: `price` | `distance`.
 */
export type PlaceRef =
  | { kind: 'postal'; code: string }
  | { kind: 'municipality'; id: number }
  | { kind: 'province'; id: number }
  | { kind: 'area'; lat: number; lng: number };

export interface UrlState {
  place?: PlaceRef;
  fuel?: FuelId;
  radiusKm?: number;
  sort?: SortKey;
  expanded?: boolean;
}

export function placeRef(place: Place): PlaceRef | null {
  switch (place.kind) {
    case 'postal':
      return { kind: 'postal', code: place.code };
    case 'municipality':
      return { kind: 'municipality', id: place.id };
    case 'province':
      return { kind: 'province', id: place.id };
    case 'area':
      // Con la ubicación del usuario de por medio, la zona no se comparte (regla de privacidad)
      return place.origin
        ? null
        : { kind: 'area', lat: Number(place.lat.toFixed(4)), lng: Number(place.lng.toFixed(4)) };
    default:
      return null;
  }
}

function formatRef(ref: PlaceRef): string {
  if (ref.kind === 'postal') return ref.code;
  if (ref.kind === 'area') return `a${ref.lat.toFixed(4)}_${ref.lng.toFixed(4)}`;
  return `${ref.kind === 'municipality' ? 'm' : 'p'}${ref.id}`;
}

function parseRef(value: string | null): PlaceRef | undefined {
  if (!value) return undefined;
  if (/^\d{5}$/.test(value)) return { kind: 'postal', code: value };
  const area = /^a(-?\d{1,2}(?:\.\d{1,5})?)_(-?\d{1,3}(?:\.\d{1,5})?)$/.exec(value);
  if (area?.[1] && area[2]) {
    const lat = Number(area[1]);
    const lng = Number(area[2]);
    if (Math.abs(lat) <= 90 && Math.abs(lng) <= 180) return { kind: 'area', lat, lng };
    return undefined;
  }
  const match = /^([mp])(\d{1,6})$/.exec(value);
  if (match?.[1] && match[2]) {
    return { kind: match[1] === 'm' ? 'municipality' : 'province', id: Number(match[2]) };
  }
  return undefined;
}

/** Lee el estado de una cadena de consulta; ignora lo que no sea válido. */
export function parseUrlState(search: string): UrlState {
  const params = new URLSearchParams(search);
  const state: UrlState = {};
  const place = parseRef(params.get('q'));
  if (place) state.place = place;
  const fuel = params.get('fuel');
  const known = FUELS.find((f) => f === fuel);
  if (known) state.fuel = known;
  const radius = Number(params.get('r'));
  if (Number.isInteger(radius) && radius >= MIN_RADIUS_KM && radius <= MAX_RADIUS_KM) {
    state.radiusKm = radius;
  }
  const sort = params.get('sort');
  if (sort === 'price' || sort === 'distance') state.sort = sort;
  if (params.get('x') === '1') state.expanded = true;
  return state;
}

/** Cadena de consulta del estado actual (vacía si no hay una búsqueda compartible). */
export function buildUrlSearch(input: {
  place: Place | null;
  fuel: FuelId;
  radiusKm: number;
  sort: SortKey;
}): string {
  const { place } = input;
  const ref = place ? placeRef(place) : null;
  if (!place || !ref) return '';
  const params = new URLSearchParams();
  params.set('q', formatRef(ref));
  params.set('fuel', input.fuel);
  if (usesRadius(place)) {
    params.set('r', String(input.radiusKm));
    if (place.kind === 'municipality' && place.expanded) params.set('x', '1');
  }
  if (
    input.sort !== 'price' &&
    (place.kind === 'postal' || place.kind === 'municipality' || place.kind === 'area')
  ) {
    params.set('sort', input.sort);
  }
  return `?${params.toString()}`;
}

export { DEFAULT_RADIUS_KM };
