import { registerSW } from 'virtual:pwa-register';
import { useToastStore } from '../stores/toast';
import { shouldApplyInBackground, UPDATE_CHECK_MS } from './policy';
import { usePwaStore, type InstallPromptEvent } from './store';

/**
 * Activa la versión que espera y recarga cuando pasa a controlar la página. Se hace aquí y no con la
 * ayuda de la biblioteca porque esta solo recarga si la actualización llega en los primeros 10 s.
 */
export async function applyWaitingUpdate(): Promise<void> {
  const registration = await navigator.serviceWorker.getRegistration();
  const waiting = registration?.waiting;
  if (!waiting) {
    window.location.reload();
    return;
  }
  let reloaded = false;
  const reload = () => {
    if (reloaded) return;
    reloaded = true;
    window.location.reload();
  };
  navigator.serviceWorker.addEventListener('controllerchange', reload, { once: true });
  waiting.postMessage({ type: 'SKIP_WAITING' });
  // Por si el navegador no avisa del cambio de control: no se queda esperando
  window.setTimeout(reload, 4000);
}

/** Registra el service worker (solo en el build de producción) y la instalación. */
export function setupPwa(): void {
  const pwa = usePwaStore.getState();

  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    usePwaStore.getState().setInstallEvent(event as InstallPromptEvent);
  });
  window.addEventListener('appinstalled', () => {
    usePwaStore.getState().setInstallEvent(null);
    usePwaStore.getState().setInstalled(true);
  });

  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return;

  let registration: ServiceWorkerRegistration | undefined;
  registerSW({
    onNeedRefresh() {
      pwa.setNeedRefresh(true, () => void applyWaitingUpdate());
    },
    onOfflineReady() {
      usePwaStore.getState().setOfflineReady(true);
      useToastStore.getState().show('Gasora ya funciona sin conexión.');
    },
    onRegisteredSW(_url, swRegistration) {
      registration = swRegistration;
      if (!swRegistration) return;
      // Aviso propio, además del de la biblioteca: una versión que ya esperaba al abrir la app, y las
      // que llegan horas después (la biblioteca las trata como «externas» pasados 10 s)
      const flag = () =>
        usePwaStore.getState().setNeedRefresh(true, () => void applyWaitingUpdate());
      if (swRegistration.waiting && navigator.serviceWorker.controller) flag();
      swRegistration.addEventListener('updatefound', () => {
        const installing = swRegistration.installing;
        installing?.addEventListener('statechange', () => {
          if (installing.state === 'installed' && navigator.serviceWorker.controller) flag();
        });
      });
    },
    onRegisterError(error) {
      console.warn('No se pudo registrar el service worker', error);
    },
  });

  const check = () => {
    if (navigator.onLine) void registration?.update().catch(() => undefined);
  };
  window.setInterval(check, UPDATE_CHECK_MS);
  window.addEventListener('online', check);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') check();
    if (
      shouldApplyInBackground({
        needRefresh: usePwaStore.getState().needRefresh,
        visibility: document.visibilityState,
      })
    ) {
      usePwaStore.getState().applyUpdate();
    }
  });
}
