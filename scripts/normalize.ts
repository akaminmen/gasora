import { FUELS, PRICE_MAX, PRICE_MIN, type FuelId, type Station } from '../src/lib/data-schema';
import { brandKeyOf } from './brands';

/** Estación tal cual llega de la API: todos los valores son texto. */
export type RawStation = Record<string, unknown>;

/** Estación con los nombres de municipio y provincia, que solo se usan para el índice de búsqueda. */
export type NormalizedStation = Station & { m: string; p: string };

/** Quita los campos que no se publican en `stations.{hash}.json`. */
export function toPublishedStation(s: NormalizedStation): Station {
  return {
    id: s.id,
    b: s.b,
    n: s.n,
    a: s.a,
    z: s.z,
    pid: s.pid,
    mid: s.mid,
    lat: s.lat,
    lng: s.lng,
    h: s.h,
    s: s.s,
  };
}

/** Campo `Precio …` de la API para cada combustible del MVP. */
export const FUEL_FIELDS: Record<FuelId, string> = {
  g95e5: 'Precio Gasolina 95 E5',
  g98e5: 'Precio Gasolina 98 E5',
  goa: 'Precio Gasoleo A',
  goap: 'Precio Gasoleo Premium',
  glp: 'Precio Gases licuados del petróleo',
  gnc: 'Precio Gas Natural Comprimido',
};

export type DropReason =
  | 'sinId'
  | 'idDuplicado'
  | 'ventaRestringida'
  | 'coordenadasACero'
  | 'coordenadasIntercambiadas'
  | 'fueraDeEspana'
  | 'sinCombustibleMvp';

export interface Dropped {
  id: string;
  name: string;
  reason: DropReason;
  detail: string;
}

export interface OutOfRangePrice {
  id: string;
  fuel: FuelId;
  value: number;
}

export interface NormalizeResult {
  stations: NormalizedStation[];
  /** id → precios en milésimas de euro, en el orden de FUELS */
  prices: Record<string, (number | null)[]>;
  dropped: Dropped[];
  outOfRangePrices: OutOfRangePrice[];
  /** Rótulos que no casan con ninguna marca conocida, con su frecuencia */
  unknownBrands: Map<string, number>;
}

const SMALL_WORDS = new Set(['de', 'del', 'la', 'las', 'el', 'los', 'y', 'i', 'e']);
const ARTICLE_SUFFIX = /^(.+?)\s*\((El|La|Los|Las|L'|A|O|Os|As|Els|Les|Illes|Sa|Es|Ses|Lo)\)$/i;

export function clean(value: unknown): string {
  return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : '';
}

/** «1,459» → 1.459; vacío o no numérico → null. */
export function parseDecimal(value: unknown): number | null {
  const text = clean(value).replace(',', '.');
  if (!text) return null;
  const n = Number(text);
  return Number.isFinite(n) ? n : null;
}

/** «PALMAS (LAS)» → «Las Palmas»; «MÁLAGA» → «Málaga»; «Abengibre» se deja igual. */
export function displayName(value: unknown): string {
  let text = clean(value);
  const art = ARTICLE_SUFFIX.exec(text);
  if (art?.[1] && art[2]) {
    text = art[2].endsWith("'") ? `${art[2]}${art[1]}` : `${art[2]} ${art[1]}`;
  }
  if (text !== text.toUpperCase()) return text;
  const lower = text.toLowerCase();
  let first = true;
  return lower.replace(/[\p{L}\p{N}]+/gu, (word) => {
    const keep = !first && SMALL_WORDS.has(word);
    first = false;
    return keep ? word : word.charAt(0).toUpperCase() + word.slice(1);
  });
}

function postalCode(value: unknown): string {
  const text = clean(value);
  if (/^\d{4}$/.test(text)) return `0${text}`;
  return /^\d{5}$/.test(text) ? text : '';
}

const inSpain = (lat: number, lng: number) => lat >= 27 && lat <= 44 && lng >= -19 && lng <= 5;

export function normalizeStations(raw: RawStation[]): NormalizeResult {
  const stations: NormalizedStation[] = [];
  const prices: Record<string, (number | null)[]> = {};
  const dropped: Dropped[] = [];
  const outOfRangePrices: OutOfRangePrice[] = [];
  const unknownBrands = new Map<string, number>();
  const seen = new Set<string>();

  for (const r of raw) {
    const id = clean(r['IDEESS']);
    const name = clean(r['Rótulo']);
    const drop = (reason: DropReason, detail: string) => dropped.push({ id, name, reason, detail });

    if (!id) {
      drop('sinId', 'IDEESS vacío');
      continue;
    }
    if (seen.has(id)) {
      drop('idDuplicado', 'IDEESS repetido');
      continue;
    }
    seen.add(id);

    // Ventas restringidas (cooperativas, flotas): fuera del ranking (sección 3.3).
    const saleType = clean(r['Tipo Venta']).toUpperCase();
    if (saleType !== 'P') {
      drop('ventaRestringida', `Tipo Venta «${saleType}»`);
      continue;
    }

    const lat = parseDecimal(r['Latitud']);
    const lng = parseDecimal(r['Longitud (WGS84)']);
    if (lat === null || lng === null || (lat === 0 && lng === 0)) {
      drop('coordenadasACero', `lat ${clean(r['Latitud'])}, lng ${clean(r['Longitud (WGS84)'])}`);
      continue;
    }
    if (!inSpain(lat, lng)) {
      // Se descartan y se registran, nunca se corrigen (ADR 004).
      drop(
        inSpain(lng, lat) ? 'coordenadasIntercambiadas' : 'fueraDeEspana',
        `lat ${lat}, lng ${lng}`,
      );
      continue;
    }

    const row: (number | null)[] = FUELS.map((fuel) => {
      const value = parseDecimal(r[FUEL_FIELDS[fuel]]);
      if (value === null) return null;
      const milli = Math.round(value * 1000);
      if (milli < PRICE_MIN || milli > PRICE_MAX) {
        outOfRangePrices.push({ id, fuel, value: milli });
        return null;
      }
      return milli;
    });
    if (row.every((v) => v === null)) {
      drop('sinCombustibleMvp', 'No vende ninguno de los 6 combustibles del MVP');
      continue;
    }

    const brand = brandKeyOf(name);
    if (brand === 'otras') unknownBrands.set(name, (unknownBrands.get(name) ?? 0) + 1);

    stations.push({
      id,
      b: brand,
      n: name || 'SIN RÓTULO',
      a: clean(r['Dirección']),
      z: postalCode(r['C.P.']),
      m: displayName(r['Municipio']),
      p: displayName(r['Provincia']),
      pid: Number.parseInt(clean(r['IDProvincia']), 10),
      mid: Number.parseInt(clean(r['IDMunicipio']), 10),
      lat: Math.round(lat * 1e6) / 1e6,
      lng: Math.round(lng * 1e6) / 1e6,
      h: clean(r['Horario']),
      s: 'P',
    });
    prices[id] = row;
  }

  return { stations, prices, dropped, outOfRangePrices, unknownBrands };
}

/** `Fecha` de la API (hora de Madrid, «28/10/2026 16:39:26» o «27/10/2026 0:00:00») → ISO UTC. */
export function parseMineturDate(text: string): string {
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4}) (\d{1,2}):(\d{2}):(\d{2})$/.exec(text.trim());
  if (!m) throw new Error(`Fecha del Ministerio con formato inesperado: «${text}»`);
  const [day, month, year, hour, minute, second] = m.slice(1).map(Number) as [
    number,
    number,
    number,
    number,
    number,
    number,
  ];
  const wall = Date.UTC(year, month - 1, day, hour, minute, second);
  // Dos pasadas: el desfase de Madrid depende del instante UTC resultante.
  const first = wall - madridOffsetMs(wall);
  return new Date(wall - madridOffsetMs(first)).toISOString();
}

function madridOffsetMs(utcMs: number): number {
  const seconds = Math.floor(utcMs / 1000) * 1000;
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Madrid',
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(new Date(seconds));
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  const asUtc = Date.UTC(
    get('year'),
    get('month') - 1,
    get('day'),
    get('hour'),
    get('minute'),
    get('second'),
  );
  return asUtc - seconds;
}
