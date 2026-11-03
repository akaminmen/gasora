import { mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import {
  metaSchema,
  pricesFileSchema,
  searchIndexSchema,
  stationsFileSchema,
} from '../src/lib/data-schema';
import { serializePrices } from './build-dataset';
import { validateDataset, type Dataset } from './validate';

const isUrl = (source: string) => /^https?:\/\//.test(source);

async function readText(source: string, file: string): Promise<string> {
  if (isUrl(source)) {
    const base = source.endsWith('/') ? source : `${source}/`;
    const response = await fetch(new URL(file, base), { headers: { 'Cache-Control': 'no-cache' } });
    if (!response.ok) throw new Error(`${file}: HTTP ${response.status}`);
    return response.text();
  }
  return readFile(join(source, file), 'utf8');
}

/** Lee y valida un dataset desde una carpeta o una URL base (el último publicado). */
export async function readDataset(source: string): Promise<Dataset> {
  const meta = metaSchema.parse(JSON.parse(await readText(source, 'meta.json')));
  const [stations, prices, searchIndex] = await Promise.all([
    readText(source, meta.stationsFile).then((t) => stationsFileSchema.parse(JSON.parse(t))),
    readText(source, 'prices.json').then((t) => pricesFileSchema.parse(JSON.parse(t))),
    readText(source, 'search-index.json').then((t) => searchIndexSchema.parse(JSON.parse(t))),
  ]);
  return validateDataset({ meta, stations, prices, searchIndex });
}

/** Escribe el dataset en `dir`; `meta.json` va el último para que nunca apunte a ficheros a medias. */
export async function writeDataset(dir: string, dataset: Dataset): Promise<void> {
  await mkdir(dir, { recursive: true });
  for (const name of await readdir(dir)) {
    if (/^stations\..+\.json$/.test(name)) await rm(join(dir, name));
  }
  await writeFile(join(dir, dataset.meta.stationsFile), JSON.stringify(dataset.stations));
  await writeFile(join(dir, 'prices.json'), serializePrices(dataset.prices));
  await writeFile(join(dir, 'search-index.json'), JSON.stringify(dataset.searchIndex));
  await writeFile(join(dir, 'meta.json'), JSON.stringify(dataset.meta, null, 2));
}
