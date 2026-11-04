import { useEffect } from 'react';

let holders = 0;

/**
 * Oculta el pie (`visibility: hidden`, sigue ocupando su sitio) mientras `hidden` es verdadero: en
 * las pantallas que esperan trozos de código o datos, el pie no «salta» al aparecer el contenido
 * (ver `body[data-route-loading]` en components.css). Varios componentes pueden pedirlo a la vez.
 */
export function useFooterHidden(hidden: boolean): void {
  useEffect(() => {
    if (!hidden) return;
    holders += 1;
    document.body.dataset['routeLoading'] = 'true';
    return () => {
      holders -= 1;
      if (holders === 0) delete document.body.dataset['routeLoading'];
    };
  }, [hidden]);
}
