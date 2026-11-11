import { useEffect } from 'react';

/**
 * Mientras un diálogo modal está abierto:
 *  - el resto de la aplicación (`#root`) queda `inert`: no recibe foco ni toques y los lectores de
 *    pantalla no lo recorren (el diálogo va en un portal, fuera de `#root`);
 *  - la página no se desplaza por detrás (`overflow: hidden` en `html` y `body`).
 * Al cerrarse se restauran los valores anteriores. Hay un contador por si se abrieran dos capas.
 */
let locks = 0;
let saved: { html: string; body: string } | null = null;

export function useModalLock(active: boolean) {
  useEffect(() => {
    if (!active) return;
    const root = document.getElementById('root');
    if (locks === 0) {
      saved = {
        html: document.documentElement.style.overflow,
        body: document.body.style.overflow,
      };
      document.documentElement.style.overflow = 'hidden';
      document.body.style.overflow = 'hidden';
      root?.setAttribute('inert', '');
    }
    locks += 1;
    return () => {
      locks -= 1;
      if (locks === 0) {
        document.documentElement.style.overflow = saved?.html ?? '';
        document.body.style.overflow = saved?.body ?? '';
        root?.removeAttribute('inert');
        saved = null;
      }
    };
  }, [active]);
}
