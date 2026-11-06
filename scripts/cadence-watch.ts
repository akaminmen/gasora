import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDataset } from './build-dataset';
import {
  comparePrices,
  madridTime,
  summarize,
  type PriceMap,
  type Sample,
} from './cadence-compare';
import { fetchStations } from './ministry';

/**
 * `npm run cadence:watch`: toma una foto de los precios del Ministerio cada 15 minutos durante
 * unas 26 horas y, en cada una, cuenta cuántas estaciones han cambiado de precio respecto a la
 * anterior. Sirve para saber a qué horas cambian de verdad los precios (por ejemplo, si es en la
 * medianoche de Madrid). Resultado: docs/cadencia-horaria.json (se reescribe tras cada medición).
 *
 * Opciones: `--interval <min>` (15, mínimo 5), `--hours <h>` (26), `--once` (una sola medición).
 * Si se interrumpe y se vuelve a lanzar, continúa con la última foto guardada en .cache/.
 * Una petición cada 15 minutos son ≈ 104 en 26 h al servicio del Ministerio (ADR 007: sin límites
 * publicados; mismo cliente y cabeceras que la ingesta, con pocos reintentos). Este script no usa
 * OpenFreeMap.
 */
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const cacheFile = join(root, '.cache', 'cadence-watch-prices.json');
const outFile = join(root, 'docs', 'cadencia-horaria.json');

const args = process.argv.slice(2);
const option = (name: string, fallback: number) => {
  const index = args.indexOf(name);
  const value = index >= 0 ? Number(args[index + 1]) : NaN;
  return Number.isFinite(value) && value > 0 ? value : fallback;
};
const intervalMin = Math.max(5, option('--interval', 15));
const hours = option('--hours', 26);
const once = args.includes('--once');
const total = once ? 1 : Math.ceil((hours * 60) / intervalMin) + 1;

interface Measurement extends Sample {
  fechaApi?: string;
  estaciones?: number;
  priceHash?: string;
  estacionesNuevas?: number | null;
  estacionesRetiradas?: number | null;
  cambiosPorCombustible?: number[] | null;
}
interface Output {
  version: 1;
  nota: string;
  inicio: string;
  intervaloMin: number;
  mediciones: Measurement[];
  resumen: ReturnType<typeof summarize>;
}

async function readJson<T>(file: string, fallback: T): Promise<T> {
  try {
    return JSON.parse(await readFile(file, 'utf8')) as T;
  } catch {
    return fallback;
  }
}

const sleep = (ms: number) => new Promise((resolveSleep) => setTimeout(resolveSleep, ms));
const quiet = () => undefined;

let cache = await readJson<{ at: string; p: PriceMap } | null>(cacheFile, null);
const output = await readJson<Output>(outFile, {
  version: 1,
  nota: 'Cada medición compara con la anterior; las horas son de Madrid.',
  inicio: new Date().toISOString(),
  intervaloMin: intervalMin,
  mediciones: [],
  resumen: summarize([]),
});
output.intervaloMin = intervalMin;

console.log(
  `Medición cada ${intervalMin} min, ${total} mediciones (≈ ${Math.round((total * intervalMin) / 60)} h). ` +
    'Ctrl+C para parar; al relanzarlo continúa. El equipo no debe suspenderse.',
);

for (let i = 0; i < total; i++) {
  const started = Date.now();
  const now = new Date(started);
  const madrid = madridTime(now).text;
  let measurement: Measurement;
  try {
    const raw = await fetchStations(quiet, { retries: 2, baseDelayMs: 5000 });
    const { dataset } = buildDataset(raw, { demo: false });
    const current = dataset.prices.p;
    const diff = cache ? comparePrices(cache.p, current) : null;
    measurement = {
      at: now.toISOString(),
      madrid,
      minutesSincePrevious: cache
        ? Math.round((started - new Date(cache.at).getTime()) / 60_000)
        : null,
      changed: diff?.changed ?? null,
      cambiosPorCombustible: diff?.changedByFuel ?? null,
      estacionesNuevas: diff?.added ?? null,
      estacionesRetiradas: diff?.removed ?? null,
      fechaApi: raw.Fecha,
      estaciones: dataset.meta.stationCount,
      priceHash: dataset.meta.priceHash,
    };
    cache = { at: now.toISOString(), p: current };
    await mkdir(dirname(cacheFile), { recursive: true });
    await writeFile(cacheFile, JSON.stringify(cache));
  } catch (error) {
    measurement = {
      at: now.toISOString(),
      madrid,
      minutesSincePrevious: null,
      changed: null,
      error: error instanceof Error ? error.message : String(error),
    };
  }
  output.mediciones.push(measurement);
  output.resumen = summarize(output.mediciones);
  await writeFile(outFile, `${JSON.stringify(output, null, 2)}\n`);
  console.log(
    `[${i + 1}/${total}] ${madrid} (Madrid) · ` +
      (measurement.error
        ? `ERROR: ${measurement.error}`
        : measurement.changed === null
          ? 'primera foto guardada'
          : `${measurement.changed} estaciones con algún precio distinto (${measurement.minutesSincePrevious} min)`),
  );
  if (i < total - 1) await sleep(Math.max(0, intervalMin * 60_000 - (Date.now() - started)));
}

const top = output.resumen.horaConMasCambios;
console.log(
  top === null
    ? 'Sin cambios de precio en toda la observación.'
    : `Hora de Madrid con más cambios: ${String(top).padStart(2, '0')}:00–${String(top).padStart(2, '0')}:59. ` +
        `Ventana 23:30–01:30: ${output.resumen.ventanaMedianoche.estacionesConCambios} estaciones con cambios.`,
);
