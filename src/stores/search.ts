import { create } from 'zustand';
import {
  DEFAULT_RADIUS_KM,
  EXPANDED_MUNICIPALITY_KM,
  MAX_RADIUS_KM,
  usesRadius,
  type Place,
} from '../lib/place';
import { DEFAULT_LITERS } from '../lib/pricing';
import { readStorage, writeStorage } from '../lib/storage';
import type { SortKey } from '../lib/resultset';

/** Elementos que se añaden cada vez que se pulsa «Ver más», hasta `MAX_LIST`. */
export const PAGE_SIZE = 50;
export const MAX_LIST = 200;

export const LITERS_KEY = 'gasora:liters:v1';
export const MIN_LITERS = 1;
export const MAX_LITERS = 120;

/** Litros del depósito guardados (1–120); si no hay o no valen, 50. */
export function parseLiters(raw: string | null): number {
  const value = Number(raw);
  return Number.isInteger(value) && value >= MIN_LITERS && value <= MAX_LITERS
    ? value
    : DEFAULT_LITERS;
}

interface SearchState {
  place: Place | null;
  radiusKm: number;
  sort: SortKey;
  /** Claves de filtro de marca elegidas; vacío = todas */
  brands: string[];
  liters: number;
  setLiters: (liters: number) => void;
  /** true mientras se resuelve el lugar de un enlace compartido */
  resolving: boolean;
  setResolving: (resolving: boolean) => void;
  /** Cuántos resultados se muestran en la lista */
  limit: number;
  /** Estación seleccionada (lista, mapa y ficha comparten esta selección) */
  selectedId: string | null;
  select: (id: string | null) => void;
  setPlace: (place: Place) => void;
  /** «Buscar en esta zona»: cambia la zona y el radio y conserva el orden y el filtro de marcas. */
  searchArea: (place: Place, radiusKm: number) => void;
  clearPlace: () => void;
  setRadius: (km: number) => void;
  setSort: (sort: SortKey) => void;
  setBrands: (brands: string[]) => void;
  showMore: () => void;
  /** Amplía la lista lo justo para que se vea el elemento de esa posición (hasta `MAX_LIST`). */
  revealIndex: (index: number) => void;
  /** «Ampliar»: municipio → 10 km desde su centroide; con radio → dobla el radio (máx. 50 km). */
  widen: () => void;
}

const reset = {
  sort: 'price' as SortKey,
  brands: [] as string[],
  limit: PAGE_SIZE,
  selectedId: null as string | null,
};

export const useSearchStore = create<SearchState>((set, get) => ({
  place: null,
  radiusKm: DEFAULT_RADIUS_KM,
  sort: 'price',
  brands: [],
  liters: parseLiters(readStorage(LITERS_KEY)),
  setLiters: (liters) => {
    const value = Math.min(MAX_LITERS, Math.max(MIN_LITERS, Math.round(liters) || DEFAULT_LITERS));
    writeStorage(LITERS_KEY, String(value));
    set({ liters: value });
  },
  resolving: false,
  setResolving: (resolving) => set({ resolving }),
  limit: PAGE_SIZE,
  selectedId: null,
  select: (selectedId) => set({ selectedId }),
  // Cada búsqueda nueva empieza con radio por defecto, orden por precio y todas las marcas.
  setPlace: (place) => set({ place, radiusKm: DEFAULT_RADIUS_KM, ...reset }),
  searchArea: (place, radiusKm) => set({ place, radiusKm, limit: PAGE_SIZE, selectedId: null }),
  clearPlace: () => set({ place: null, radiusKm: DEFAULT_RADIUS_KM, ...reset }),
  setRadius: (radiusKm) => set({ radiusKm, limit: PAGE_SIZE }),
  setSort: (sort) => set({ sort, limit: PAGE_SIZE }),
  setBrands: (brands) => set({ brands, limit: PAGE_SIZE }),
  showMore: () => set((s) => ({ limit: Math.min(MAX_LIST, s.limit + PAGE_SIZE) })),
  revealIndex: (index) =>
    set((s) => ({
      limit: Math.min(MAX_LIST, Math.max(s.limit, (Math.floor(index / PAGE_SIZE) + 1) * PAGE_SIZE)),
    })),
  widen: () => {
    const { place, radiusKm } = get();
    if (!place) return;
    if (place.kind === 'municipality' && !place.expanded) {
      set({
        place: { ...place, expanded: true },
        radiusKm: EXPANDED_MUNICIPALITY_KM,
        limit: PAGE_SIZE,
      });
    } else if (usesRadius(place)) {
      set({ radiusKm: Math.min(MAX_RADIUS_KM, radiusKm * 2), limit: PAGE_SIZE });
    }
  },
}));
