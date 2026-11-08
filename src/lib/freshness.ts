/**
 * Frescura de los datos con la pestaña abierta: cada 10 minutos, mientras la pestaña esté visible,
 * se pide solo `meta.json` (con revalidación) y se compara su huella con la de los datos que usa la
 * pantalla. Este módulo no depende del navegador: el temporizador y las condiciones se inyectan para
 * poder probarlo con relojes simulados.
 */
import type { Meta } from './data-schema';

/** Cada cuánto se comprueba si hay datos nuevos con la pestaña visible. */
export const CHECK_INTERVAL_MS = 10 * 60 * 1000;
/** Espera tras el primer fallo; se duplica en cada fallo seguido hasta `CHECK_INTERVAL_MS`. */
export const BACKOFF_BASE_MS = 30 * 1000;

/**
 * ¿Hay datos nuevos? Compara la huella de contenido (estaciones, precios e índice, sin fechas). Si
 * alguno de los dos `meta.json` es anterior a esa huella, compara la de precios y el fichero de
 * estaciones. Que solo cambie la hora de la consulta NO cuenta.
 */
export function hasNewData(
  current: Pick<Meta, 'contentHash' | 'priceHash' | 'stationsFile'>,
  latest: Pick<Meta, 'contentHash' | 'priceHash' | 'stationsFile'>,
): boolean {
  if (current.contentHash && latest.contentHash) return current.contentHash !== latest.contentHash;
  return current.priceHash !== latest.priceHash || current.stationsFile !== latest.stationsFile;
}

/** Espera antes del siguiente intento tras `failures` fallos seguidos (1 → 30 s, 2 → 60 s… tope 10 min). */
export function backoffDelay(failures: number): number {
  if (failures <= 0) return CHECK_INTERVAL_MS;
  return Math.min(CHECK_INTERVAL_MS, BACKOFF_BASE_MS * 2 ** (failures - 1));
}

export type CheckResult = 'same' | 'new' | 'error';

export interface SchedulerDeps {
  /** Hace una comprobación. Nunca debe lanzar: devuelve `'error'` si falla. */
  check: () => Promise<CheckResult>;
  /** ¿Se puede comprobar ahora? Pestaña visible, con conexión, sin ahorro de datos y con datos cargados. */
  isActive: () => boolean;
  now?: () => number;
  setTimer?: (callback: () => void, ms: number) => unknown;
  clearTimer?: (handle: unknown) => void;
  /** Variación aleatoria 0–1 para repartir las peticiones (±10 % del intervalo) */
  random?: () => number;
  intervalMs?: number;
}

export interface Scheduler {
  /** Arranca (o rearranca) el reloj: llamar al volver a la pestaña o al recuperar la conexión. */
  resume: () => void;
  /** Para el reloj: pestaña oculta, sin conexión o ahorro de datos. */
  pause: () => void;
  /** Marca que los datos se acaban de cargar o comprobar (reinicia la cuenta). */
  touch: () => void;
  stop: () => void;
}

export function createScheduler(deps: SchedulerDeps): Scheduler {
  const now = deps.now ?? Date.now;
  const setTimer = deps.setTimer ?? ((cb, ms) => window.setTimeout(cb, ms));
  const clearTimer = deps.clearTimer ?? ((h) => window.clearTimeout(h as number));
  const random = deps.random ?? Math.random;
  const interval = deps.intervalMs ?? CHECK_INTERVAL_MS;
  let timer: unknown;
  let lastCheck = now();
  let failures = 0;
  let running = false;
  let stopped = false;

  const clear = () => {
    if (timer !== undefined) clearTimer(timer);
    timer = undefined;
  };
  const jitter = (ms: number) => Math.round(ms * (0.9 + random() * 0.2));
  const arm = (ms: number) => {
    clear();
    if (stopped) return;
    timer = setTimer(() => void tick(), Math.max(0, ms));
  };

  async function tick(): Promise<void> {
    timer = undefined;
    if (stopped || running || !deps.isActive()) return;
    running = true;
    lastCheck = now();
    const result = await deps.check();
    running = false;
    if (stopped) return;
    if (result === 'error') {
      failures += 1;
      arm(backoffDelay(failures));
    } else {
      failures = 0;
      arm(jitter(interval));
    }
  }

  return {
    resume() {
      if (stopped || !deps.isActive()) return;
      const elapsed = now() - lastCheck;
      // Tras más de un intervalo con la pestaña oculta o sin conexión, se comprueba enseguida
      if (elapsed >= interval) void tick();
      else arm(failures > 0 ? backoffDelay(failures) : interval - elapsed);
    },
    pause: clear,
    touch() {
      lastCheck = now();
      failures = 0;
    },
    stop() {
      stopped = true;
      clear();
    },
  };
}
