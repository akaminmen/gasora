import type { Tier } from './tiers';

/** Litros del depósito por defecto para calcular el ahorro (sección 6 del plan). */
export const DEFAULT_LITERS = 50;

/** Cuantil por interpolación lineal sobre una lista ya ordenada (q entre 0 y 1). */
export function quantile(sorted: readonly number[], q: number): number {
  if (sorted.length === 0) return NaN;
  const position = (sorted.length - 1) * q;
  const lower = Math.floor(position);
  const upper = Math.ceil(position);
  const low = sorted[lower] as number;
  const high = sorted[upper] as number;
  return low + (high - low) * (position - lower);
}

export interface PriceStats {
  count: number;
  min: number;
  max: number;
  /** Media en milésimas de euro (sin redondear) */
  mean: number;
  p20: number;
  p60: number;
  p85: number;
}

/** Estadísticas del conjunto de resultados completo (no del viewport). */
export function priceStats(prices: readonly number[]): PriceStats | null {
  if (prices.length === 0) return null;
  const sorted = [...prices].sort((a, b) => a - b);
  const sum = sorted.reduce((total, p) => total + p, 0);
  return {
    count: sorted.length,
    min: sorted[0] as number,
    max: sorted[sorted.length - 1] as number,
    mean: sum / sorted.length,
    p20: quantile(sorted, 0.2),
    p60: quantile(sorted, 0.6),
    p85: quantile(sorted, 0.85),
  };
}

/** Con menos de 5 resultados los cuantiles no significan nada: se usa la escala min/max. */
export const MIN_FOR_QUANTILES = 5;

/**
 * Tramo relativo: barato (≤ P20), medio (≤ P60), alto (≤ P85) y caro (> P85).
 * Si hay menos de 5 resultados se reparte el rango entre el mínimo y el máximo con los mismos
 * cortes (20 %, 60 % y 85 %). Si todos cuestan lo mismo, todos son «baratos».
 */
export function tierOf(price: number, stats: PriceStats): Tier {
  if (stats.max === stats.min) return 'cheap';
  if (stats.count < MIN_FOR_QUANTILES) {
    const t = (price - stats.min) / (stats.max - stats.min);
    if (t <= 0.2) return 'cheap';
    if (t <= 0.6) return 'mid';
    if (t <= 0.85) return 'high';
    return 'top';
  }
  if (price <= stats.p20) return 'cheap';
  if (price <= stats.p60) return 'mid';
  if (price <= stats.p85) return 'high';
  return 'top';
}

/**
 * Ahorro por depósito en euros: (media − precio) × litros, redondeado a céntimos.
 * Los precios van en milésimas de euro por litro. Puede ser ≤ 0: la tarjeta solo muestra el
 * positivo.
 */
export function savingPerTank(meanMilli: number, priceMilli: number, liters: number): number {
  return Math.round(((meanMilli - priceMilli) / 1000) * liters * 100) / 100;
}
