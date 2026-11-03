import { FUELS, type FuelId, type PricesFile, type Station } from './data-schema';
import { buildResultSet, type ResultItem } from './resultset';

/** Radio de la «zona» con el que se compara una estación suelta (ficha y favoritos). */
export const ZONE_RADIUS_KM = 10;

/**
 * Posición de una estación entre las de su zona (a ≤ 10 km) para un combustible: tramo, ahorro por
 * depósito y si es la más barata. Devuelve null si la estación no vende ese combustible.
 */
export function zoneItem(
  stations: readonly Station[],
  prices: PricesFile['p'],
  station: Station,
  fuel: FuelId,
  liters: number,
): ResultItem | null {
  if (prices[station.id]?.[FUELS.indexOf(fuel)] == null) return null;
  const result = buildResultSet({
    stations,
    prices,
    fuel,
    place: { kind: 'location', label: station.n, lat: station.lat, lng: station.lng },
    radiusKm: ZONE_RADIUS_KM,
    brands: [],
    sort: 'price',
    liters,
    brandGroups: new Map(),
  });
  return result.items.find((i) => i.station.id === station.id) ?? null;
}

/** Primer combustible que vende la estación, empezando por el preferido. */
export function sellableFuel(
  prices: PricesFile['p'],
  id: string,
  preferred: FuelId,
): FuelId | null {
  const row = prices[id];
  if (!row) return null;
  if (row[FUELS.indexOf(preferred)] != null) return preferred;
  return FUELS.find((_, i) => row[i] != null) ?? null;
}
