import { useEffect } from 'react';
import { useDataStore, type DataState } from '../stores/data';

export type { DataState };

/** Datos de gasolineras: una sola descarga compartida por todas las pantallas. */
export function useGasoraData(): { state: DataState; retry: () => void } {
  const state = useDataStore((s) => s.state);
  const load = useDataStore((s) => s.load);
  const retry = useDataStore((s) => s.retry);
  useEffect(() => {
    void load();
  }, [load]);
  return { state, retry: () => void retry() };
}
