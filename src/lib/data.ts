import {
  metaSchema,
  pricesFileSchema,
  stationsFileSchema,
  type Meta,
  type PricesFile,
  type StationsFile,
} from './data-schema';

export interface GasoraData {
  meta: Meta;
  stations: StationsFile;
  prices: PricesFile;
}

async function getJson(file: string, cache: RequestCache): Promise<unknown> {
  const response = await fetch(`${import.meta.env.BASE_URL}data/${file}`, { cache });
  if (!response.ok) throw new Error(`No se pudo cargar ${file} (HTTP ${response.status})`);
  return response.json();
}

/** meta.json y prices.json cambian a menudo (sin caché); stations.{hash}.json es inmutable. */
export async function loadData(): Promise<GasoraData> {
  const meta = metaSchema.parse(await getJson('meta.json', 'no-cache'));
  const [stations, prices] = await Promise.all([
    getJson(meta.stationsFile, 'default').then((json) => stationsFileSchema.parse(json)),
    getJson('prices.json', 'no-cache').then((json) => pricesFileSchema.parse(json)),
  ]);
  return { meta, stations, prices };
}
