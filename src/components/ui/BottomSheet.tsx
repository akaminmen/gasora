import type { ReactNode } from 'react';

export type SheetSnap = 'compact' | 'mid' | 'full';

const NEXT: Record<SheetSnap, SheetSnap> = { compact: 'mid', mid: 'full', full: 'compact' };
const SNAP_LABELS: Record<SheetSnap, string> = {
  compact: 'compacta',
  mid: 'intermedia',
  full: 'expandida',
};

/**
 * Hoja inferior móvil con tres alturas. El asa es un botón (accesible con teclado) que pasa a la
 * siguiente altura. Los gestos de arrastre llegan con el mapa (Fase 4).
 * Se coloca con position: absolute dentro de un contenedor relativo.
 */
export function BottomSheet({
  snap,
  onSnapChange,
  label,
  children,
}: {
  snap: SheetSnap;
  onSnapChange: (snap: SheetSnap) => void;
  label: string;
  children: ReactNode;
}) {
  return (
    <section className="bottom-sheet" data-snap={snap} aria-label={label}>
      <button
        type="button"
        className="bottom-sheet__handle"
        aria-label={`Cambiar la altura de la hoja (ahora ${SNAP_LABELS[snap]})`}
        onClick={() => onSnapChange(NEXT[snap])}
      >
        <span className="bottom-sheet__grip" />
      </button>
      <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
    </section>
  );
}
