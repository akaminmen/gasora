import { ChevronDown, MapPin, Store } from 'lucide-react';
import { useCallback, useId, useRef, useState } from 'react';
import { useDismissable } from '../../hooks/useDismissable';
import { FUELS, type FuelId } from '../../lib/fuel-ids';
import { FUEL_LABELS } from '../../lib/fuels';
import type { SortKey } from '../../lib/resultset';

export function FuelChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`inline-flex min-h-11 flex-none items-center gap-1.5 rounded-full border px-4 text-[0.8125rem] font-semibold whitespace-nowrap transition ${
        active
          ? 'border-brand bg-brand text-on-brand'
          : 'border-line bg-surface text-ink hover:bg-brand-50'
      }`}
    >
      {label}
    </button>
  );
}

/** Los 6 combustibles del MVP; siempre hay uno activo. */
export function FuelChips({
  value,
  onChange,
  wrap = false,
}: {
  value: FuelId;
  onChange: (fuel: FuelId) => void;
  wrap?: boolean;
}) {
  return (
    <div
      role="group"
      aria-label="Tipo de combustible"
      className={`flex gap-2 py-0.5 ${wrap ? 'flex-wrap' : 'overflow-x-auto [scrollbar-width:none]'}`}
    >
      {FUELS.map((fuel) => (
        <FuelChip
          key={fuel}
          label={FUEL_LABELS[fuel]}
          active={fuel === value}
          onClick={() => onChange(fuel)}
        />
      ))}
    </div>
  );
}

export type { SortKey };

/** Selector de orden: precio (por defecto) o distancia. */
export function SortControl({
  value,
  onChange,
}: {
  value: SortKey;
  onChange: (value: SortKey) => void;
}) {
  const options: [SortKey, string][] = [
    ['price', 'Precio'],
    ['distance', 'Distancia'],
  ];
  return (
    <div
      role="group"
      aria-label="Ordenar por"
      className="inline-flex rounded-full border border-line bg-surface-2 p-[3px]"
    >
      {options.map(([key, label]) => (
        <button
          key={key}
          type="button"
          aria-pressed={value === key}
          onClick={() => onChange(key)}
          className={`min-h-11 rounded-full border-0 px-3.5 text-[0.8125rem] font-semibold ${
            value === key ? 'bg-surface text-ink shadow-soft' : 'bg-transparent text-muted'
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

/** Control de radio de búsqueda (1–50 km, por defecto 5). */
export function RadiusSlider({
  value,
  onChange,
  min = 1,
  max = 50,
}: {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
}) {
  const id = useId();
  return (
    <div className="flex items-center gap-3.5 text-[0.8125rem] font-semibold">
      <label htmlFor={id} className="inline-flex items-center gap-1.5">
        <MapPin width={16} height={16} aria-hidden />
        Radio
      </label>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        aria-valuetext={`${value} kilómetros`}
        className="h-11 min-w-0 flex-1"
      />
      <span className="w-12 text-right tabular-nums">{value} km</span>
    </div>
  );
}

export interface BrandOption {
  key: string;
  label: string;
  count: number;
}

/**
 * Filtro de marcas (multiselección). El agrupado en «Otras» solo afecta a esta lista: la tarjeta
 * de cada estación sigue mostrando su rótulo real.
 */
export function BrandMultiSelect({
  options,
  selected,
  onChange,
}: {
  options: BrandOption[];
  selected: string[];
  onChange: (selected: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const close = useCallback(() => setOpen(false), []);
  // Esc cierra y devuelve el foco al botón; el foco no sale del desplegable mientras está abierto
  useDismissable({ open, onClose: close, containerRef: panelRef, triggerRef });
  const toggle = (key: string) =>
    onChange(selected.includes(key) ? selected.filter((k) => k !== key) : [...selected, key]);
  return (
    <div className="relative inline-block">
      <button
        ref={triggerRef}
        type="button"
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        onClick={() => setOpen((v) => !v)}
        className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-line bg-surface px-3 text-[0.8125rem] font-semibold whitespace-nowrap text-ink"
      >
        <Store width={16} height={16} aria-hidden />
        Marcas{selected.length > 0 ? ` (${selected.length})` : ''}
        <ChevronDown width={16} height={16} aria-hidden />
      </button>
      {open && (
        <div
          ref={panelRef}
          id={panelId}
          role="group"
          aria-label="Marcas"
          className="absolute top-[calc(100%+8px)] left-0 z-20 max-h-[60dvh] w-64 overflow-y-auto rounded-2xl border border-line bg-surface p-2 shadow-raised"
        >
          {options.map((option) => (
            <label
              key={option.key}
              className="flex min-h-11 items-center gap-3 rounded-xl px-3 text-[0.9375rem] hover:bg-brand-50"
            >
              <input
                type="checkbox"
                checked={selected.includes(option.key)}
                onChange={() => toggle(option.key)}
                className="size-5 accent-brand"
              />
              <span className="min-w-0 flex-1 truncate">{option.label}</span>
              <span className="text-[0.8125rem] text-muted tabular-nums">{option.count}</span>
            </label>
          ))}
          <button
            type="button"
            onClick={() => {
              close();
              triggerRef.current?.focus();
            }}
            className="mt-1 inline-flex min-h-11 w-full items-center justify-center rounded-xl border-0 bg-brand-50 px-3 text-[0.875rem] font-semibold text-link"
          >
            Hecho
          </button>
        </div>
      )}
    </div>
  );
}
