import type { RawResponse } from './build-dataset';

/** Dos dominios del Ministerio activos con el mismo contenido (Fase 0): se alternan entre intentos. */
const BASES = [
  'https://sedeaplicaciones.minetur.gob.es/ServiciosRESTCarburantes/PreciosCarburantes/',
  'https://energia.serviciosmin.gob.es/ServiciosRestCarburantes/PreciosCarburantes/',
];

// La API ha cerrado conexiones a clientes que no parecen un navegador (sección 3.2).
const HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
  Accept: 'application/json',
  'Accept-Language': 'es-ES,es;q=0.9',
  Referer: 'https://geoportalgasolineras.es/',
};

export interface FetchOptions {
  /** Implementación de fetch (los tests inyectan una que simula 503 o un timeout). */
  fetchImpl?: typeof fetch;
  /** Reintentos tras el primer intento (por defecto 4). */
  retries?: number;
  /** Retardo base del backoff exponencial en ms (por defecto 1000). */
  baseDelayMs?: number;
  /** Timeout de cada intento en ms (por defecto 60 000). */
  timeoutMs?: number;
}

/** Quita la marca BOM inicial, si la hay. */
export const stripBom = (text: string) => (text.charCodeAt(0) === 0xfeff ? text.slice(1) : text);

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Descarga EstacionesTerrestres/ con timeout de 60 s y 4 reintentos con backoff exponencial. */
export async function fetchStations(
  log: (message: string) => void = console.log,
  options: FetchOptions = {},
): Promise<RawResponse> {
  const { fetchImpl = fetch, retries = 4, baseDelayMs = 1000, timeoutMs = 60_000 } = options;
  let lastError: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    const url = `${BASES[attempt % BASES.length]}EstacionesTerrestres/`;
    try {
      log(`Descargando (intento ${attempt + 1}/${retries + 1}): ${url}`);
      const response = await fetchImpl(url, {
        headers: HEADERS,
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status} ${response.statusText}`);
      const text = stripBom(await response.text());
      const json = JSON.parse(text) as RawResponse;
      if (json.ResultadoConsulta !== 'OK' || !Array.isArray(json.ListaEESSPrecio)) {
        throw new Error(`Respuesta inesperada (ResultadoConsulta = «${json.ResultadoConsulta}»)`);
      }
      log(`Recibidas ${json.ListaEESSPrecio.length} estaciones (${text.length} caracteres)`);
      return json;
    } catch (error) {
      lastError = error;
      const message = error instanceof Error ? error.message : String(error);
      log(`Intento ${attempt + 1} fallido: ${message}`);
      if (attempt < retries) await sleep(baseDelayMs * 2 ** attempt * (0.75 + Math.random() * 0.5));
    }
  }
  throw new Error(
    `No se pudo descargar la API del Ministerio: ${lastError instanceof Error ? lastError.message : String(lastError)}`,
  );
}
