import { MapPin, Search } from 'lucide-react';
import { useId, type ChangeEvent, type FormEvent, type ReactNode } from 'react';

type Size = 'compact' | 'default' | 'hero';

const heights: Record<Size, string> = {
  compact: 'h-12',
  default: 'h-14',
  hero: 'h-16',
};

export function SearchField({
  value,
  onChange,
  onSubmit,
  size = 'default',
  placeholder = 'Provincia, municipio o código postal',
  label = 'Buscar por provincia, municipio o código postal',
  listboxId,
  expanded = false,
  activeId,
  onFocus,
  onBlur,
  autoFocus = false,
  children,
}: {
  value: string;
  onChange: (value: string) => void;
  onSubmit?: () => void;
  size?: Size;
  placeholder?: string;
  label?: string;
  /** id del listbox de sugerencias, si está abierto */
  listboxId?: string;
  expanded?: boolean;
  activeId?: string;
  onFocus?: () => void;
  onBlur?: () => void;
  autoFocus?: boolean;
  /** Sugerencias (componente Suggestions) */
  children?: ReactNode;
}) {
  const handle = (event: ChangeEvent<HTMLInputElement>) => onChange(event.target.value);
  const submit = (event: FormEvent) => {
    event.preventDefault();
    onSubmit?.();
  };
  return (
    <form role="search" onSubmit={submit} className="relative w-full">
      <label
        className={`flex items-center gap-2.5 rounded-full border border-line bg-surface px-5 shadow-soft focus-within:border-brand focus-within:ring-4 focus-within:ring-brand-100 ${heights[size]}`}
      >
        <Search width={20} height={20} className="flex-none text-muted" aria-hidden />
        <input
          type="search"
          role="combobox"
          aria-label={label}
          aria-expanded={expanded}
          aria-controls={listboxId}
          aria-activedescendant={activeId}
          aria-autocomplete="list"
          autoComplete="off"
          autoFocus={autoFocus}
          onFocus={onFocus}
          onBlur={onBlur}
          value={value}
          onChange={handle}
          placeholder={placeholder}
          className="min-w-0 flex-1 border-0 bg-transparent text-base font-medium text-ink outline-0 placeholder:text-muted"
        />
      </label>
      {children}
    </form>
  );
}

export interface Suggestion {
  id: string;
  group: 'Provincia' | 'Municipio' | 'CP';
  text: string;
  /** Parte inicial a resaltar (lo que el usuario ha escrito) */
  match?: string;
  detail?: string;
  /** Nº de gasolineras */
  count?: number;
}

const GROUPS: Suggestion['group'][] = ['Provincia', 'Municipio', 'CP'];

function Highlight({ text, match }: { text: string; match?: string }) {
  if (!match || !text.toLowerCase().startsWith(match.toLowerCase())) return <>{text}</>;
  return (
    <>
      <b>{text.slice(0, match.length)}</b>
      {text.slice(match.length)}
    </>
  );
}

/** Desplegable de sugerencias agrupadas: Provincia / Municipio / CP. */
export function Suggestions({
  items,
  activeId,
  onPick,
  id,
}: {
  items: Suggestion[];
  activeId?: string;
  onPick?: (item: Suggestion) => void;
  id: string;
}) {
  const headingBase = useId();
  return (
    <div
      id={id}
      role="listbox"
      aria-label="Sugerencias"
      className="absolute top-[calc(100%+8px)] right-0 left-0 z-20 rounded-[20px] border border-line bg-surface p-2 text-left shadow-raised"
    >
      {GROUPS.map((group) => {
        const rows = items.filter((item) => item.group === group);
        if (rows.length === 0) return null;
        const headingId = `${headingBase}-${group}`;
        return (
          <div key={group} role="group" aria-labelledby={headingId}>
            <div
              id={headingId}
              className="mx-3 mt-2 mb-1 text-[0.6875rem] font-bold tracking-[0.07em] text-muted uppercase"
            >
              {group}
            </div>
            {rows.map((item) => (
              <div
                key={item.id}
                id={item.id}
                role="option"
                aria-selected={item.id === activeId}
                tabIndex={-1}
                onMouseDown={(event) => {
                  event.preventDefault();
                  onPick?.(item);
                }}
                className={`flex min-h-11 cursor-pointer items-center gap-3 rounded-xl px-3 text-[0.9375rem] font-medium text-ink ${
                  item.id === activeId ? 'bg-brand-50' : 'hover:bg-brand-50'
                }`}
              >
                <MapPin width={18} height={18} className="flex-none text-muted" aria-hidden />
                <span className="min-w-0 flex-1 truncate">
                  <Highlight text={item.text} match={item.match} />
                </span>
                {(item.detail || item.count !== undefined) && (
                  <span className="flex-none text-[0.8125rem] text-muted">
                    {item.detail}
                    {item.detail && item.count !== undefined ? ' · ' : ''}
                    {item.count !== undefined ? `${item.count} gasolineras` : ''}
                  </span>
                )}
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}
