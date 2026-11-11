import { useSyncExternalStore } from 'react';

export type Device = 'ios' | 'android' | 'desktop';
export type BrowserId = 'safari' | 'chrome' | 'edge' | 'firefox' | 'samsung' | 'other';
export interface Platform {
  device: Device;
  browser: BrowserId;
}

/**
 * Dispositivo y navegador a partir del agente de usuario. Solo sirve para destacar la sección de
 * instrucciones que corresponde: ninguna se oculta, porque el agente de usuario no es fiable.
 * `maxTouchPoints` distingue un iPad con iPadOS (se presenta como Mac) de un Mac.
 */
export function detectPlatform(userAgent: string, maxTouchPoints = 0): Platform {
  const ua = userAgent;
  const ios = /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && maxTouchPoints > 1);
  if (ios) {
    const browser: BrowserId = /CriOS/.test(ua)
      ? 'chrome'
      : /FxiOS/.test(ua)
        ? 'firefox'
        : /EdgiOS/.test(ua)
          ? 'edge'
          : /OPiOS|OPT\//.test(ua)
            ? 'other'
            : 'safari';
    return { device: 'ios', browser };
  }
  if (/Android/.test(ua)) {
    const browser: BrowserId = /SamsungBrowser/.test(ua)
      ? 'samsung'
      : /EdgA/.test(ua)
        ? 'edge'
        : /Firefox/.test(ua)
          ? 'firefox'
          : /OPR\//.test(ua)
            ? 'other'
            : /Chrome/.test(ua)
              ? 'chrome'
              : 'other';
    return { device: 'android', browser };
  }
  const browser: BrowserId = /Edg\//.test(ua)
    ? 'edge'
    : /Firefox/.test(ua)
      ? 'firefox'
      : /OPR\//.test(ua)
        ? 'other'
        : /Chrome|Chromium/.test(ua)
          ? 'chrome'
          : /Safari/.test(ua) && /Version\//.test(ua)
            ? 'safari'
            : 'other';
  return { device: 'desktop', browser };
}

/** La aplicación se ejecuta instalada (ventana propia o pantalla de inicio), no en una pestaña. */
export function isStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  const iosStandalone = (navigator as Navigator & { standalone?: boolean }).standalone === true;
  return window.matchMedia('(display-mode: standalone)').matches || iosStandalone;
}

function subscribe(onChange: () => void) {
  const query = window.matchMedia('(display-mode: standalone)');
  query.addEventListener('change', onChange);
  return () => query.removeEventListener('change', onChange);
}

export function useStandalone(): boolean {
  return useSyncExternalStore(subscribe, isStandalone, () => false);
}

export function useDetectedPlatform(): Platform {
  return useSyncExternalStore(
    () => () => undefined,
    () => cached(),
    () => ({ device: 'desktop', browser: 'other' }) as Platform,
  );
}

let last: { key: string; value: Platform } | null = null;
function cached(): Platform {
  const key = `${navigator.userAgent}|${navigator.maxTouchPoints}`;
  if (!last || last.key !== key) {
    last = { key, value: detectPlatform(navigator.userAgent, navigator.maxTouchPoints) };
  }
  return last.value;
}
