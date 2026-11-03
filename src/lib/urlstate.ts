import { FUELS, type FuelId } from './data-schema';
import { DEFAULT_RADIUS_KM, MAX_RADIUS_KM, MIN_RADIUS_KM, usesRadius, type Place } from './place';
import type { SortKey } from './resultset';

/**
 * Estado de la búsqueda en la URL (F14): `/?q=29002&fuel=g95e5&r=5&sort=price`.
 *  - `q`: `29002` (código postal), `m<id>` (municipio) o `p<id>` (provincia). La ubicación del
 *    usuario nunca se escribe en la URL (privacidad): «cerca de ti» no es compartible.
 *  - `x=1`: municipio ampliado a un radio. `r`: radio en km. `sort`: `price` | `distance`.
 */
export type PlaceRef =
  | { kind: 'postal'; code: string }
  | { kind: 'municipality'; id: number }
  | { kind: 'province'; id: number };

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
    default:
      return null;
  }
}

function formatRef(ref: PlaceRef): string {
  if (ref.kind === 'postal') return ref.code;
  return `${ref.kind === 'municipality' ? 'm' : 'p'}${ref.id}`;
}

function parseRef(value: string | null): PlaceRef | undefined {
  if (!value) return undefined;
  if (/^\d{5}$/.test(value)) return { kind: 'postal', code: value };
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
  if (input.sort !== 'price' && (place.kind === 'postal' || place.kind === 'municipality')) {
    params.set('sort', input.sort);
  }
  return `?${params.toString()}`;
}

export { DEFAULT_RADIUS_KM };
