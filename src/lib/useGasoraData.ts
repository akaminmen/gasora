import { useEffect } from 'react';
import { useDataStore, type DataState } from '../stores/data';

export type { DataState };

/** Pausa antes de descargar los datos en las pantallas que no los necesitan para mostrarse. */
export const DEFER_MS = 3500;

/** Ejecuta `callback` pasado un tiempo y con el navegador libre; devuelve la función que lo cancela. */
function afterIdle(callback: () => void, delay: number): () => void {
  let idle: number | undefined;
  const timer = window.setTimeout(() => {
    if (typeof window.requestIdleCallback === 'function') {
      idle = window.requestIdleCallback(callback, { timeout: 1000 });
    } else {
      callback();
    }
  }, delay);
  return () => {
    window.clearTimeout(timer);
    if (idle !== undefined) window.cancelIdleCallback(idle);
  };
}

/**
 * Datos de gasolineras: una sola descarga compartida por todas las pantallas.
 * Con `defer`, la descarga espera unos segundos y a que el navegador esté libre: la usan el pie,
 * «Acerca de» y el estado del inicio, que no necesitan los datos para el primer pintado ni para
 * lo que se mide en él (LCP, bloqueo del hilo principal). Quien muestra datos (resultados,
 * favoritos, ficha…) la pide en cuanto se monta.
 */
export function useGasoraData(options: { defer?: boolean } = {}): {
  state: DataState;
  retry: () => void;
} {
  const state = useDataStore((s) => s.state);
  const load = useDataStore((s) => s.load);
  const retry = useDataStore((s) => s.retry);
  const defer = options.defer === true;
  useEffect(() => {
    if (!defer) {
      void load();
      return;
    }
    return afterIdle(() => void load(), DEFER_MS);
  }, [load, defer]);
  return { state, retry: () => void retry() };
}
