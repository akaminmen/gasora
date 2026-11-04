import { RefreshCw, WifiOff } from 'lucide-react';
import { Button } from './ui/Button';
import { useOnline } from '../pwa/useOnline';
import { usePwaStore } from '../pwa/store';

/** Aviso de falta de conexión (franja bajo la cabecera) y de versión nueva disponible. */
export function PwaBanners() {
  const online = useOnline();
  const needRefresh = usePwaStore((s) => s.needRefresh);
  const applyUpdate = usePwaStore((s) => s.applyUpdate);
  return (
    <>
      {!online && (
        <div
          role="status"
          data-testid="offline-strip"
          className="flex items-center justify-center gap-2 border-b border-line bg-surface-2 px-4 py-2 text-center text-[0.8125rem] font-medium text-ink"
        >
          <WifiOff width={16} height={16} className="flex-none text-muted" aria-hidden />
          Sin conexión. Verás los últimos datos guardados en este dispositivo.
        </div>
      )}
      {needRefresh && (
        <div
          role="status"
          data-testid="update-banner"
          className="fixed inset-x-3 bottom-[88px] z-40 mx-auto flex max-w-md items-center gap-3 rounded-2xl border border-line bg-surface p-3 shadow-raised lg:bottom-4"
        >
          <p className="min-w-0 flex-1 text-[0.8125rem] font-medium text-ink">
            Hay una versión nueva de Gasora.
          </p>
          <Button
            icon={<RefreshCw width={16} height={16} aria-hidden />}
            onClick={applyUpdate}
            className="flex-none"
          >
            Actualizar
          </Button>
        </div>
      )}
    </>
  );
}
