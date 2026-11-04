import { useEffect, useState } from 'react';

/**
 * Pasa a `true` cuando `enabled` es verdadero y el navegador está libre (o tras `timeoutMs`).
 * Una vez `true` no vuelve a `false`. Se usa para no descargar el mapa (≈ 1,1 MB de JS) hasta que
 * las tarjetas de resultados ya se han pintado.
 */
export function useWhenIdle(enabled: boolean, timeoutMs = 800): boolean {
  const [idle, setIdle] = useState(false);
  useEffect(() => {
    if (!enabled || idle) return;
    if (typeof window.requestIdleCallback !== 'function') {
      const timer = window.setTimeout(() => setIdle(true), 0);
      return () => window.clearTimeout(timer);
    }
    const handle = window.requestIdleCallback(() => setIdle(true), { timeout: timeoutMs });
    return () => window.cancelIdleCallback(handle);
  }, [enabled, idle, timeoutMs]);
  return idle;
}
