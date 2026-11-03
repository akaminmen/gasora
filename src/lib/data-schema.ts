import { z } from 'zod';

/** Contrato del JSON generado por la ingesta y leído por la app. */
export const SCHEMA_VERSION = 1;

/** Orden de `fuels`: define el índice de cada precio en prices.json (ADR 002: sin E10). */
export const FUELS = ['g95e5', 'g98e5', 'goa', 'goap', 'glp', 'gnc'] as const;
export type FuelId = (typeof FUELS)[number];

/** Rango de cordura en milésimas de euro por litro (sección 5.1 del plan). */
export const PRICE_MIN = 500;
export const PRICE_MAX = 4000;

const iso = z.iso.datetime();

export const metaSchema = z.object({
  schemaVersion: z.literal(SCHEMA_VERSION),
  /** Cuándo se generaron los ficheros. */
  generatedAt: iso,
  /** `Fecha` de la API en UTC: es la hora de la consulta, no la de actualización (ADR 001). */
  sourceDate: iso,
  stationCount: z.number().int().nonnegative(),
  priceHash: z.string().min(1),
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

const priceRow = z
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
