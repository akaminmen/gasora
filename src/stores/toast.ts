import { create } from 'zustand';

interface ToastState {
  message: string | null;
  show: (message: string) => void;
  hide: () => void;
}

let timer: ReturnType<typeof setTimeout> | undefined;

/** Toast discreto: un solo mensaje a la vez que desaparece solo. */
export const useToastStore = create<ToastState>((set) => ({
  message: null,
  show: (message) => {
    clearTimeout(timer);
    set({ message });
    timer = setTimeout(() => set({ message: null }), 4000);
  },
  hide: () => {
    clearTimeout(timer);
    set({ message: null });
  },
}));
