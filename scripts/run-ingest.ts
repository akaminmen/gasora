import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { buildDataset, formatReport, type RawResponse } from './build-dataset';
import { readDataset, writeDataset } from './dataset-io';
import { fetchStations as defaultFetchStations, stripBom } from './ministry';
import { checkStationDrop, MAX_STATION_DROP } from './validate';

export interface IngestOptions {
  /** Raíz del proyecto (para localizar fixtures/) */
  root: string;
  /** Carpeta de salida (public/data) */
  outDir: string;
  useFixtures?: boolean;
  /** Base de los datos publicados (en CI, la URL de GitHub Pages): respaldo si la API falla. */
  previousUrl?: string;
  /** Descarga de la API; los tests inyectan una que falla. */
  fetchStations?: (log: (message: string) => void) => Promise<RawResponse>;
  log?: (message: string) => void;
  warn?: (message: string) => void;
}

/**
 * Ingesta completa: descarga → normaliza → valida → escribe. Devuelve el código de salida:
 * 0 si hay datos nuevos o se conserva el dataset anterior (con aviso) y 1 si no hay datos válidos.
 */
export async function runIngest(options: IngestOptions): Promise<number> {
  const {
    root,
    outDir,
    useFixtures = false,
    previousUrl,
    fetchStations = (log) => defaultFetchStations(log),
    log = console.log,
    warn = console.warn,
  } = options;

  /** Dataset publicado anterior: la carpeta de salida y, si no sirve, la URL en vivo. */
  async function previousDataset() {
    for (const source of [outDir, previousUrl]) {
      if (!source) continue;
      try {
        return { source, dataset: await readDataset(source) };
      } catch {
        // Sin dato anterior en esta fuente: se prueba la siguiente.
      }
    }
    return null;
  }

  /** Cadena de respaldo (sección 5.3): conservar el último dato bueno. Devuelve false si no hay. */
  async function keepPrevious(reason: string): Promise<boolean> {
    const previous = await previousDataset();
    if (!previous) return false;
    warn(
      `${reason}. Se conserva el dataset anterior (${previous.source}), de ${previous.dataset.meta.sourceDate}.`,
    );
    if (previous.source !== outDir) await writeDataset(outDir, previous.dataset);
    return true;
  }

  let raw: RawResponse;
  if (useFixtures) {
    log('Modo --fixtures: datos de demostración (fixtures/estaciones-terrestres.sample.json)');
    const text = await readFile(
      join(root, 'fixtures', 'estaciones-terrestres.sample.json'),
      'utf8',
    );
    raw = JSON.parse(stripBom(text)) as RawResponse;
  } else {
    try {
      raw = await fetchStations(log);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (await keepPrevious(message)) return 0;
      log(`ERROR: ${message}. No hay dato anterior que conservar.`);
      return 1;
    }
  }

  let built;
  try {
    built = buildDataset(raw, { demo: useFixtures });
  } catch (error) {
    const message = `La respuesta no supera la validación: ${error instanceof Error ? error.message : String(error)}`;
    if (!useFixtures && (await keepPrevious(message))) return 0;
    log(`ERROR: ${message}`);
    return 1;
  }
  const { dataset, report } = built;
  log(formatReport(report));

  if (!useFixtures) {
    const previous = await previousDataset();
    const previousCount =
      previous && !previous.dataset.meta.demo ? previous.dataset.meta.stationCount : null;
    const { ok, drop } = checkStationDrop(previousCount, dataset.meta.stationCount);
    if (!ok) {
      const message = `Las estaciones caen un ${(drop * 100).toFixed(1)} % (umbral ${MAX_STATION_DROP * 100} %): respuesta parcial`;
      if (await keepPrevious(message)) return 0;
      log(`ERROR: ${message}`);
      return 1;
    }
  }

  await writeDataset(outDir, dataset);
  log(
    `Escrito en ${outDir}: ${dataset.meta.stationCount} estaciones, fuente ${dataset.meta.sourceDate}, ${dataset.meta.stationsFile}`,
  );
  return 0;
}
