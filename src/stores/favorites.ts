import { create } from 'zustand';
import { readStorage, writeStorage } from '../lib/storage';

export const FAVORITES_KEY = 'gasora:favorites:v1';
export const MAX_FAVORITES = 100;

/** Lee la lista guardada: un JSON con un array de IDEESS; lo demás se ignora. */
export function parseFavorites(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const value: unknown = JSON.parse(raw);
    if (!Array.isArray(value)) return [];
    const ids = value.filter((v): v is string => typeof v === 'string' && /^\d{1,10}$/.test(v));
    return [...new Set(ids)].slice(0, MAX_FAVORITES);
  } catch {
    return [];
  }
}

interface FavoritesState {
  /** IDEESS, el último guardado primero */
  ids: string[];
  toggle: (id: string) => void;
  remove: (id: string) => void;
}

function save(ids: string[]) {
  writeStorage(FAVORITES_KEY, JSON.stringify(ids));
}

export const useFavoritesStore = create<FavoritesState>((set, get) => ({
  ids: parseFavorites(readStorage(FAVORITES_KEY)),
  toggle: (id) => {
    const current = get().ids;
    const next = current.includes(id)
      ? current.filter((x) => x !== id)
      : [id, ...current].slice(0, MAX_FAVORITES);
    save(next);
    set({ ids: next });
  },
  remove: (id) => {
    const next = get().ids.filter((x) => x !== id);
    save(next);
    set({ ids: next });
  },
}));
