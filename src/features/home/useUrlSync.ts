import { useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { buildUrlSearch, parseUrlState } from '../../lib/urlstate';
import { useDataStore } from '../../stores/data';
import { useSearchStore } from '../../stores/search';
import { useToastStore } from '../../stores/toast';
import { useUiStore } from '../../stores/ui';

/**
 * URL compartible (F14): al abrir `/?q=29002&fuel=g95e5&r=5&sort=price` restaura la búsqueda y,
 * mientras se usa la app, mantiene la URL al día (sin añadir entradas al historial).
 * La ubicación del usuario no se escribe nunca en la URL.
 */
export function useUrlSync() {
  const { search } = useLocation();
  const navigate = useNavigate();
  const initial = useRef(parseUrlState(search));
  const restored = useRef(false);

  const place = useSearchStore((s) => s.place);
  const radiusKm = useSearchStore((s) => s.radiusKm);
  const sort = useSearchStore((s) => s.sort);
  const fuel = useUiStore((s) => s.fuel);

  // 1) Restaurar el estado de la URL una sola vez, al abrir la página
  useEffect(() => {
    const wanted = initial.current;
    const search = useSearchStore.getState();
    if (wanted.fuel) useUiStore.getState().setFuel(wanted.fuel);
    if (!wanted.place) {
      restored.current = true;
      return;
    }
    let cancelled = false;
    search.setResolving(true);
    void (async () => {
      await useDataStore.getState().loadIndex();
      if (cancelled) return;
      const index = useDataStore.getState().index;
      const ref = wanted.place;
      const found =
        index.status === 'ready' && ref
          ? ref.kind === 'postal'
            ? index.searcher.postal(ref.code)
            : ref.kind === 'municipality'
              ? index.searcher.municipality(ref.id)
              : index.searcher.province(ref.id)
          : undefined;
      if (found) {
        useSearchStore
          .getState()
          .setPlace(
            found.kind === 'municipality' && wanted.expanded ? { ...found, expanded: true } : found,
          );
        if (wanted.radiusKm) useSearchStore.getState().setRadius(wanted.radiusKm);
        if (wanted.sort) useSearchStore.getState().setSort(wanted.sort);
      } else {
        useToastStore.getState().show('Ese enlace ya no es válido: la zona no existe.');
        navigate({ search: '' }, { replace: true });
      }
      restored.current = true;
      useSearchStore.getState().setResolving(false);
    })();
    return () => {
      cancelled = true;
      useSearchStore.getState().setResolving(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- solo al abrir la página
  }, []);

  // 2) Mantener la URL al día
  useEffect(() => {
    if (!restored.current) return;
    const next = buildUrlSearch({ place, fuel, radiusKm, sort });
    if (next !== window.location.search) {
      navigate({ search: next }, { replace: true });
    }
  }, [place, fuel, radiusKm, sort, navigate]);
}
