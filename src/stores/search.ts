import { create } from 'zustand';
import {
  DEFAULT_RADIUS_KM,
  EXPANDED_MUNICIPALITY_KM,
  MAX_RADIUS_KM,
  usesRadius,
  type Place,
} from '../lib/place';
import { DEFAULT_LITERS } from '../lib/pricing';
import type { SortKey } from '../lib/resultset';

/** Elementos que se añaden cada vez que se pulsa «Ver más», hasta `MAX_LIST`. */
export const PAGE_SIZE = 50;
export const MAX_LIST = 200;

interface SearchState {
  place: Place | null;
  radiusKm: number;
  sort: SortKey;
  /** Claves de filtro de marca elegidas; vacío = todas */
  brands: string[];
  liters: number;
  /** Cuántos resultados se muestran en la lista */
  limit: number;
  setPlace: (place: Place) => void;
  clearPlace: () => void;
  setRadius: (km: number) => void;
  setSort: (sort: SortKey) => void;
  setBrands: (brands: string[]) => void;
  showMore: () => void;
  /** «Ampliar»: municipio → 10 km desde su centroide; con radio → dobla el radio (máx. 50 km). */
  widen: () => void;
}

const reset = { sort: 'price' as SortKey, brands: [] as string[], limit: PAGE_SIZE };

export const useSearchStore = create<SearchState>((set, get) => ({
  place: null,
  radiusKm: DEFAULT_RADIUS_KM,
  sort: 'price',
  brands: [],
  liters: DEFAULT_LITERS,
  limit: PAGE_SIZE,
  // Cada búsqueda nueva empieza con radio por defecto, orden por precio y todas las marcas.
  setPlace: (place) => set({ place, radiusKm: DEFAULT_RADIUS_KM, ...reset }),
  clearPlace: () => set({ place: null, radiusKm: DEFAULT_RADIUS_KM, ...reset }),
  setRadius: (radiusKm) => set({ radiusKm, limit: PAGE_SIZE }),
  setSort: (sort) => set({ sort, limit: PAGE_SIZE }),
  setBrands: (brands) => set({ brands, limit: PAGE_SIZE }),
  showMore: () => set((s) => ({ limit: Math.min(MAX_LIST, s.limit + PAGE_SIZE) })),
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
