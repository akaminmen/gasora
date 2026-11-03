import { create } from 'zustand';
import { useSearchStore } from './search';

/**
 * Flujo de «Usar mi ubicación» (sección 10 del plan):
 * explicación previa → solicitando → éxito (se fija el lugar) | denegado | error/tiempo agotado.
 * La posición no se guarda en ningún sitio: solo se usa para fijar el lugar de la búsqueda.
 */
export type LocationFlow =
  | { step: 'idle' }
  | { step: 'prompt' }
  | { step: 'locating' }
  | { step: 'denied' }
  | { step: 'error'; reason: 'timeout' | 'unavailable' | 'insecure' | 'unsupported' };

interface LocationStore {
  flow: LocationFlow;
  /** Punto de entrada de «Usar mi ubicación». */
  start: () => Promise<void>;
  /** «Permitir» en la explicación previa. */
  allow: () => void;
  /** «Ahora no», cerrar o «buscar por ciudad»: vuelve al buscador. */
  cancel: () => void;
}

export const LOCATION_TIMEOUT_MS = 10_000;

async function permissionState(): Promise<PermissionState | null> {
  try {
    if (!navigator.permissions?.query) return null;
    return (await navigator.permissions.query({ name: 'geolocation' })).state;
  } catch {
    return null; // Safari antiguo y otros navegadores sin la API
  }
}

let attempt = 0;

export const useLocationStore = create<LocationStore>((set, get) => ({
  flow: { step: 'idle' },

  start: async () => {
    if (!window.isSecureContext) return set({ flow: { step: 'error', reason: 'insecure' } });
    if (!('geolocation' in navigator)) {
      return set({ flow: { step: 'error', reason: 'unsupported' } });
    }
    const state = await permissionState();
    if (state === 'denied') return set({ flow: { step: 'denied' } });
    // Si ya se concedió, no hace falta volver a explicar nada.
    if (state === 'granted') return get().allow();
    set({ flow: { step: 'prompt' } });
  },

  allow: () => {
    const current = ++attempt;
    set({ flow: { step: 'locating' } });
    navigator.geolocation.getCurrentPosition(
      (position) => {
        if (current !== attempt) return;
        set({ flow: { step: 'idle' } });
        useSearchStore.getState().setPlace({
          kind: 'location',
          label: 'Tu ubicación',
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
      },
      (error) => {
        if (current !== attempt) return;
        if (error.code === error.PERMISSION_DENIED) set({ flow: { step: 'denied' } });
        else {
          set({
            flow: {
              step: 'error',
              reason: error.code === error.TIMEOUT ? 'timeout' : 'unavailable',
            },
          });
        }
      },
      { enableHighAccuracy: false, timeout: LOCATION_TIMEOUT_MS, maximumAge: 5 * 60 * 1000 },
    );
  },

  cancel: () => {
    attempt += 1; // descarta una respuesta que llegue tarde
    set({ flow: { step: 'idle' } });
  },
}));
