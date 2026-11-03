import type { ResultItem } from '../../lib/resultset';

/** Pines HTML solo para las estaciones más relevantes de la vista (sección 10 del plan). */
export const MAX_PINS = 60;

/**
 * Elige qué estaciones llevan pin: de las que están a la vista y sin agrupar, la seleccionada
 * primero, luego las «más baratas» y después las de menor precio. La seleccionada siempre lleva
 * pin, aunque esté fuera de la vista o agrupada.
 */
export function choosePins(
  visibleIds: Iterable<string>,
  byId: ReadonlyMap<string, ResultItem>,
  selectedId: string | null,
  max = MAX_PINS,
): string[] {
  const ranked = [...new Set(visibleIds)]
    .map((id) => byId.get(id))
    .filter((item): item is ResultItem => item !== undefined)
    .sort(
      (a, b) =>
        Number(b.station.id === selectedId) - Number(a.station.id === selectedId) ||
        Number(b.best) - Number(a.best) ||
        a.price - b.price ||
        a.station.id.localeCompare(b.station.id),
    )
    .slice(0, max)
    .map((item) => item.station.id);
  if (selectedId && byId.has(selectedId) && !ranked.includes(selectedId)) {
    ranked.unshift(selectedId);
    if (ranked.length > max) ranked.pop();
  }
  return ranked;
}
