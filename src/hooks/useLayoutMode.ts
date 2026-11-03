import { useSyncExternalStore } from 'react';

/** móvil ≤ 639 px, tablet 640–1023 px, escritorio ≥ 1024 px (sección 9.3 del plan) */
export type LayoutMode = 'mobile' | 'tablet' | 'desktop';

const MOBILE = '(max-width: 639px)';
const DESKTOP = '(min-width: 1024px)';

function subscribe(onChange: () => void) {
  const queries = [window.matchMedia(MOBILE), window.matchMedia(DESKTOP)];
  for (const q of queries) q.addEventListener('change', onChange);
  return () => {
    for (const q of queries) q.removeEventListener('change', onChange);
  };
}

const snapshot = (): LayoutMode =>
  window.matchMedia(MOBILE).matches
    ? 'mobile'
    : window.matchMedia(DESKTOP).matches
      ? 'desktop'
      : 'tablet';

export function useLayoutMode(): LayoutMode {
  return useSyncExternalStore(subscribe, snapshot, () => 'desktop');
}
