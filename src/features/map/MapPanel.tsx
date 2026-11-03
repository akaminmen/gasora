import { MapPinOff } from 'lucide-react';
import { Component, lazy, Suspense, useState, type ReactNode } from 'react';
import { Skeleton } from '../../components/ui/Feedback';
import { useUiStore } from '../../stores/ui';
import type { MapCanvasProps } from './MapCanvas';

// MapLibre pesa mucho: solo se descarga cuando hay resultados que mostrar en el mapa.
const MapCanvas = lazy(() => import('./MapCanvas'));

function MapUnavailable() {
  return (
    <div
      role="status"
      data-testid="map-unavailable"
      className="grid h-full place-items-center bg-surface-2 p-6 text-center"
    >
      <div className="flex max-w-xs flex-col items-center gap-2">
        <MapPinOff width={40} height={40} className="text-muted" aria-hidden />
        <p className="font-display-800 text-lg">No se ha podido cargar el mapa</p>
        <p className="text-sm text-muted">
          La lista de gasolineras sigue disponible con los mismos precios.
        </p>
      </div>
    </div>
  );
}

/** Si la descarga del código del mapa falla (sin red), se muestra el aviso en vez de romper la página. */
class MapBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  override state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  override render() {
    return this.state.failed ? <MapUnavailable /> : this.props.children;
  }
}

export function MapPanel(props: Omit<MapCanvasProps, 'theme' | 'onFailure'>) {
  const theme = useUiStore((s) => s.theme);
  const [failed, setFailed] = useState(false);
  if (failed) return <MapUnavailable />;
  return (
    <MapBoundary>
      <Suspense
        fallback={
          <div className="map-host" data-testid="map-loading" aria-busy="true">
            <Skeleton className="h-full w-full rounded-none" />
          </div>
        }
      >
        <MapCanvas {...props} theme={theme} onFailure={() => setFailed(true)} />
      </Suspense>
    </MapBoundary>
  );
}
