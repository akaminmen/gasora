import { z } from 'zod';
import { FUELS, PRICE_MAX, PRICE_MIN, SCHEMA_VERSION } from './fuel-ids';

// Las constantes viven en fuel-ids.ts para que la interfaz no cargue zod en el primer pintado.
export { FUELS, PRICE_MAX, PRICE_MIN, SCHEMA_VERSION };
export type { FuelId } from './fuel-ids';

const iso = z.iso.datetime();

export const metaSchema = z.object({
  schemaVersion: z.literal(SCHEMA_VERSION),
  /** Cuándo se generaron los ficheros. */
  generatedAt: iso,
  /** `Fecha` de la API en UTC: es la hora de la consulta, no la de actualización (ADR 001). */
  sourceDate: iso,
  stationCount: z.number().int().nonnegative(),
  priceHash: z.string().min(1),
  /**
   * Huella de todo lo que ve la persona usuaria: estaciones (altas, bajas, direcciones, marcas,
   * horarios), precios e índice de búsqueda. NO incluye ninguna fecha: no cambia porque cambie la hora
   * de la consulta. La usan la ingesta (para no desplegar datos idénticos) y el aviso «Hay precios
   * nuevos». Opcional: los datos publicados antes de este campo no la tienen.
   */
  contentHash: z.string().min(1).optional(),
  stationsFile: z.string().regex(/^stations\.[0-9a-f]+\.json$/),
  /** true si los datos vienen de `fixtures/` (rótulo «Datos de demostración»). */
  demo: z.boolean(),
});
export type Meta = z.infer<typeof metaSchema>;

export const stationSchema = z.object({
  id: z.string().min(1),
  /** brandKey */
  b: z.string().min(1),
  /** Rótulo limpio */
  n: z.string(),
  /** Dirección */
  a: z.string(),
  /** Código postal (5 dígitos o vacío) */
  z: z.string().regex(/^(\d{5})?$/),
  /** Provincia y municipio: solo los ids; los nombres están en el índice de búsqueda (ADR 011). */
  pid: z.number().int(),
  mid: z.number().int(),
  lat: z.number().min(27).max(44),
  lng: z.number().min(-19).max(5),
  /** Horario, texto tal cual */
  h: z.string(),
  /** Tipo de venta: P = pública */
  s: z.literal('P'),
});
export type Station = z.infer<typeof stationSchema>;

/**
 * Validación ligera para el navegador: la ingesta ya validó todos los ficheros con los esquemas
 * completos (`stationsFileSchema`, `pricesFileSchema`), así que aquí solo se comprueba la cabecera
 * y una muestra repartida de filas. Validar las ~11.350 estaciones en cada carga costaba ≈ 90 ms
 * de hilo principal en un portátil (≈ 350 ms en un móvil de gama media).
 */
export const SAMPLE_SIZE = 40;

/** Índices repartidos de forma uniforme (incluidos el primero y el último). */
export function sampleIndexes(length: number, count = SAMPLE_SIZE): number[] {
  if (length <= count) return Array.from({ length }, (_, i) => i);
  return Array.from({ length: count }, (_, i) => Math.round((i * (length - 1)) / (count - 1)));
}

export const stationsFileSchema = z.object({
  schema: z.literal(SCHEMA_VERSION),
  fuels: z.tuple([
    z.literal('g95e5'),
    z.literal('g98e5'),
    z.literal('goa'),
    z.literal('goap'),
    z.literal('glp'),
    z.literal('gnc'),
  ]),
  stations: z.array(stationSchema),
});
export type StationsFile = z.infer<typeof stationsFileSchema>;

export const priceRow = z
  .array(z.number().int().min(PRICE_MIN).max(PRICE_MAX).nullable())
  .length(FUELS.length);

export const pricesFileSchema = z.object({
  updatedAt: iso,
  /** id de estación → precios en milésimas de euro (null = no vende) */
  p: z.record(z.string(), priceRow),
});
export type PricesFile = z.infer<typeof pricesFileSchema>;

const bbox = z.tuple([z.number(), z.number(), z.number(), z.number()]);

export const searchIndexSchema = z.object({
  schema: z.literal(SCHEMA_VERSION),
  provinces: z.array(
    z.object({
      id: z.number().int(),
      name: z.string(),
      lat: z.number(),
      lng: z.number(),
      /** [latMin, lngMin, latMax, lngMax] */
      bbox,
      count: z.number().int().positive(),
    }),
  ),
  municipalities: z.array(
    z.object({
      id: z.number().int(),
      name: z.string(),
      pid: z.number().int(),
      lat: z.number(),
      lng: z.number(),
      bbox,
      count: z.number().int().positive(),
    }),
  ),
  postalCodes: z.array(
    z.object({
      code: z.string().regex(/^\d{5}$/),
      lat: z.number(),
      lng: z.number(),
      count: z.number().int().positive(),
    }),
  ),
});
export type SearchIndex = z.infer<typeof searchIndexSchema>;

const stationsHeader = z.object({
  schema: z.literal(SCHEMA_VERSION),
  fuels: stationsFileSchema.shape.fuels,
  stations: z.array(z.unknown()).min(1),
});
const pricesHeader = z.object({ updatedAt: iso, p: z.record(z.string(), z.unknown()) });

/** Comprueba la cabecera y una muestra de estaciones; devuelve el fichero tipado. */
export function parseStationsLight(json: unknown): StationsFile {
  const header = stationsHeader.parse(json);
  for (const i of sampleIndexes(header.stations.length)) stationSchema.parse(header.stations[i]);
  return json as StationsFile;
}

/** Comprueba la cabecera y una muestra de filas de precios; devuelve el fichero tipado. */
export function parsePricesLight(json: unknown): PricesFile {
  const header = pricesHeader.parse(json);
  const ids = Object.keys(header.p);
  for (const i of sampleIndexes(ids.length)) priceRow.parse(header.p[ids[i] as string]);
  return json as PricesFile;
}
