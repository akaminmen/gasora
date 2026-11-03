import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDataset } from './build-dataset';
import { fetchStations } from './ministry';

/**
 * Mide la cadencia real de actualización de precios: guarda una medición y la compara con la
 * anterior. Ejecútalo varias veces con horas de diferencia (`npm run cadence`).
 * El resultado queda en docs/cadencia.json; los precios de la última medición, en .cache/.
 */
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const cacheFile = join(root, '.cache', 'cadence-prices.json');
const logFile = join(root, 'docs', 'cadencia.json');

interface Measurement {
  medidoEn: string;
  fechaApi: string;
  estaciones: number;
  priceHash: string;
  minutosDesdeLaAnterior: number | null;
  preciosCambiados: number | null;
  estacionesNuevas: number | null;
  estacionesRetiradas: number | null;
}

async function readJson<T>(file: string, fallback: T): Promise<T> {
  try {
    return JSON.parse(await readFile(file, 'utf8')) as T;
  } catch {
    return fallback;
  }
}

const raw = await fetchStations();
const { dataset } = buildDataset(raw, { demo: false });
const now = new Date();

const cache = await readJson<{ medidoEn: string; p: Record<string, (number | null)[]> } | null>(
  cacheFile,
  null,
);
const log = await readJson<{ mediciones: Measurement[] }>(logFile, { mediciones: [] });

let changed: number | null = null;
let added: number | null = null;
let removed: number | null = null;
let minutes: number | null = null;
if (cache) {
  const current = dataset.prices.p;
  changed = Object.keys(current).filter(
    (id) => cache.p[id] && JSON.stringify(cache.p[id]) !== JSON.stringify(current[id]),
  ).length;
  added = Object.keys(current).filter((id) => !cache.p[id]).length;
  removed = Object.keys(cache.p).filter((id) => !current[id]).length;
  minutes = Math.round((now.getTime() - new Date(cache.medidoEn).getTime()) / 60_000);
}

const measurement: Measurement = {
  medidoEn: now.toISOString(),
  fechaApi: raw.Fecha,
  estaciones: dataset.meta.stationCount,
  priceHash: dataset.meta.priceHash,
  minutosDesdeLaAnterior: minutes,
  preciosCambiados: changed,
  estacionesNuevas: added,
  estacionesRetiradas: removed,
};
log.mediciones.push(measurement);

await mkdir(dirname(cacheFile), { recursive: true });
await writeFile(cacheFile, JSON.stringify({ medidoEn: measurement.medidoEn, p: dataset.prices.p }));
await writeFile(logFile, `${JSON.stringify(log, null, 2)}\n`);

console.log(JSON.stringify(measurement, null, 2));
console.log(
  cache
    ? `Desde la medición anterior (hace ${minutes} min): ${changed} estaciones con algún precio distinto, ${added} nuevas, ${removed} retiradas.`
    : 'Primera medición guardada. Vuelve a ejecutar `npm run cadence` dentro de unas horas para compararla.',
);
