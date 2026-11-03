import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/** Datos de prueba generados por `build:e2e` (ver scripts/e2e-data.ts): los mismos que sirve la app. */
const DIR = resolve(import.meta.dirname, '../../dist/data');
const read = <T>(file: string) => JSON.parse(readFileSync(resolve(DIR, file), 'utf8')) as T;

interface StationRow {
  id: string;
  n: string;
  b: string;
  pid: number;
  mid: number;
  z: string;
}

const meta = read<{ stationsFile: string }>('meta.json');
export const stations = read<{ stations: StationRow[] }>(meta.stationsFile).stations;
export const prices = read<{ p: Record<string, (number | null)[]> }>('prices.json').p;
export const searchIndex = read<{
  postalCodes: { code: string; count: number }[];
  municipalities: { id: number; name: string; count: number }[];
  provinces: { id: number; name: string; count: number }[];
}>('search-index.json');

export const FUEL_INDEX = { g95e5: 0, g98e5: 1, goa: 2, goap: 3, glp: 4, gnc: 5 } as const;

/** Código postal con más estaciones (zona densa para listas, filtros y mapa). */
export const BIG_CP = [...searchIndex.postalCodes].sort((a, b) => b.count - a.count)[0]?.code ?? '';

/** Estaciones que venden un combustible, por id (orden estable). */
export function sellers(fuel: keyof typeof FUEL_INDEX): StationRow[] {
  return stations.filter((s) => prices[s.id]?.[FUEL_INDEX[fuel]] != null);
}

/** Una estación que vende g95e5 y de la que se pueda decir que existe en la zona del CP grande. */
export function someStation(): StationRow {
  const s = sellers('g95e5').find((x) => x.z === BIG_CP) ?? sellers('g95e5')[0];
  if (!s) throw new Error('El conjunto de datos de prueba no tiene estaciones con gasolina 95');
  return s;
}
