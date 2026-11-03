import { createHash } from 'node:crypto';
import {
  FUELS,
  SCHEMA_VERSION,
  type FuelId,
  type PricesFile,
  type StationsFile,
} from '../src/lib/data-schema';
import {
  normalizeStations,
  parseMineturDate,
  toPublishedStation,
  type DropReason,
  type Dropped,
  type RawStation,
} from './normalize';
import { buildSearchIndex } from './search-index';
import { validateDataset, type Dataset } from './validate';

/** Respuesta de EstacionesTerrestres/ (forma que usa la ingesta). */
export interface RawResponse {
  Fecha: string;
  ListaEESSPrecio: RawStation[];
  ResultadoConsulta: string;
  Nota?: string;
}

export interface IngestReport {
  rawCount: number;
  keptCount: number;
  dropsByReason: Partial<Record<DropReason, number>>;
  dropped: Dropped[];
  outOfRangePrices: number;
  /** Estaciones con precio por combustible */
  perFuel: Record<FuelId, number>;
  /** Rótulos sin marca conocida, los más frecuentes primero */
  topUnknownBrands: [string, number][];
}

export const sha = (text: string, length: number) =>
  createHash('sha256').update(text).digest('hex').slice(0, length);

export const sortById = <T extends { id: string }>(list: T[]) =>
  [...list].sort((a, b) => Number(a.id) - Number(b.id) || a.id.localeCompare(b.id));

/** Serialización compacta de prices.json. */
export function serializePrices(prices: PricesFile): string {
  return JSON.stringify(prices);
}

export function buildDataset(
  raw: RawResponse,
  options: { demo: boolean; now?: Date },
): { dataset: Dataset; report: IngestReport } {
  if (raw.ResultadoConsulta !== 'OK') {
    throw new Error(`ResultadoConsulta = «${raw.ResultadoConsulta}»`);
  }
  if (!Array.isArray(raw.ListaEESSPrecio)) throw new Error('Falta ListaEESSPrecio');

  const result = normalizeStations(raw.ListaEESSPrecio);
  const sourceDate = parseMineturDate(raw.Fecha);
  const normalized = sortById(result.stations);
  const stations = normalized.map(toPublishedStation);

  const stationsFile: StationsFile = {
    schema: SCHEMA_VERSION,
    fuels: [...FUELS] as StationsFile['fuels'],
    stations,
  };
  const prices: PricesFile = {
    updatedAt: sourceDate,
    p: Object.fromEntries(stations.map((s) => [s.id, result.prices[s.id] ?? []])),
  };

  const dataset = validateDataset({
    meta: {
      schemaVersion: SCHEMA_VERSION,
      generatedAt: (options.now ?? new Date()).toISOString(),
      sourceDate,
      stationCount: stations.length,
      // Solo los precios: `updatedAt` cambia en cada consulta aunque los precios no cambien.
      priceHash: sha(JSON.stringify(prices.p), 12),
      stationsFile: `stations.${sha(JSON.stringify(stationsFile), 10)}.json`,
      demo: options.demo,
    },
    stations: stationsFile,
    prices,
    searchIndex: buildSearchIndex(normalized),
  });

  const dropsByReason: IngestReport['dropsByReason'] = {};
  for (const d of result.dropped) dropsByReason[d.reason] = (dropsByReason[d.reason] ?? 0) + 1;

  const perFuel = Object.fromEntries(
    FUELS.map((fuel, i) => [fuel, Object.values(prices.p).filter((row) => row[i] != null).length]),
  ) as Record<FuelId, number>;

  return {
    dataset,
    report: {
      rawCount: raw.ListaEESSPrecio.length,
      keptCount: stations.length,
      dropsByReason,
      dropped: result.dropped,
      outOfRangePrices: result.outOfRangePrices.length,
      perFuel,
      topUnknownBrands: [...result.unknownBrands].sort((a, b) => b[1] - a[1]).slice(0, 15),
    },
  };
}

export function formatReport(report: IngestReport): string {
  const lines = [
    `Estaciones en la respuesta: ${report.rawCount}`,
    `Estaciones conservadas: ${report.keptCount}`,
    `Estaciones descartadas: ${report.dropped.length}`,
    ...Object.entries(report.dropsByReason).map(([reason, n]) => `  - ${reason}: ${n}`),
    `Precios fuera de rango (puestos a null): ${report.outOfRangePrices}`,
    'Estaciones con precio por combustible:',
    ...Object.entries(report.perFuel).map(([fuel, n]) => `  - ${fuel}: ${n}`),
  ];
  const weird = report.dropped.filter(
    (d) =>
      d.reason === 'coordenadasACero' ||
      d.reason === 'coordenadasIntercambiadas' ||
      d.reason === 'fueraDeEspana',
  );
  if (weird.length) {
    lines.push('Estaciones con coordenadas defectuosas (descartadas, no corregidas):');
    for (const d of weird) lines.push(`  - ${d.id} ${d.name}: ${d.reason} (${d.detail})`);
  }
  if (report.topUnknownBrands.length) {
    lines.push('Rótulos sin marca conocida más frecuentes:');
    for (const [name, n] of report.topUnknownBrands) lines.push(`  - ${name || '(vacío)'}: ${n}`);
  }
  return lines.join('\n');
}
