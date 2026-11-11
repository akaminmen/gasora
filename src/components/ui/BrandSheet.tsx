import { X } from 'lucide-react';
import { useEffect, useId, useRef, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import { focusableIn } from '../../hooks/useDismissable';
import { useModalLock } from '../../hooks/useModalLock';
import type { BrandOption } from './Controls';

/** «3 marcas elegidas», «1 marca elegida» o «Ninguna marca elegida». */
export function brandCountLabel(count: number): string {
  if (count === 0) return 'Ninguna marca elegida';
  return count === 1 ? '1 marca elegida' : `${count} marcas elegidas`;
}

/**
 * Selector de marcas para móvil: una hoja de selección modal, dibujada en un portal fuera de la
 * hoja inferior (que recorta con `overflow: hidden` y captura el gesto vertical con
 * `touch-action: none`). Tiene su propio desplazamiento, título, contador, «Limpiar» y «Listo».
 *
 * - `selected` es el borrador: no se aplica a los resultados hasta pulsar «Listo» (así la lista y el
 *   mapa no se recolocan por detrás mientras se elige). Escape, tocar fuera y la X descartan.
 * - Foco: entra en el diálogo, Tab da la vuelta dentro y al cerrar vuelve al botón que lo abrió.
 */
export function BrandSheet({
  options,
  selected,
  onToggle,
  onClear,
  onDone,
  onCancel,
  triggerRef,
}: {
  options: BrandOption[];
  selected: string[];
  onToggle: (key: string) => void;
  onClear: () => void;
  onDone: () => void;
  onCancel: () => void;
  triggerRef: RefObject<HTMLElement | null>;
}) {
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const cancelRef = useRef(onCancel);
  useEffect(() => {
    cancelRef.current = onCancel;
  });
  useModalLock(true);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const trigger = triggerRef.current;
    dialog.focus({ preventScroll: true });
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        cancelRef.current();
        return;
      }
      if (event.key !== 'Tab') return;
      const items = focusableIn(dialog);
      const first = items[0];
      const last = items[items.length - 1];
      if (!first || !last) return;
      const active = document.activeElement;
      if (!dialog.contains(active) || active === dialog) {
        event.preventDefault();
        (event.shiftKey ? last : first).focus();
      } else if (event.shiftKey && active === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown, true);
    return () => {
      document.removeEventListener('keydown', onKeyDown, true);
      // Se quita `inert` antes (cleanup de useModalLock, que se declaró antes): el botón ya admite foco
      requestAnimationFrame(() => trigger?.focus({ preventScroll: true }));
    };
  }, [triggerRef]);

  // Los eventos de un portal suben por el árbol de React hasta la hoja inferior (que arrastraría la
  // hoja con ellos): se cortan aquí
  const stop = (event: { stopPropagation: () => void }) => event.stopPropagation();

  return createPortal(
    <div
      className="dialog-backdrop"
      data-testid="brand-dialog-backdrop"
      onPointerDown={(event) => {
        if (event.target === event.currentTarget) onCancel();
        stop(event);
      }}
      onPointerMove={stop}
      onPointerUp={stop}
      onPointerCancel={stop}
      onTouchStart={stop}
      onTouchMove={stop}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className="dialog-sheet"
        data-testid="brand-dialog"
      >
        <div className="dialog-sheet__head">
          <div className="min-w-0 flex-1">
            <h2 id={titleId} className="font-display-800 text-[1.125rem] leading-tight">
              Marcas
            </h2>
            <p role="status" aria-live="polite" className="text-[0.8125rem] text-muted">
              {brandCountLabel(selected.length)}
            </p>
          </div>
          <button
            type="button"
            onClick={onCancel}
            aria-label="Cerrar sin aplicar"
            className="inline-grid size-11 flex-none place-items-center rounded-full border-0 bg-transparent text-muted hover:bg-brand-50"
          >
            <X width={20} height={20} aria-hidden />
          </button>
        </div>
        <div className="dialog-sheet__list" data-testid="brand-dialog-list">
          {options.map((option) => (
            <label
              key={option.key}
              className="flex min-h-11 items-center gap-3 rounded-xl px-3 text-[0.9375rem] hover:bg-brand-50"
            >
              <input
                type="checkbox"
                checked={selected.includes(option.key)}
                onChange={() => onToggle(option.key)}
                className="size-5 flex-none accent-brand"
              />
              <span className="min-w-0 flex-1 truncate">{option.label}</span>
              <span className="text-[0.8125rem] text-muted tabular-nums">{option.count}</span>
            </label>
          ))}
        </div>
        <div className="dialog-sheet__foot">
          <button
            type="button"
            onClick={onClear}
            className="inline-flex min-h-11 flex-1 items-center justify-center rounded-full border border-line bg-surface px-5 text-sm font-semibold text-ink hover:bg-brand-50"
          >
            Limpiar
          </button>
          <button
            type="button"
            onClick={onDone}
            className="inline-flex min-h-11 flex-1 items-center justify-center rounded-full border border-transparent bg-brand px-5 text-sm font-semibold text-on-brand hover:bg-brand-hover"
          >
            Listo
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
