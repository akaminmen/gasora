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

/**
 * Solo `meta.json` (≈ 300 bytes), con revalidación (`no-cache`: el navegador pregunta al servidor con
 * `If-None-Match`/ETag y no se queda con la copia de hasta 10 minutos de GitHub Pages). Sin copia
 * local de respaldo: si no hay red, lanza el error.
 */
export async function loadLatestMeta(): Promise<Meta> {
  const { json } = await getJson('meta.json', 'no-cache', false);
  return metaSchema.parse(json);
}

/**
 * Descarga en segundo plano lo necesario para pasar de los datos actuales a los de `latest`: los
 * precios siempre y las estaciones solo si cambió su fichero. No toca nada de la pantalla.
 */
export async function loadUpdate(latest: Meta, current: GasoraData): Promise<GasoraData> {
  const [prices, stations] = await Promise.all([
    getJson('prices.json', 'no-cache', false).then((r) => parsePricesLight(r.json)),
    latest.stationsFile === current.meta.stationsFile
      ? Promise.resolve(current.stations)
      : getJson(latest.stationsFile, 'default', false).then((r) => parseStationsLight(r.json)),
  ]);
  // meta.json y prices.json se publican juntos: si no casan, se está publicando justo ahora
  if (prices.updatedAt !== latest.sourceDate) throw new Error('Datos a medio publicar');
  return { meta: latest, stations, prices, fromCache: false };
}

/** El índice de búsqueda se carga bajo demanda (no forma parte de la carga inicial). */
export async function loadSearchIndex(): Promise<SearchIndex> {
  const { json } = await getJson('search-index.json', 'default', true);
  return searchIndexSchema.parse(json);
}
