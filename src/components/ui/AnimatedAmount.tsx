import { useEffect, useRef } from 'react';
import { formatMoney } from '../../lib/format';

const DURATION_MS = 700;

/**
 * Importe en euros con conteo animado hasta el valor nuevo (ease-out). Con «reducir movimiento»
 * salta directamente. El texto animado es decorativo (`aria-hidden`): el valor final se anuncia
 * aparte, una sola vez, con `announce`.
 */
export function AnimatedAmount({
  value,
  announce,
  className,
  testId,
}: {
  value: number;
  /** Texto para lectores de pantalla con el valor final */
  announce: string;
  className?: string;
  testId?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const shown = useRef(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) {
      shown.current = value;
      el.textContent = formatMoney(value);
      return;
    }
    const from = shown.current;
    const start = performance.now();
    let frame = 0;
    const step = (now: number) => {
      const k = Math.min(1, (now - start) / DURATION_MS);
      const eased = 1 - Math.pow(1 - k, 3);
      shown.current = from + (value - from) * eased;
      el.textContent = formatMoney(shown.current);
      if (k < 1) frame = requestAnimationFrame(step);
      else el.dataset['done'] = 'true';
    };
    delete el.dataset['done'];
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [value]);

  return (
    <>
      <span ref={ref} className={className} aria-hidden="true" data-testid={testId}>
        {formatMoney(0)}
      </span>
      <span className="sr-only" role="status">
        {announce}
      </span>
    </>
  );
}
