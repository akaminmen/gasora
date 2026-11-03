import { savingPerTank } from './pricing';
import type { ResultItem } from './resultset';

export type CompareMode = 'avg' | 'near';

export interface CalcResult {
  /** La estación más barata del conjunto (la más cercana si hay empate) */
  best: ResultItem;
  /** Con qué se compara */
  reference: { label: string; price: number; station?: ResultItem };
  /** Ahorro por depósito en euros (≥ 0) */
  saving: number;
  /** La estación más cercana, si hay punto de origen */
  nearest?: ResultItem;
  mean: number;
  count: number;
}

/**
 * Ahorro por depósito de repostar en la más barata frente a la media de la zona o frente a la
 * estación más cercana (sección 7, F9). `near` solo existe si hay distancias; si no, devuelve null.
 */
export function calcSaving(
  items: readonly ResultItem[],
  mode: CompareMode,
  liters: number,
  mean: number,
): CalcResult | null {
  if (items.length === 0) return null;
  const best = items.reduce((a, b) =>
    b.price < a.price || (b.price === a.price && (b.distanceKm ?? 0) < (a.distanceKm ?? 0)) ? b : a,
  );
  const withDistance = items.filter((i) => i.distanceKm !== undefined);
  const nearest = withDistance.length
    ? withDistance.reduce((a, b) => ((b.distanceKm ?? 0) < (a.distanceKm ?? 0) ? b : a))
    : undefined;
  if (mode === 'near' && !nearest) return null;
  const reference =
    mode === 'avg' || !nearest
      ? { label: 'la media de la zona', price: mean }
      : { label: 'la más cercana', price: nearest.price, station: nearest };
  const saving = Math.max(0, savingPerTank(reference.price, best.price, liters));
  return { best, reference, saving, ...(nearest ? { nearest } : {}), mean, count: items.length };
}
