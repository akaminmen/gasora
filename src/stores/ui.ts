import { create } from 'zustand';
import { FUELS, type FuelId } from '../lib/data-schema';
import { readStorage, writeStorage } from '../lib/storage';

export type ThemeChoice = 'light' | 'dark';

export const THEME_KEY = 'gasora:theme:v1';
export const FUEL_KEY = 'gasora:fuel:v1';
export const DEFAULT_FUEL: FuelId = 'g95e5';

function storedTheme(): ThemeChoice {
  const value = readStorage(THEME_KEY);
  return value === 'dark' ? 'dark' : 'light';
}

function storedFuel(): FuelId {
  const value = readStorage(FUEL_KEY);
  return FUELS.find((fuel) => fuel === value) ?? DEFAULT_FUEL;
}

/** El tema por defecto es el claro; no se consulta la preferencia del sistema. */
function applyTheme(choice: ThemeChoice) {
  document.documentElement.setAttribute('data-theme', choice);
}

interface UiState {
  theme: ThemeChoice;
  /** Combustible elegido: siempre hay uno (por defecto Gasolina 95). */
  fuel: FuelId;
  setTheme: (theme: ThemeChoice) => void;
  setFuel: (fuel: FuelId) => void;
}

export const useUiStore = create<UiState>((set) => ({
  theme: storedTheme(),
  fuel: storedFuel(),
  setTheme: (theme) => {
    applyTheme(theme);
    writeStorage(THEME_KEY, theme);
    set({ theme });
  },
  setFuel: (fuel) => {
    writeStorage(FUEL_KEY, fuel);
    set({ fuel });
  },
}));
