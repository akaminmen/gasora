import { haversineKm } from './geo';
import { FUELS, type FuelId, type PricesFile, type Station } from './data-schema';
import { OTHER_BRAND, brandLabel } from './brands';
import { hasOrigin, usesRadius, type Place } from './place';
import { DEFAULT_LITERS, priceStats, savingPerTank, tierOf, type PriceStats } from './pricing';
import type { Tier } from './tiers';

export type SortKey = 'price' | 'distance';

export interface ResultItem {
  station: Station;
  /** Precio del combustible elegido, en milésimas de euro */
  price: number;
  tier: Tier;
  /** Es (una de) las más baratas del conjunto */
  best: boolean;
  /** Ahorro por depósito en euros; ≤ 0 si no ahorra */
  saving: number;
  /** Distancia en km; solo si hay un punto de origen */
  distanceKm?: number;
  /** Clave de filtro de la marca («otras» agrupa las pequeñas) */
  brandGroup: string;
}

export interface BrandCount {
  key: string;
  label: string;
  count: number;
}

export interface ResultSet {
  /** Todo el conjunto de resultados (antes del filtro de marcas), ordenado */
  items: ResultItem[];
  /** El conjunto filtrado por marcas, en el orden pedido: lo que se muestra */
  visible: ResultItem[];
  stats: PriceStats | null;
  brands: BrandCount[];
}

export interface ResultQuery {
  stations: readonly Station[];
  prices: PricesFile['p'];
  fuel: FuelId;
  place: Place;
  radiusKm: number;
  /** Marcas (claves de filtro) elegidas; vacío = todas */
  brands: readonly string[];
  sort: SortKey;
  liters?: number;
  /** Mapa brandKey → clave del filtro (ver `buildBrandGroups`) */
  brandGroups: ReadonlyMap<string, string>;
}

/**
 * Conjunto de resultados: estaciones de la búsqueda activa que venden el combustible elegido.
 * El ranking (tramos, «más barata», ahorro) se calcula sobre el conjunto completo y no cambia al
 * filtrar por marcas ni al mover el mapa.
 */
export function buildResultSet(query: ResultQuery): ResultSet {
  const { place, fuel } = query;
  const fuelIndex = FUELS.indexOf(fuel);
  const origin = hasOrigin(place);
  const byRadius = usesRadius(place);

  const candidates: { station: Station; price: number; distanceKm?: number }[] = [];
  for (const station of query.stations) {
    const price = query.prices[station.id]?.[fuelIndex];
    if (price === null || price === undefined) continue;
    if (place.kind === 'municipality' && !place.expanded) {
      if (station.mid !== place.id || station.pid !== place.pid) continue;
    } else if (place.kind === 'province') {
      if (station.pid !== place.id) continue;
    }
    let distanceKm: number | undefined;
    if (byRadius || origin) {
      distanceKm = haversineKm(place.lat, place.lng, station.lat, station.lng);
      if (byRadius && distanceKm > query.radiusKm) continue;
    }
    candidates.push({ station, price, ...(distanceKm !== undefined ? { distanceKm } : {}) });
  }

  const stats = priceStats(candidates.map((c) => c.price));
  const liters = query.liters ?? DEFAULT_LITERS;
  const items: ResultItem[] = stats
    ? candidates.map((c) => ({
        station: c.station,
        price: c.price,
        tier: tierOf(c.price, stats),
        best: c.price === stats.min,
        saving: savingPerTank(stats.mean, c.price, liters),
        ...(c.distanceKm !== undefined ? { distanceKm: c.distanceKm } : {}),
        brandGroup: query.brandGroups.get(c.station.b) ?? OTHER_BRAND,
      }))
    : [];

  const idOrder = (a: ResultItem, b: ResultItem) =>
    Number(a.station.id) - Number(b.station.id) || a.station.id.localeCompare(b.station.id);
  const byDistance = (a: ResultItem, b: ResultItem) => (a.distanceKm ?? 0) - (b.distanceKm ?? 0);
  // Por precio, desempata la distancia; por distancia, el precio.
  const compare =
    query.sort === 'distance' && origin
      ? (a: ResultItem, b: ResultItem) => byDistance(a, b) || a.price - b.price || idOrder(a, b)
      : (a: ResultItem, b: ResultItem) => a.price - b.price || byDistance(a, b) || idOrder(a, b);
  items.sort(compare);

  const counts = new Map<string, number>();
  for (const item of items) counts.set(item.brandGroup, (counts.get(item.brandGroup) ?? 0) + 1);
  const brands: BrandCount[] = [...counts]
    .map(([key, count]) => ({ key, label: brandLabel(key), count }))
    .sort(
      (a, b) =>
        Number(a.key === OTHER_BRAND) - Number(b.key === OTHER_BRAND) ||
        b.count - a.count ||
        a.label.localeCompare(b.label, 'es'),
    );

  const selected = new Set(query.brands);
  const visible = selected.size === 0 ? items : items.filter((i) => selected.has(i.brandGroup));
  return { items, visible, stats, brands };
}
