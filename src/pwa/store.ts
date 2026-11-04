import { create } from 'zustand';

/** Evento no estándar de Chromium para ofrecer la instalación de la app. */
export interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

interface PwaState {
  /** Hay una versión nueva descargada esperando a activarse */
  needRefresh: boolean;
  /** La app ya está guardada para funcionar sin conexión (primera instalación) */
  offlineReady: boolean;
  /** Activa la versión nueva y recarga la página */
  applyUpdate: () => void;
  /** Evento de instalación guardado, si el navegador lo ofrece */
  installEvent: InstallPromptEvent | null;
  installed: boolean;
  setNeedRefresh: (value: boolean, apply?: () => void) => void;
  setOfflineReady: (value: boolean) => void;
  setInstallEvent: (event: InstallPromptEvent | null) => void;
  setInstalled: (value: boolean) => void;
}

export const usePwaStore = create<PwaState>((set) => ({
  needRefresh: false,
  offlineReady: false,
  applyUpdate: () => undefined,
  installEvent: null,
  installed: false,
  setNeedRefresh: (needRefresh, apply) =>
    set((s) => ({ needRefresh, applyUpdate: apply ?? s.applyUpdate })),
  setOfflineReady: (offlineReady) => set({ offlineReady }),
  setInstallEvent: (installEvent) => set({ installEvent }),
  setInstalled: (installed) => set({ installed }),
}));
