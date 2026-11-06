import { describe, expect, it } from 'vitest';
import { comparePrices, madridTime, summarize, type Sample } from '../../scripts/cadence-compare';

describe('comparePrices', () => {
  const before = {
    '1': [1500, null, 1400, null, null, null],
    '2': [1600, 1700, null, null, null, null],
    '3': [1000, null, null, null, null, null],
  };

  it('cuenta estaciones con algún cambio, cambios por combustible, nuevas y retiradas', () => {
    const now = {
      '1': [1510, null, 1400, null, null, null], // cambia la gasolina 95
      '2': [1600, 1700, null, null, null, null], // igual
      '4': [1300, null, null, null, null, null], // nueva
    };
    expect(comparePrices(before, now)).toEqual({
      changed: 1,
      changedByFuel: [1, 0, 0, 0, 0, 0],
      added: 1,
      removed: 1, // la 3
    });
  });
  it('un combustible que aparece o desaparece cuenta como cambio', () => {
    const now = {
      '1': [1500, 1800, 1400, null, null, null], // aparece la 98
      '2': [1600, null, null, null, null, null], // desaparece la 98
      '3': before['3'],
    };
    const diff = comparePrices(before, now);
    expect(diff.changed).toBe(2);
    expect(diff.changedByFuel).toEqual([0, 2, 0, 0, 0, 0]);
    expect(diff.removed).toBe(0);
  });
  it('dos fotos iguales: sin cambios', () => {
    expect(comparePrices(before, before)).toEqual({
      changed: 0,
      changedByFuel: [0, 0, 0, 0, 0, 0],
      added: 0,
      removed: 0,
    });
  });
});

describe('madridTime', () => {
  it('usa la hora de Madrid en invierno (UTC+1) y en verano (UTC+2)', () => {
    expect(madridTime(new Date('2026-11-04T23:10:00Z')).text).toBe('00:10');
    expect(madridTime(new Date('2026-07-04T22:10:00Z')).text).toBe('00:10');
    expect(madridTime(new Date('2026-11-04T10:05:00Z')).text).toBe('11:05');
  });
});

describe('summarize', () => {
  const sample = (madrid: string, changed: number | null): Sample => ({
    at: '2026-11-04T00:00:00Z',
    madrid,
    minutesSincePrevious: 15,
    changed,
  });
  it('agrupa por hora de Madrid, elige la de más cambios y suma la ventana de medianoche', () => {
    const summary = summarize([
      sample('23:15', 5), // fuera de la ventana (antes de las 23:30)
      sample('23:45', 40),
      sample('00:15', 300),
      sample('00:30', 20),
      sample('01:20', 10),
      sample('01:45', 7), // fuera
      sample('10:00', null), // sin comparación: no cuenta
    ]);
    expect(summary.horaConMasCambios).toBe(0);
    expect(summary.ventanaMedianoche).toEqual({
      desde: '23:30',
      hasta: '01:30',
      mediciones: 4,
      estacionesConCambios: 370,
    });
    expect(summary.porHoraMadrid.find((h) => h.hour === 0)).toEqual({
      hour: 0,
      mediciones: 2,
      estacionesConCambios: 320,
    });
    expect(summary.porHoraMadrid.map((h) => h.hour)).toEqual([0, 1, 23]);
  });
  it('sin cambios no hay hora destacada', () => {
    expect(summarize([sample('12:00', 0), sample('12:15', 0)]).horaConMasCambios).toBeNull();
    expect(summarize([]).horaConMasCambios).toBeNull();
  });
});
