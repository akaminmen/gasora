import {
  metaSchema,
  pricesFileSchema,
  searchIndexSchema,
  stationsFileSchema,
  type Meta,
  type PricesFile,
  type SearchIndex,
  type StationsFile,
} from '../src/lib/data-schema';

export interface Dataset {
  meta: Meta;
  stations: StationsFile;
  prices: PricesFile;
  searchIndex: SearchIndex;
}

/** Máxima caída admitida de estaciones respecto al dataset publicado anterior (sección 5.1). */
export const MAX_STATION_DROP = 0.2;

/** Valida el contrato con zod y la coherencia entre ficheros. Lanza si algo no cuadra. */
export function validateDataset(dataset: Dataset): Dataset {
  const meta = metaSchema.parse(dataset.meta);
  const stations = stationsFileSchema.parse(dataset.stations);
  const prices = pricesFileSchema.parse(dataset.prices);
  const searchIndex = searchIndexSchema.parse(dataset.searchIndex);

  if (meta.stationCount !== stations.stations.length) {
    throw new Error(
      `meta.stationCount (${meta.stationCount}) no coincide con las estaciones (${stations.stations.length})`,
    );
  }
  const ids = new Set(stations.stations.map((s) => s.id));
  if (ids.size !== stations.stations.length) throw new Error('Hay IDs de estación duplicados');
  for (const id of ids) {
    if (!prices.p[id]) throw new Error(`La estación ${id} no tiene fila de precios`);
  }
  for (const id of Object.keys(prices.p)) {
    if (!ids.has(id)) throw new Error(`Hay precios de la estación ${id}, que no existe`);
  }
  return { meta, stations, prices, searchIndex };
}

/** `ok` es false si el nº de estaciones cae más del umbral respecto al anterior. */
export function checkStationDrop(
  previous: number | null,
  next: number,
  maxDrop = MAX_STATION_DROP,
) {
  if (previous === null || previous <= 0) return { ok: true, drop: 0 };
  const drop = (previous - next) / previous;
  return { ok: drop <= maxDrop, drop };
}
