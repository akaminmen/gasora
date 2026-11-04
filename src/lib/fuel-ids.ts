/** Contrato del JSON generado por la ingesta y leído por la app. */
export const SCHEMA_VERSION = 1;

/** Orden de `fuels`: define el índice de cada precio en prices.json (ADR 002: sin E10). */
export const FUELS = ['g95e5', 'g98e5', 'goa', 'goap', 'glp', 'gnc'] as const;
export type FuelId = (typeof FUELS)[number];

/** Rango de cordura en milésimas de euro por litro (sección 5.1 del plan). */
export const PRICE_MIN = 500;
export const PRICE_MAX = 4000;
