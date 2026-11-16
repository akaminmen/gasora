import { describe, expect, it } from 'vitest';
import { evaluateFreshness } from '../../scripts/check-freshness';

const HOUR = 3_600_000;
const SOURCE = '2026-11-12T12:00:00.000Z';
const at = (hours: number) => Date.parse(SOURCE) + hours * HOUR;

describe('evaluateFreshness', () => {
  it('con datos recientes no hay aviso', () => {
    expect(evaluateFreshness({ sourceDate: SOURCE, now: at(0.2) })).toMatchObject({
      stale: false,
      alert: false,
    });
    expect(evaluateFreshness({ sourceDate: SOURCE, now: at(5.9) }).alert).toBe(false);
  });

  it('avisa al cruzar el umbral de 6 h', () => {
    const result = evaluateFreshness({ sourceDate: SOURCE, now: at(6.05) });
    expect(result.stale).toBe(true);
    expect(result.alert).toBe(true);
    expect(result.ageHours).toBeCloseTo(6.05, 2);
  });

  it('no repite el aviso en cada ejecución: pasada la ventana de 15 min, queda en silencio', () => {
    expect(evaluateFreshness({ sourceDate: SOURCE, now: at(6.3) })).toMatchObject({
      stale: true,
      alert: false,
    });
    expect(evaluateFreshness({ sourceDate: SOURCE, now: at(12) }).alert).toBe(false);
  });

  it('vuelve a avisar cada 24 h mientras dure la caída', () => {
    expect(evaluateFreshness({ sourceDate: SOURCE, now: at(30.05) }).alert).toBe(true);
    expect(evaluateFreshness({ sourceDate: SOURCE, now: at(30.5) }).alert).toBe(false);
    expect(evaluateFreshness({ sourceDate: SOURCE, now: at(54.1) }).alert).toBe(true);
  });

  it('con un disparador cada 15 min exactamente una ejecución cae en cada ventana', () => {
    const hits = [];
    for (let minute = 0; minute < 24 * 60; minute += 15) {
      const now = Date.parse(SOURCE) + (6 * 60 + minute) * 60_000;
      if (evaluateFreshness({ sourceDate: SOURCE, now }).alert) hits.push(minute);
    }
    expect(hits).toEqual([0]);
  });

  it('una fecha ilegible avisa siempre', () => {
    expect(evaluateFreshness({ sourceDate: 'ayer', now: at(0) })).toMatchObject({
      stale: true,
      alert: true,
    });
  });

  it('el umbral y la repetición son configurables', () => {
    expect(evaluateFreshness({ sourceDate: SOURCE, now: at(2.05), alertAfterHours: 2 }).alert).toBe(
      true,
    );
    expect(
      evaluateFreshness({
        sourceDate: SOURCE,
        now: at(14.05),
        alertAfterHours: 2,
        repeatEveryHours: 12,
      }).alert,
    ).toBe(true);
  });
});
