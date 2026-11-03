import { describe, expect, it } from 'vitest';
import { haversineKm } from '../../src/lib/geo';
import { priceStats, quantile, savingPerTank, tierOf } from '../../src/lib/pricing';

describe('haversineKm', () => {
  it('es 0 entre el mismo punto', () => {
    expect(haversineKm(40.4168, -3.7038, 40.4168, -3.7038)).toBe(0);
  });
  it('Madrid–Barcelona ronda los 505 km', () => {
    const km = haversineKm(40.4168, -3.7038, 41.3874, 2.1686);
    expect(km).toBeGreaterThan(500);
    expect(km).toBeLessThan(510);
  });
  it('un grado de latitud son unos 111 km y la distancia es simétrica', () => {
    expect(haversineKm(36, -4, 37, -4)).toBeCloseTo(111.2, 0);
    expect(haversineKm(36, -4, 37, -3)).toBeCloseTo(haversineKm(37, -3, 36, -4), 9);
  });
  it('funciona entre Canarias y la península', () => {
    const km = haversineKm(28.1235, -15.4363, 40.4168, -3.7038);
    expect(km).toBeGreaterThan(1700);
    expect(km).toBeLessThan(1800);
  });
});

describe('quantile', () => {
  it('interpola linealmente', () => {
    expect(quantile([1, 2, 3, 4, 5], 0)).toBe(1);
    expect(quantile([1, 2, 3, 4, 5], 0.5)).toBe(3);
    expect(quantile([1, 2, 3, 4, 5], 0.2)).toBe(1.8);
    expect(quantile([10, 20], 0.5)).toBe(15);
    expect(quantile([7], 0.85)).toBe(7);
  });
});

describe('tierOf', () => {
  const prices = Array.from({ length: 100 }, (_, i) => 1000 + i * 10); // 1000…1990
  const stats = priceStats(prices);
  if (!stats) throw new Error('sin estadísticas');

  it('reparte en cuatro tramos por cuantiles P20/P60/P85', () => {
    const count = { cheap: 0, mid: 0, high: 0, top: 0 };
    for (const price of prices) count[tierOf(price, stats)] += 1;
    expect(count).toEqual({ cheap: 20, mid: 40, high: 25, top: 15 });
    expect(tierOf(1000, stats)).toBe('cheap');
    expect(tierOf(1990, stats)).toBe('top');
  });

  it('el límite de cada cuantil pertenece al tramo inferior', () => {
    expect(tierOf(stats.p20, stats)).toBe('cheap');
    expect(tierOf(stats.p60, stats)).toBe('mid');
    expect(tierOf(stats.p85, stats)).toBe('high');
    expect(tierOf(stats.p85 + 1, stats)).toBe('top');
  });

  it('con menos de 5 resultados usa la escala mínimo–máximo', () => {
    const small = priceStats([1400, 1450, 1500, 1600]);
    if (!small) throw new Error('sin estadísticas');
    expect(tierOf(1400, small)).toBe('cheap');
    expect(tierOf(1450, small)).toBe('mid'); // t = 0,25
    expect(tierOf(1500, small)).toBe('mid'); // t = 0,5
    expect(tierOf(1560, small)).toBe('high'); // t = 0,8
    expect(tierOf(1600, small)).toBe('top');
  });

  it('si todos cuestan lo mismo, todos son baratos', () => {
    const same = priceStats([1500, 1500, 1500]);
    if (!same) throw new Error('sin estadísticas');
    expect(tierOf(1500, same)).toBe('cheap');
  });

  it('sin precios no hay estadísticas', () => {
    expect(priceStats([])).toBeNull();
  });
});

describe('savingPerTank', () => {
  it('es (media − precio) × litros, redondeado a céntimos', () => {
    expect(savingPerTank(1500, 1400, 50)).toBe(5);
    expect(savingPerTank(1500.4, 1459, 50)).toBe(2.07);
  });
  it('es negativo o cero si la estación no es más barata que la media', () => {
    expect(savingPerTank(1500, 1500, 50)).toBe(0);
    expect(savingPerTank(1500, 1600, 50)).toBe(-5);
  });
});
