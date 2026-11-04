import {
  metaSchema,
  parsePricesLight,
  parseStationsLight,
  searchIndexSchema,
  type Meta,
  type PricesFile,
  type SearchIndex,
  type StationsFile,
} from './data-schema';

export interface GasoraData {
  meta: Meta;
  stations: StationsFile;
  prices: PricesFile;
  /** true si la red falló y se muestran los últimos datos guardados en este dispositivo */
  fromCache: boolean;
}

const CACHE_NAME = 'gasora-data-v1';
const url = (file: string) => `${import.meta.env.BASE_URL}data/${file}`;

async function openCache(): Promise<Cache | null> {
  try {
    return typeof caches === 'undefined' ? null : await caches.open(CACHE_NAME);
  } catch {
    return null;
  }
}

/** Guarda la copia de `file` y borra las versiones antiguas de `stations.{hash}.json`. */
async function remember(file: string, response: Response): Promise<void> {
  const cache = await openCache();
  if (!cache) return;
  try {
    if (/^stations\..+\.json$/.test(file)) {
      for (const request of await cache.keys()) {
        if (/\/data\/stations\..+\.json$/.test(request.url)) await cache.delete(request);
      }
    }
    await cache.put(url(file), response);
  } catch {
    // Sin espacio o sin permiso: simplemente no hay copia sin conexión.
  }
}

/**
 * Descarga `file` (con la copia local como respaldo si la red falla) y devuelve el JSON.
 * `meta.json` y `prices.json` cambian a menudo (sin caché HTTP); `stations.{hash}.json` y
 * `search-index.json` se piden con la caché normal del navegador.
 */
async function getJson(
  file: string,
  mode: RequestCache,
  allowCache: boolean,
): Promise<{ json: unknown; fromCache: boolean }> {
  try {
    const response = await fetch(url(file), { cache: mode });
    if (!response.ok) throw new Error(`No se pudo cargar ${file} (HTTP ${response.status})`);
    void remember(file, response.clone());
    return { json: await response.json(), fromCache: false };
  } catch (error) {
    if (allowCache) {
      const cached = await (await openCache())?.match(url(file));
      if (cached) return { json: await cached.json(), fromCache: true };
    }
    throw error;
  }
}

/** Nombre con hash del fichero de estaciones que el build escribe en `index.html` (o `undefined`). */
export function readStationsHint(): string | undefined {
  if (typeof document === 'undefined') return undefined;
  const content = document
    .querySelector<HTMLMetaElement>('meta[name="gasora-stations"]')
    ?.content.trim();
  return content && /^stations\.[0-9a-f]+\.json$/.test(content) ? content : undefined;
}

/**
 * Carga meta, estaciones y precios. Si no hay red, usa la última copia guardada (con aviso).
 * Las tres peticiones salen a la vez: el nombre del fichero de estaciones se conoce por el `index.html`
 * (`hint`) sin esperar a `meta.json`. Si el nombre ya no es el vigente (un `index.html` guardado de
 * antes de un cambio de estaciones) o falla, se descarga el de `meta.json` como siempre.
 */
export async function loadData(hint: string | undefined = readStationsHint()): Promise<GasoraData> {
  const metaRequest = getJson('meta.json', 'no-cache', true);
  const pricesRequest = getJson('prices.json', 'no-cache', true);
  const hintedRequest = hint ? getJson(hint, 'default', true).catch(() => null) : null;
  const [metaResult, pricesResult] = await Promise.all([metaRequest, pricesRequest]);
  const meta = metaSchema.parse(metaResult.json);
  const hinted = hint === meta.stationsFile ? await hintedRequest : null;
  const stationsResult = hinted ?? (await getJson(meta.stationsFile, 'default', true));
  return {
    meta,
    stations: parseStationsLight(stationsResult.json),
    prices: parsePricesLight(pricesResult.json),
    fromCache: metaResult.fromCache || stationsResult.fromCache || pricesResult.fromCache,
  };
}

/** Descarga solo meta y precios, que son lo único que cambia entre despliegues. */
export async function loadFreshPrices(): Promise<{ meta: Meta; prices: PricesFile }> {
  const [meta, prices] = await Promise.all([
    getJson('meta.json', 'no-cache', false).then((r) => metaSchema.parse(r.json)),
    getJson('prices.json', 'no-cache', false).then((r) => parsePricesLight(r.json)),
  ]);
  return { meta, prices };
}

/** El índice de búsqueda se carga bajo demanda (no forma parte de la carga inicial). */
export async function loadSearchIndex(): Promise<SearchIndex> {
  const { json } = await getJson('search-index.json', 'default', true);
  return searchIndexSchema.parse(json);
}
