import { describe, expect, it } from 'vitest';
import { nearestSnap, sheetHeights } from '../../src/components/ui/BottomSheet';
import type { ResultItem } from '../../src/lib/resultset';
import { MAX_PINS, choosePins } from '../../src/features/map/pins';

function item(id: string, price: number, best = false): ResultItem {
  return {
    station: {
      id,
      b: 'repsol',
      n: `E.S. ${id}`,
      a: '',
      z: '',
      pid: 1,
      mid: 1,
      lat: 36,
      lng: -4,
      h: '',
      s: 'P',
    },
    price,
    tier: 'mid',
    best,
    saving: 0,
    brandGroup: 'repsol',
  };
}

describe('choosePins', () => {
  const items = Array.from({ length: 100 }, (_, i) => item(String(i + 1), 1500 - i, i === 99));
  const byId = new Map(items.map((i) => [i.station.id, i]));
  const all = items.map((i) => i.station.id);

  it('no pasa de 60 pines y prefiere la más barata y los precios más bajos', () => {
    const ids = choosePins(all, byId, null);
    expect(ids).toHaveLength(MAX_PINS);
    expect(ids[0]).toBe('100'); // la «más barata»
    expect(ids).toContain('41'); // 1500 − 40 = 1460: entre las 60 más baratas
    expect(ids).not.toContain('1');
  });

  it('la seleccionada va la primera, aunque no esté entre las más baratas', () => {
    const ids = choosePins(all, byId, '1');
    expect(ids[0]).toBe('1');
    expect(ids).toHaveLength(MAX_PINS);
  });

  it('la seleccionada lleva pin aunque no esté a la vista (agrupada o fuera del encuadre)', () => {
    const ids = choosePins(['10', '11'], byId, '77');
    expect(ids).toEqual(['77', '11', '10']);
  });

  it('ignora ids que no existen y los repetidos', () => {
    expect(choosePins(['5', '5', 'x'], byId, null)).toEqual(['5']);
    expect(choosePins([], byId, null)).toEqual([]);
  });
});

describe('alturas de la hoja inferior', () => {
  it('en un móvil de 844 px la compacta mide 180, la intermedia 404 y la expandida deja libre la franja superior', () => {
    // Contenedor: 844 − cabecera 64 − navegación 72 = 708 px
    const h = sheetHeights(708, 124);
    expect(h.compact).toBe(180);
    expect(h.mid).toBeGreaterThan(300);
    expect(h.mid).toBeLessThanOrEqual(440);
    expect(h.full).toBe(708 - 124);
    expect(h.compact).toBeLessThan(h.mid);
    expect(h.mid).toBeLessThan(h.full);
  });

  it('siempre hay tres alturas distintas y crecientes, también en pantallas bajas', () => {
    for (const container of [320, 400, 500, 708, 900]) {
      const h = sheetHeights(container, 124);
      expect(h.compact).toBeLessThan(h.mid);
      expect(h.mid).toBeLessThan(h.full);
    }
  });
});

describe('nearestSnap (al soltar el arrastre)', () => {
  const heights = { compact: 180, mid: 404, full: 584 };

  it('un gesto lento se queda en la altura más cercana', () => {
    expect(nearestSnap(200, heights, 0.1)).toBe('compact');
    expect(nearestSnap(330, heights, -0.2)).toBe('mid');
    expect(nearestSnap(500, heights, 0.3)).toBe('full');
  });

  it('un gesto rápido salta a la siguiente altura en su dirección', () => {
    expect(nearestSnap(250, heights, 1.2)).toBe('mid'); // hacia arriba, desde casi compacta
    expect(nearestSnap(420, heights, 1.2)).toBe('full');
    expect(nearestSnap(404, heights, -1.2)).toBe('compact'); // hacia abajo desde la intermedia
    expect(nearestSnap(500, heights, -1.2)).toBe('mid');
  });

  it('no pasa de los extremos', () => {
    expect(nearestSnap(584, heights, 2)).toBe('full');
    expect(nearestSnap(180, heights, -2)).toBe('compact');
  });
});
