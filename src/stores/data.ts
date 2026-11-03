import { create } from 'zustand';
import { buildBrandGroups } from '../lib/brands';
import type { Station } from '../lib/data-schema';
import { loadData, loadFreshPrices, loadSearchIndex, type GasoraData } from '../lib/data';
import { createSearcher, type Searcher } from '../lib/search-index';

export type DataState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; data: GasoraData };

export type IndexState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; searcher: Searcher };

interface DataStore {
  state: DataState;
  /** brandKey → clave del filtro; se calcula una vez con las estaciones cargadas */
  brandGroups: ReadonlyMap<string, string>;
  /** IDEESS a estación, para la ficha y los favoritos */
  stationsById: ReadonlyMap<string, Station>;
  index: IndexState;
  /** Cuándo se cargaron o refrescaron los precios (ms desde la época) */
  loadedAt: number;
  load: () => Promise<void>;
  retry: () => Promise<void>;
  loadIndex: () => Promise<void>;
  /** Vuelve a pedir meta y precios si han pasado más de `maxAgeMs`. */
  refreshPrices: (maxAgeMs?: number) => Promise<void>;
}

const message = (error: unknown) => (error instanceof Error ? error.message : String(error));

let loading: Promise<void> | undefined;
let loadingIndex: Promise<void> | undefined;

export const useDataStore = create<DataStore>((set, get) => ({
  state: { status: 'loading' },
  brandGroups: new Map(),
  stationsById: new Map(),
  index: { status: 'idle' },
  loadedAt: 0,

  load: () => {
    if (get().state.status === 'ready') return Promise.resolve();
    loading ??= loadData()
      .then(
        (data) => {
          set({
            state: { status: 'ready', data },
            brandGroups: buildBrandGroups(data.stations.stations),
            stationsById: new Map(data.stations.stations.map((s) => [s.id, s])),
            loadedAt: Date.now(),
          });
        },
        (error: unknown) => {
          set({ state: { status: 'error', message: message(error) } });
        },
      )
      .finally(() => {
        loading = undefined;
      });
    return loading;
  },

  retry: () => {
    set({ state: { status: 'loading' } });
    return get().load();
  },

  loadIndex: () => {
    const current = get().index;
    if (current.status === 'ready') return Promise.resolve();
    loadingIndex ??= (async () => {
      set({ index: { status: 'loading' } });
      try {
        set({ index: { status: 'ready', searcher: createSearcher(await loadSearchIndex()) } });
      } catch (error) {
        set({ index: { status: 'error', message: message(error) } });
      }
    })().finally(() => {
      loadingIndex = undefined;
    });
    return loadingIndex;
  },

  refreshPrices: async (maxAgeMs = 10 * 60 * 1000) => {
    const { state, loadedAt } = get();
    if (state.status !== 'ready' || Date.now() - loadedAt < maxAgeMs) return;
    try {
      const fresh = await loadFreshPrices();
      // Si la ingesta cambió las estaciones (otro hash), se recarga todo en la próxima visita.
      if (fresh.meta.stationsFile !== state.data.meta.stationsFile) {
        loading = undefined;
        set({ state: { status: 'loading' } });
        await get().load();
        return;
      }
      set({
        state: {
          status: 'ready',
          data: { ...state.data, meta: fresh.meta, prices: fresh.prices, fromCache: false },
        },
        loadedAt: Date.now(),
      });
    } catch {
      // Sin red: se siguen mostrando los datos que ya hay.
    }
  },
}));

/** Refresca los precios al volver a la pestaña si llevan más de 10 minutos sin actualizarse. */
export function watchVisibility(): () => void {
  const onVisible = () => {
    if (document.visibilityState === 'visible') void useDataStore.getState().refreshPrices();
  };
  document.addEventListener('visibilitychange', onVisible);
  return () => document.removeEventListener('visibilitychange', onVisible);
}
