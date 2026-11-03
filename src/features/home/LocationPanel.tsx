import { Button } from '../../components/ui/Button';
import {
  EmptyState,
  LocatingState,
  PermissionDenied,
  PermissionPrompt,
} from '../../components/ui/Feedback';
import { useDataStore } from '../../stores/data';
import { useLocationStore } from '../../stores/location';
import { useSearchStore } from '../../stores/search';

const ERROR_TEXT = {
  timeout: 'Hemos tardado demasiado en localizarte. Inténtalo de nuevo o busca por zona.',
  unavailable:
    'Tu dispositivo no ha podido darnos la ubicación. Inténtalo de nuevo o busca por zona.',
  insecure: 'La ubicación solo funciona en conexiones seguras (HTTPS). Busca por zona.',
  unsupported: 'Tu navegador no permite obtener la ubicación. Busca por zona.',
} as const;

/** Pasos del flujo «Usar mi ubicación» que no son resultados: explicación, espera, denegado, error. */
export function LocationPanel() {
  const flow = useLocationStore((s) => s.flow);
  const { start, allow, cancel } = useLocationStore.getState();
  const loadIndex = useDataStore((s) => s.loadIndex);
  const setPlace = useSearchStore((s) => s.setPlace);

  const pickCity = async (city: string) => {
    await loadIndex();
    const index = useDataStore.getState().index;
    if (index.status !== 'ready') return;
    const options = index.searcher.suggest(city);
    const exact = options.find((o) => o.group === 'Municipio' && o.text === city) ?? options[0];
    if (exact) {
      cancel();
      setPlace(exact.place);
    }
  };

  switch (flow.step) {
    case 'prompt':
      return <PermissionPrompt onAllow={allow} onDecline={cancel} />;
    case 'locating':
      return <LocatingState onSearchInstead={cancel} />;
    case 'denied':
      return (
        <PermissionDenied onPickCity={(city) => void pickCity(city)} onRetry={() => void start()} />
      );
    case 'error':
      return (
        <EmptyState
          title="No hemos podido localizarte"
          text={ERROR_TEXT[flow.reason]}
          actions={
            <>
              {(flow.reason === 'timeout' || flow.reason === 'unavailable') && (
                <Button size="lg" onClick={() => void start()}>
                  Reintentar
                </Button>
              )}
              <Button variant="secondary" size="lg" onClick={cancel}>
                Buscar por ciudad o código postal
              </Button>
            </>
          }
        />
      );
    default:
      return null;
  }
}
