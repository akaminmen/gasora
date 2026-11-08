import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  BACKOFF_BASE_MS,
  CHECK_INTERVAL_MS,
  backoffDelay,
  createScheduler,
  hasNewData,
  type CheckResult,
} from '../../src/lib/freshness';

describe('hasNewData', () => {
  const a = { contentHash: 'aaaa', priceHash: 'p1', stationsFile: 'stations.1.json' };

  it('no hay datos nuevos si la huella de contenido es la misma', () => {
    expect(hasNewData(a, { ...a })).toBe(false);
  });
  it('hay datos nuevos si cambia la huella de contenido', () => {
    expect(hasNewData(a, { ...a, contentHash: 'bbbb' })).toBe(true);
  });
  it('con huella de contenido, lo demás no cuenta (cambiar solo el nombre del fichero no basta)', () => {
    expect(hasNewData(a, { ...a, priceHash: 'otro' })).toBe(false);
  });
  it('si falta la huella en alguno de los dos, compara precios y fichero de estaciones', () => {
    const old = { priceHash: 'p1', stationsFile: 'stations.1.json' };
    expect(hasNewData(old, { ...a })).toBe(false);
    expect(hasNewData(old, { ...a, priceHash: 'p2' })).toBe(true);
    expect(hasNewData(old, { ...a, stationsFile: 'stations.2.json' })).toBe(true);
  });
  it('la hora de la consulta no es un cambio (no forma parte de lo que se compara)', () => {
    const withDates = { ...a, sourceDate: '2026-11-06T10:00:00Z' };
    expect(hasNewData(withDates, { ...a, sourceDate: '2026-11-06T14:00:00Z' } as typeof a)).toBe(
      false,
    );
  });
});

describe('backoffDelay', () => {
  it('sin fallos, el intervalo normal de 10 minutos', () => {
    expect(backoffDelay(0)).toBe(CHECK_INTERVAL_MS);
    expect(CHECK_INTERVAL_MS).toBe(600_000);
  });
  it('crece al doble en cada fallo seguido y no pasa de 10 minutos', () => {
    expect([1, 2, 3, 4, 5, 6, 7, 20].map(backoffDelay)).toEqual([
      30_000, 60_000, 120_000, 240_000, 480_000, 600_000, 600_000, 600_000,
    ]);
    expect(BACKOFF_BASE_MS).toBe(30_000);
  });
});

describe('createScheduler (relojes simulados)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-06T10:00:00Z'));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  function make(results: CheckResult[] = [], active = { value: true }) {
    const check = vi.fn(async (): Promise<CheckResult> => results.shift() ?? 'same');
    const scheduler = createScheduler({
      check,
      isActive: () => active.value,
      now: () => Date.now(),
      setTimer: (cb, ms) => setTimeout(cb, ms),
      clearTimer: (h) => clearTimeout(h as ReturnType<typeof setTimeout>),
      random: () => 0.5, // sin variación: 0,9 + 0,5 · 0,2 = 1
    });
    return { check, scheduler, active };
  }

  it('comprueba cada 10 minutos mientras está activo', async () => {
    const { check, scheduler } = make();
    scheduler.resume();
    expect(check).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(CHECK_INTERVAL_MS - 1);
    expect(check).toHaveBeenCalledTimes(0);
    await vi.advanceTimersByTimeAsync(1);
    expect(check).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(CHECK_INTERVAL_MS);
    expect(check).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(3 * CHECK_INTERVAL_MS);
    expect(check).toHaveBeenCalledTimes(5);
    scheduler.stop();
  });

  it('no comprueba con la pestaña oculta o sin conexión (pausa) y no deja temporizadores', async () => {
    const { check, scheduler, active } = make();
    scheduler.resume();
    await vi.advanceTimersByTimeAsync(5 * 60_000);
    active.value = false;
    scheduler.pause();
    expect(vi.getTimerCount()).toBe(0);
    await vi.advanceTimersByTimeAsync(60 * 60_000);
    expect(check).not.toHaveBeenCalled();
    scheduler.stop();
  });

  it('si el temporizador salta con la pestaña ya inactiva, no comprueba', async () => {
    const { check, scheduler, active } = make();
    scheduler.resume();
    active.value = false; // sin llamar a pause()
    await vi.advanceTimersByTimeAsync(CHECK_INTERVAL_MS + 1);
    expect(check).not.toHaveBeenCalled();
    scheduler.stop();
  });

  it('al volver tras más de 10 minutos comprueba enseguida; antes, espera lo que falta', async () => {
    const { check, scheduler, active } = make();
    scheduler.resume();
    active.value = false;
    scheduler.pause();
    await vi.advanceTimersByTimeAsync(CHECK_INTERVAL_MS + 5000);
    active.value = true;
    scheduler.resume();
    await vi.advanceTimersByTimeAsync(0);
    expect(check).toHaveBeenCalledTimes(1);
    // Vuelve a la pestaña a los 4 min de la última comprobación: espera 6 min
    active.value = false;
    scheduler.pause();
    await vi.advanceTimersByTimeAsync(4 * 60_000);
    active.value = true;
    scheduler.resume();
    await vi.advanceTimersByTimeAsync(6 * 60_000 - 1);
    expect(check).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(check).toHaveBeenCalledTimes(2);
    scheduler.stop();
  });

  it('reintenta con espera creciente tras los fallos (30 s, 60 s, 120 s…) y vuelve al ritmo normal al acertar', async () => {
    const { check, scheduler } = make(['error', 'error', 'error', 'same']);
    scheduler.resume();
    await vi.advanceTimersByTimeAsync(CHECK_INTERVAL_MS); // 1.ª comprobación: falla
    expect(check).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(30_000 - 1);
    expect(check).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1); // reintento a los 30 s: falla
    expect(check).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(60_000); // a los 60 s: falla
    expect(check).toHaveBeenCalledTimes(3);
    await vi.advanceTimersByTimeAsync(120_000); // a los 120 s: acierta
    expect(check).toHaveBeenCalledTimes(4);
    await vi.advanceTimersByTimeAsync(CHECK_INTERVAL_MS - 1);
    expect(check).toHaveBeenCalledTimes(4);
    await vi.advanceTimersByTimeAsync(1);
    expect(check).toHaveBeenCalledTimes(5);
    scheduler.stop();
  });

  it('no solapa comprobaciones: si una tarda, no se lanza otra', async () => {
    let finish: (value: CheckResult) => void = () => undefined;
    const check = vi.fn(() => new Promise<CheckResult>((resolve) => (finish = resolve)));
    const scheduler = createScheduler({
      check,
      isActive: () => true,
      random: () => 0.5,
      setTimer: (cb, ms) => setTimeout(cb, ms),
      clearTimer: (h) => clearTimeout(h as ReturnType<typeof setTimeout>),
    });
    scheduler.resume();
    await vi.advanceTimersByTimeAsync(CHECK_INTERVAL_MS);
    scheduler.resume(); // p. ej. visibilitychange mientras comprueba
    await vi.advanceTimersByTimeAsync(0);
    expect(check).toHaveBeenCalledTimes(1);
    finish('same');
    await vi.advanceTimersByTimeAsync(0);
    scheduler.stop();
  });

  it('«touch» (datos recién cargados) reinicia la cuenta y los fallos', async () => {
    const { check, scheduler } = make(['error']);
    scheduler.resume();
    await vi.advanceTimersByTimeAsync(CHECK_INTERVAL_MS);
    expect(check).toHaveBeenCalledTimes(1); // falló: reintento en 30 s
    scheduler.touch();
    scheduler.resume(); // tras «touch», el ritmo vuelve a ser de 10 minutos
    await vi.advanceTimersByTimeAsync(CHECK_INTERVAL_MS - 1);
    expect(check).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(check).toHaveBeenCalledTimes(2);
    scheduler.stop();
  });

  it('el jitter reparte las peticiones dentro de ±10 %', async () => {
    const times: number[] = [];
    const scheduler = createScheduler({
      check: async () => {
        times.push(Date.now());
        return 'same';
      },
      isActive: () => true,
      random: () => 1, // el máximo: +10 %
      setTimer: (cb, ms) => setTimeout(cb, ms),
      clearTimer: (h) => clearTimeout(h as ReturnType<typeof setTimeout>),
    });
    scheduler.resume();
    await vi.advanceTimersByTimeAsync(CHECK_INTERVAL_MS);
    await vi.advanceTimersByTimeAsync(CHECK_INTERVAL_MS * 1.1);
    expect(times).toHaveLength(2);
    expect(times[1]! - times[0]!).toBe(CHECK_INTERVAL_MS * 1.1);
    scheduler.stop();
  });

  it('stop() para todo', async () => {
    const { check, scheduler } = make();
    scheduler.resume();
    scheduler.stop();
    await vi.advanceTimersByTimeAsync(2 * CHECK_INTERVAL_MS);
    expect(check).not.toHaveBeenCalled();
    scheduler.resume();
    await vi.advanceTimersByTimeAsync(2 * CHECK_INTERVAL_MS);
    expect(check).not.toHaveBeenCalled();
  });
});
