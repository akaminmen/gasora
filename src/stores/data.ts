import { create } from 'zustand';
import { buildBrandGroups } from '../lib/brands';
import type { Station } from '../lib/data-schema';
import type { GasoraData } from '../lib/data';
import { createScheduler, hasNewData, type CheckResult } from '../lib/freshness';
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
  /**
   * Datos nuevos descargados en segundo plano y aún sin aplicar: la pantalla sigue con los que tenía
   * hasta que la persona pulse «Actualizar».
   */
  update: { status: 'idle' } | { status: 'ready'; data: GasoraData };
  /** Texto para el aviso hablado («Precios actualizados») */
  notice: string;
  /** Pide solo `meta.json`; si su huella cambió, descarga lo necesario sin tocar la pantalla. */
  checkForUpdate: () => Promise<CheckResult>;
  /** Aplica los datos nuevos: se recalculan resultados y ranking con la búsqueda y los filtros de siempre. */
  applyUpdate: () => void;
  /** Al volver la conexión: sustituye los datos guardados por los actuales. */
  recover: () => Promise<void>;
}

/** zod y la carga de ficheros van en un trozo aparte: no cuentan para el primer pintado. */
const dataModule = () => import('../lib/data');

const message = (error: unknown) => (error instanceof Error ? error.message : String(error));

let loading: Promise<void> | undefined;
let loadingIndex: Promise<void> | undefined;

export const useDataStore = create<DataStore>((set, get) => ({
  state: { status: 'loading' },
  brandGroups: new Map(),
  stationsById: new Map(),
  index: { status: 'idle' },
  loadedAt: 0,
  update: { status: 'idle' },
  notice: '',

  load: () => {
    if (get().state.status === 'ready') return Promise.resolve();
    loading ??= dataModule()
      .then((m) => m.loadData())
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
        set({
          index: {
            status: 'ready',
            searcher: createSearcher(await (await dataModule()).loadSearchIndex()),
          },
        });
      } catch (error) {
        set({ index: { status: 'error', message: message(error) } });
      }
    })().finally(() => {
      loadingIndex = undefined;
    });
    return loadingIndex;
  },

  recover: async () => {
    const { state } = get();
    if (state.status === 'error') {
      await get().retry();
      return;
    }
    if (state.status !== 'ready' || !state.data.fromCache) {
      // De vuelta en línea con datos al día: solo se comprueba si hay datos nuevos (sin tocar la pantalla)
      await get().checkForUpdate();
      return;
    }
    try {
      const data = await (await dataModule()).loadData();
      set({
        state: { status: 'ready', data },
        brandGroups: buildBrandGroups(data.stations.stations),
        stationsById: new Map(data.stations.stations.map((s) => [s.id, s])),
        loadedAt: Date.now(),
      });
    } catch {
      // Sigue sin red de verdad: se mantienen los datos guardados.
    }
  },

  checkForUpdate: async () => {
    const { state, update } = get();
    // Con datos guardados de una sesión sin conexión, `recover` se ocupa de cargar todo
    if (state.status !== 'ready' || state.data.fromCache) return 'same';
    try {
      const module = await dataModule();
      const latest = await module.loadLatestMeta();
      // Lo publicado es lo que ya se ve: si había datos pendientes, ya no hacen falta
      if (!hasNewData(state.data.meta, latest)) {
        if (update.status === 'ready') set({ update: { status: 'idle' } });
        return 'same';
      }
      // Lo publicado es lo que ya está descargado y pendiente: nada más que hacer
      if (update.status === 'ready' && !hasNewData(update.data.meta, latest)) return 'new';
      const data = await module.loadUpdate(latest, state.data);
      // Mientras tanto la pantalla pudo cambiar de datos (otro `load`): solo se guarda si sigue siendo la base
      if (get().state !== state) return 'same';
      set({ update: { status: 'ready', data } });
      return 'new';
    } catch {
      return 'error';
    }
  },

  applyUpdate: () => {
    const { update, state } = get();
    if (update.status !== 'ready' || state.status !== 'ready') return;
    const { data } = update;
    set({
      state: { status: 'ready', data },
      brandGroups: buildBrandGroups(data.stations.stations),
      stationsById: new Map(data.stations.stations.map((s) => [s.id, s])),
      loadedAt: Date.now(),
      update: { status: 'idle' },
      notice: 'Precios actualizados',
    });
    // El aviso hablado se borra para que el siguiente igual vuelva a anunciarse
    setTimeout(() => set({ notice: '' }), 6000);
  },
}));

/** ¿Se puede comprobar si hay datos nuevos ahora? Visible, con conexión, sin ahorro de datos y con datos. */
function canCheck(): boolean {
  const connection = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
  return (
    document.visibilityState === 'visible' &&
    navigator.onLine &&
    connection?.saveData !== true &&
    useDataStore.getState().state.status === 'ready'
  );
}

/**
 * Mantiene los datos al día con la pestaña abierta: cada 10 minutos, mientras sea visible, y al volver
 * a ella tras más de 10 minutos, pide solo `meta.json`. Si hay datos nuevos los descarga en segundo
 * plano y los deja pendientes (`update`): nada cambia en pantalla hasta que se pulse «Actualizar». Se
 * pausa con la pestaña oculta, sin conexión o con el ahorro de datos; reintenta con espera creciente y
 * sin avisar de los fallos.
 */
export function watchFreshness(): () => void {
  const scheduler = createScheduler({
    check: () => useDataStore.getState().checkForUpdate(),
    isActive: canCheck,
  });
  const sync = () => (canCheck() ? scheduler.resume() : scheduler.pause());
  const onOnline = () => {
    void useDataStore.getState().recover();
    sync();
  };
  // Los datos recién cargados cuentan como una comprobación
  const unsubscribe = useDataStore.subscribe((state, previous) => {
    if (state.loadedAt !== previous.loadedAt) scheduler.touch();
    if (state.state !== previous.state) sync();
  });
  const connection = (navigator as Navigator & { connection?: EventTarget }).connection;
  document.addEventListener('visibilitychange', sync);
  window.addEventListener('online', onOnline);
  window.addEventListener('offline', sync);
  connection?.addEventListener('change', sync);
  sync();
  return () => {
    scheduler.stop();
    unsubscribe();
    document.removeEventListener('visibilitychange', sync);
    window.removeEventListener('online', onOnline);
    window.removeEventListener('offline', sync);
    connection?.removeEventListener('change', sync);
  };
}
