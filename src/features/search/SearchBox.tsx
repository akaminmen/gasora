import { useEffect, useId, useMemo, useState, type KeyboardEvent } from 'react';
import { useNavigate } from 'react-router';
import { SearchField, Suggestions, type Suggestion } from '../../components/ui/SearchField';
import { fold, type PlaceSuggestion } from '../../lib/search-index';
import { useDataStore } from '../../stores/data';
import { useLocationStore } from '../../stores/location';
import { useSearchStore } from '../../stores/search';

const DEBOUNCE_MS = 120;
const ORDER = ['Provincia', 'Municipio', 'CP'] as const;

/**
 * Buscador con autocompletado: Provincia / Municipio / CP. Teclado: flechas para moverse, Enter
 * elige la resaltada (o la primera), Esc cierra la lista. El índice se carga al enfocar el campo.
 */
export function SearchBox({
  size = 'default',
  autoFocus = false,
}: {
  size?: 'compact' | 'default' | 'hero';
  autoFocus?: boolean;
}) {
  const listboxId = useId();
  const navigate = useNavigate();
  const setPlace = useSearchStore((s) => s.setPlace);
  const index = useDataStore((s) => s.index);
  const loadIndex = useDataStore((s) => s.loadIndex);

  const [value, setValue] = useState('');
  const [debounced, setDebounced] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [value]);

  const searcher = index.status === 'ready' ? index.searcher : null;
  const results: PlaceSuggestion[] = useMemo(
    () => (searcher ? searcher.suggest(debounced) : []),
    [searcher, debounced],
  );
  // Las filas se agrupan en Provincia / Municipio / CP; el orden de teclado es el del dibujo.
  const ordered = useMemo(
    () => ORDER.flatMap((group) => results.filter((r) => r.group === group)),
    [results],
  );
  const items: Suggestion[] = ordered.map((r) => ({
    id: r.id,
    group: r.group,
    text: r.text,
    match: /^\d+$/.test(debounced) ? debounced.trim() : undefined,
    detail: r.detail,
    count: r.count,
  }));

  const typed = debounced.trim().length > 0;
  const loadFailed = index.status === 'error';
  const showNoResults = open && typed && searcher !== null && ordered.length === 0;
  const showList = open && ordered.length > 0;

  const choose = (suggestion: PlaceSuggestion) => {
    useLocationStore.getState().cancel();
    setPlace(suggestion.place);
    setValue('');
    setDebounced('');
    setOpen(false);
    setActive(-1);
    (document.activeElement as HTMLElement | null)?.blur();
    navigate('/');
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setOpen(true);
      setActive((i) => (ordered.length === 0 ? -1 : (i + 1) % ordered.length));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActive((i) => (ordered.length === 0 ? -1 : (i <= 0 ? ordered.length : i) - 1));
    } else if (event.key === 'Escape') {
      if (open) {
        event.preventDefault();
        setOpen(false);
        setActive(-1);
      }
    }
  };

  const submit = async () => {
    // Enter puede llegar antes de que el índice cargue o de que acabe el debounce:
    // se resuelve con el texto actual y el índice ya cargado.
    await loadIndex();
    const state = useDataStore.getState().index;
    if (state.status !== 'ready') return setOpen(true);
    const list = ORDER.flatMap((group) =>
      state.searcher.suggest(value).filter((r) => r.group === group),
    );
    const highlighted =
      active >= 0 && fold(value) === fold(debounced) ? ordered[active] : undefined;
    const pick = highlighted ?? list[0];
    if (pick) choose(pick);
    else setOpen(true);
  };

  return (
    <div onKeyDown={onKeyDown} className="w-full">
      <SearchField
        size={size}
        value={value}
        onChange={(next) => {
          setValue(next);
          setOpen(true);
          setActive(-1);
          void loadIndex();
        }}
        onSubmit={() => void submit()}
        listboxId={showList ? listboxId : undefined}
        expanded={showList}
        activeId={showList && active >= 0 ? ordered[active]?.id : undefined}
        onFocus={() => {
          void loadIndex();
          if (value) setOpen(true);
        }}
        onBlur={() => setOpen(false)}
        autoFocus={autoFocus}
      >
        {showList && (
          <Suggestions
            id={listboxId}
            items={items}
            activeId={ordered[active]?.id}
            onPick={(item) => {
              const found = ordered.find((r) => r.id === item.id);
              if (found) choose(found);
            }}
          />
        )}
        {(showNoResults || loadFailed) && open && (
          <p
            role="status"
            className="absolute top-[calc(100%+8px)] right-0 left-0 z-20 rounded-[20px] border border-line bg-surface px-5 py-4 text-left text-[0.9375rem] text-muted shadow-raised"
          >
            {loadFailed
              ? 'No hemos podido cargar el buscador. Recarga la página e inténtalo de nuevo.'
              : `Sin coincidencias para «${debounced.trim()}». Prueba con otra provincia, municipio o código postal.`}
          </p>
        )}
      </SearchField>
      <p className="sr-only" role="status">
        {showList ? `${ordered.length} sugerencias` : ''}
      </p>
    </div>
  );
}
