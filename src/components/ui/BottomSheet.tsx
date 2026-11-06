import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent,
  type ReactNode,
} from 'react';

export type SheetSnap = 'compact' | 'mid' | 'full';

export const SNAP_ORDER: SheetSnap[] = ['compact', 'mid', 'full'];
const NEXT: Record<SheetSnap, SheetSnap> = { compact: 'mid', mid: 'full', full: 'compact' };
const SNAP_LABELS: Record<SheetSnap, string> = {
  compact: 'compacta',
  mid: 'intermedia',
  full: 'expandida',
};

/** Alturas de la hoja en px según el alto del contenedor (compacta, intermedia y expandida). */
export function sheetHeights(containerHeight: number, topReserve = 116): Record<SheetSnap, number> {
  const compact = Math.min(180, Math.max(120, containerHeight * 0.3));
  const mid = Math.min(Math.max(containerHeight * 0.5, compact + 60), 440);
  // La expandida deja libre la franja superior para el buscador y los chips flotantes
  const full = Math.max(mid + 60, containerHeight - topReserve);
  return { compact, mid, full };
}

/**
 * Altura a la que queda la hoja al soltar. Un gesto rápido (más de 0,5 px/ms) lleva a la siguiente
 * altura en su dirección; uno lento, a la más cercana. `velocityPxPerMs` > 0 es hacia arriba.
 */
export function nearestSnap(
  height: number,
  heights: Record<SheetSnap, number>,
  velocityPxPerMs: number,
): SheetSnap {
  if (Math.abs(velocityPxPerMs) >= 0.5) {
    const up = velocityPxPerMs > 0;
    const candidates = SNAP_ORDER.filter((s) => (up ? heights[s] > height : heights[s] < height));
    if (candidates.length === 0) return up ? 'full' : 'compact';
    // La siguiente en esa dirección: la más baja por encima, o la más alta por debajo
    return (up ? candidates[0] : candidates[candidates.length - 1]) as SheetSnap;
  }
  return [...SNAP_ORDER].sort(
    (a, b) => Math.abs(heights[a] - height) - Math.abs(heights[b] - height),
  )[0] as SheetSnap;
}

const DRAG_THRESHOLD_PX = 6;

/**
 * Hoja inferior móvil con tres alturas. Se coloca con position: absolute dentro de un
 * contenedor relativo y solo ocupa su propio rectángulo (el resto del mapa sigue recibiendo gestos).
 *
 * - Asa: botón accesible (Intro/Espacio pasa a la siguiente altura; ↑ ↓ Inicio y Fin la mueven).
 * - Arrastre con puntero (táctil o ratón) desde el asa y la cabecera, con inercia.
 * - Con «reducir movimiento» las transiciones se desactivan (CSS).
 */
export function BottomSheet({
  snap,
  onSnapChange,
  label,
  header,
  onHeightChange,
  topReserve,
  collapsed = false,
  collapsedLabel = 'Mostrar lista de gasolineras',
  onExpand,
  children,
}: {
  snap: SheetSnap;
  onSnapChange: (snap: SheetSnap) => void;
  label: string;
  /** Parte fija (no se desplaza) bajo el asa: título, orden… También sirve para arrastrar. */
  header?: ReactNode;
  /** Altura actual en px, también mientras se arrastra (para dejar libre la atribución del mapa) */
  onHeightChange?: (height: number) => void;
  /** Alto (px) de la franja superior que la hoja expandida deja libre (buscador y chips flotantes) */
  topReserve?: number;
  /**
   * Modo exploración: la hoja se repliega a una línea fina (el asa) para dejar el mapa libre. La
   * lista sigue montada pero oculta. Se vuelve a abrir con `onExpand` (tocar, arrastrar hacia
   * arriba o Intro/Espacio) y recupera la altura anterior (`snap` no cambia).
   */
  collapsed?: boolean;
  /** Nombre accesible del botón que reabre la hoja, p. ej. «Mostrar lista de gasolineras (12)» */
  collapsedLabel?: string;
  onExpand?: () => void;
  children: ReactNode;
}) {
  const ref = useRef<HTMLElement>(null);
  const [containerHeight, setContainerHeight] = useState(680);
  const [dragHeight, setDragHeight] = useState<number | null>(null);
  const drag = useRef<{
    startY: number;
    startHeight: number;
    active: boolean;
    samples: { y: number; t: number }[];
    pointerId: number;
  } | null>(null);
  const suppressClick = useRef(false);
  const restoreRef = useRef<HTMLButtonElement>(null);
  const handleRef = useRef<HTMLButtonElement>(null);
  const restoreDrag = useRef<{ startY: number; done: boolean } | null>(null);
  const refocusHandle = useRef(false);

  const heights = sheetHeights(containerHeight, topReserve);
  const height = dragHeight ?? heights[snap];

  useLayoutEffect(() => {
    const parent = ref.current?.parentElement;
    if (!parent) return;
    const measure = () => setContainerHeight(parent.clientHeight || 680);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(parent);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!collapsed) onHeightChange?.(height);
  }, [height, onHeightChange, collapsed]);

  // Replegada, la hoja mide lo que el asa (44 px + el margen inferior de seguridad del dispositivo)
  useLayoutEffect(() => {
    const el = ref.current;
    if (!collapsed || !el) return;
    const report = () => onHeightChange?.(el.offsetHeight);
    report();
    const observer = new ResizeObserver(report);
    observer.observe(el);
    return () => observer.disconnect();
  }, [collapsed, onHeightChange]);

  // Al reabrir con el teclado o con un toque, el foco pasa al asa normal (el botón replegado desaparece)
  useEffect(() => {
    if (!collapsed && refocusHandle.current) {
      refocusHandle.current = false;
      handleRef.current?.focus({ preventScroll: true });
    }
  }, [collapsed]);

  const expand = () => {
    refocusHandle.current = true;
    onExpand?.();
  };

  const onPointerDown = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      const target = event.target as HTMLElement;
      // Los controles de la cabecera (orden, filtros…) no arrastran, salvo el asa
      const interactive = target.closest('button, a, input, select, [role="group"]');
      if (interactive && !interactive.classList.contains('bottom-sheet__handle')) return;
      drag.current = {
        startY: event.clientY,
        startHeight: heights[snap],
        active: false,
        samples: [{ y: event.clientY, t: event.timeStamp }],
        pointerId: event.pointerId,
      };
    },
    [heights, snap],
  );

  const onPointerMove = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      const state = drag.current;
      if (!state || event.pointerId !== state.pointerId) return;
      const dy = event.clientY - state.startY;
      if (!state.active) {
        if (Math.abs(dy) < DRAG_THRESHOLD_PX) return;
        state.active = true;
        // Se captura el puntero solo al empezar a arrastrar, para no romper el clic del asa
        try {
          event.currentTarget.setPointerCapture(event.pointerId);
        } catch {
          // Puntero ya liberado o sintético: el arrastre sigue con los eventos que lleguen
        }
      }
      state.samples.push({ y: event.clientY, t: event.timeStamp });
      if (state.samples.length > 5) state.samples.shift();
      setDragHeight(Math.min(heights.full, Math.max(heights.compact, state.startHeight - dy)));
    },
    [heights],
  );

  const finish = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      const state = drag.current;
      drag.current = null;
      if (!state || !state.active) return;
      suppressClick.current = true;
      window.setTimeout(() => (suppressClick.current = false), 0);
      // Solo cuenta el movimiento de los últimos 100 ms: si se frena antes de soltar, no hay inercia
      const recent = state.samples.filter((s) => event.timeStamp - s.t < 100);
      const first = recent[0];
      const last = recent[recent.length - 1];
      const velocity =
        first && last && last.t > first.t ? -(last.y - first.y) / (last.t - first.t) : 0;
      const finalHeight = Math.min(
        heights.full,
        Math.max(heights.compact, state.startHeight - (event.clientY - state.startY)),
      );
      setDragHeight(null);
      onSnapChange(nearestSnap(finalHeight, heights, velocity));
    },
    [heights, onSnapChange],
  );

  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    const index = SNAP_ORDER.indexOf(snap);
    let next: SheetSnap | undefined;
    if (event.key === 'ArrowUp') next = SNAP_ORDER[Math.min(2, index + 1)];
    else if (event.key === 'ArrowDown') next = SNAP_ORDER[Math.max(0, index - 1)];
    else if (event.key === 'Home') next = 'compact';
    else if (event.key === 'End') next = 'full';
    if (next) {
      event.preventDefault();
      onSnapChange(next);
    }
  };

  return (
    <section
      ref={ref}
      className="bottom-sheet"
      data-snap={snap}
      data-collapsed={collapsed ? 'true' : 'false'}
      data-dragging={dragHeight !== null ? 'true' : 'false'}
      aria-label={label}
      style={{ height: collapsed ? 'calc(44px + env(safe-area-inset-bottom, 0px))' : height }}
    >
      {collapsed && (
        <button
          ref={restoreRef}
          type="button"
          className="bottom-sheet__restore"
          aria-expanded="false"
          aria-label={collapsedLabel}
          data-testid="sheet-restore"
          onClick={() => {
            if (restoreDrag.current?.done) return;
            expand();
          }}
          onPointerDown={(event) => {
            restoreDrag.current = { startY: event.clientY, done: false };
          }}
          onPointerMove={(event) => {
            const state = restoreDrag.current;
            if (!state || state.done) return;
            // Arrastrar el asa hacia arriba reabre la hoja
            if (state.startY - event.clientY >= DRAG_THRESHOLD_PX) {
              state.done = true;
              expand();
            }
          }}
          onPointerUp={() => window.setTimeout(() => (restoreDrag.current = null), 0)}
          onPointerCancel={() => (restoreDrag.current = null)}
        >
          <span className="bottom-sheet__line" aria-hidden="true" />
        </button>
      )}
      <div
        hidden={collapsed}
        className="bottom-sheet__drag"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={finish}
        onPointerCancel={finish}
      >
        <button
          ref={handleRef}
          type="button"
          className="bottom-sheet__handle"
          aria-label={`Cambiar la altura de la hoja (ahora ${SNAP_LABELS[snap]})`}
          aria-keyshortcuts="ArrowUp ArrowDown"
          onKeyDown={onKeyDown}
          onClick={() => {
            if (suppressClick.current) return;
            onSnapChange(NEXT[snap]);
          }}
        >
          <span className="bottom-sheet__grip" />
        </button>
        {header}
      </div>
      <div
        hidden={collapsed}
        className="min-h-0 flex-1 overflow-y-auto"
        data-testid="sheet-content"
      >
        {children}
      </div>
    </section>
  );
}
