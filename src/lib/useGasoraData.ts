import { useEffect, useState } from 'react';
import { loadData, type GasoraData } from './data';

export type DataState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; data: GasoraData };

let cached: Promise<GasoraData> | undefined;

/** Una sola descarga compartida por todas las pantallas; si falla, se puede reintentar. */
export function useGasoraData(): { state: DataState; retry: () => void } {
  const [state, setState] = useState<DataState>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    cached ??= loadData();
    cached.then(
      (data) => active && setState({ status: 'ready', data }),
      (error: unknown) => {
        cached = undefined;
        if (active) {
          setState({
            status: 'error',
            message: error instanceof Error ? error.message : String(error),
          });
        }
      },
    );
    return () => {
      active = false;
    };
  }, [attempt]);

  return {
    state,
    retry: () => {
      setState({ status: 'loading' });
      setAttempt((n) => n + 1);
    },
  };
}
