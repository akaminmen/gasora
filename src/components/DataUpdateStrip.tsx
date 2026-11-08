import { RefreshCw } from 'lucide-react';
import { Button } from './ui/Button';
import { useDataStore } from '../stores/data';

/**
 * Aviso «Hay precios nuevos · Actualizar». Franja en el flujo, bajo la cabecera (como la de «Sin
 * conexión»): no tapa la hoja inferior, los controles del mapa ni la atribución. La región
 * `role="status"` existe siempre y se rellena al haber datos nuevos, para que se anuncie de forma
 * educada. Los datos nuevos ya están descargados: al pulsar solo se aplican (los resultados y el
 * ranking se recalculan con la misma búsqueda, combustible, orden, filtros, zona y ficha) y se
 * anuncia «Precios actualizados».
 */
export function DataUpdateStrip() {
  const ready = useDataStore((s) => s.update.status === 'ready');
  const applyUpdate = useDataStore((s) => s.applyUpdate);
  const notice = useDataStore((s) => s.notice);
  return (
    <>
      <div role="status" aria-live="polite" data-testid="data-update">
        {ready && (
          <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 border-b border-line bg-brand-50 px-3 py-1 text-[0.8125rem] font-medium text-ink">
            <RefreshCw width={16} height={16} className="flex-none text-link" aria-hidden />
            <p className="min-w-0">Hay precios nuevos</p>
            <Button
              variant="secondary"
              data-testid="data-update-apply"
              onClick={() => {
                applyUpdate();
                // El botón desaparece: el foco pasa al contenido, sin moverlo de sitio
                document.getElementById('contenido')?.focus({ preventScroll: true });
              }}
            >
              Actualizar
            </Button>
          </div>
        )}
      </div>
      <p className="sr-only" role="status" aria-live="polite" data-testid="data-notice">
        {notice}
      </p>
    </>
  );
}
