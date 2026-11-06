import { describe, expect, it } from 'vitest';
import { buildBrandGroups } from '../../src/lib/brands';
import {
  areaFromView,
  searchedRegion,
  shouldOfferAreaSearch,
  viewCenter,
  viewWidthKm,
  type ViewRect,
} from '../../src/lib/areas';
import { distanceOrigin, hasOrigin, usesRadius, type Place } from '../../src/lib/place';
import { buildResultSet } from '../../src/lib/resultset';
import type { Station } from '../../src/lib/data-schema';
import { buildUrlSearch, parseUrlState, placeRef } from '../../src/lib/urlstate';

/** Rectángulo de ~`km` km de lado centrado en (lat, lng). */
function around(lat: number, lng: number, km: number): ViewRect {
  const dLat = km / 2 / 111.2;
  const dLng = km / 2 / (111.2 * Math.cos((lat * Math.PI) / 180));
  return { north: lat + dLat, south: lat - dLat, east: lng + dLng, west: lng - dLng };
}

describe('areaFromView', () => {
  it('toma el centro del mapa y la mitad del lado mayor como radio, en km enteros', () => {
    const area = areaFromView(around(36.72, -4.42, 10));
    expect(area.lat).toBeCloseTo(36.72, 4);
    expect(area.lng).toBeCloseTo(-4.42, 4);
    expect(area.radiusKm).toBe(5);
    expect(area.limited).toBe(false);
  });
  it('redondea hacia arriba y no baja de 1 km', () => {
    expect(areaFromView(around(40, -3, 7.2)).radiusKm).toBe(4);
    expect(areaFromView(around(40, -3, 0.4)).radiusKm).toBe(1);
  });
  it('se limita al máximo del deslizador (50 km) y lo indica', () => {
    const area = areaFromView(around(40, -3, 300));
    expect(area.radiusKm).toBe(50);
    expect(area.limited).toBe(true);
  });
  it('mide el lado mayor aunque la vista sea alta y estrecha (móvil)', () => {
    const tall: ViewRect = { north: 40.1, south: 39.9, east: -2.98, west: -3.02 };
    expect(areaFromView(tall).radiusKm).toBeGreaterThan(10);
  });
});

describe('shouldOfferAreaSearch', () => {
  const region = { lat: 36.72, lng: -4.42, radiusKm: 5 };
  const inRegion = [{ lat: 36.73, lng: -4.43 }];

  it('no se ofrece si el centro sigue dentro del área buscada', () => {
    expect(shouldOfferAreaSearch(around(36.72, -4.42, 8), region, inRegion)).toBe(false);
    expect(shouldOfferAreaSearch(around(36.745, -4.42, 8), region, inRegion)).toBe(false);
  });
  it('no se ofrece con el centro algo fuera pero dentro del margen del 25 % del ancho visible', () => {
    // Centro a ~6 km del centro (1 km fuera del radio); el 25 % de 10 km son 2,5 km
    const view = around(36.774, -4.42, 10);
    expect(shouldOfferAreaSearch(view, region, [{ lat: 36.774, lng: -4.42 }])).toBe(false);
  });
  it('se ofrece si el centro queda a más del 25 % del ancho fuera del área', () => {
    const view = around(36.85, -4.42, 8);
    expect(shouldOfferAreaSearch(view, region, [{ lat: 36.85, lng: -4.42 }])).toBe(true);
  });
  it('se ofrece si lo visible ya no contiene ningún resultado, aunque el centro esté dentro', () => {
    const view = around(36.72, -4.42, 0.6);
    expect(shouldOfferAreaSearch(view, region, [{ lat: 36.75, lng: -4.45 }])).toBe(true);
  });
  it('sin resultados solo cuenta la posición del centro', () => {
    expect(shouldOfferAreaSearch(around(36.72, -4.42, 4), region, [])).toBe(false);
    expect(shouldOfferAreaSearch(around(37.5, -4.42, 4), region, [])).toBe(true);
  });
  it('el ancho y el centro de la vista se calculan en kilómetros reales', () => {
    const view = around(36.72, -4.42, 10);
    expect(viewWidthKm(view)).toBeCloseTo(10, 1);
    expect(viewCenter(view).lat).toBeCloseTo(36.72, 5);
  });
});

describe('searchedRegion', () => {
  it('con radio es el círculo de la búsqueda', () => {
    const place: Place = { kind: 'postal', label: '29001', code: '29001', lat: 36.7, lng: -4.4 };
    expect(searchedRegion(place, 8, [])).toEqual({ lat: 36.7, lng: -4.4, radiusKm: 8 });
  });
  it('sin radio (municipio) es el círculo que contiene a todos los resultados', () => {
    const place: Place = { kind: 'municipality', label: 'X', lat: 0, lng: 0, id: 1, pid: 1 };
    const region = searchedRegion(place, 5, [
      { lat: 36.7, lng: -4.4 },
      { lat: 36.8, lng: -4.4 },
    ]);
    expect(region.lat).toBeCloseTo(36.75, 3);
    expect(region.radiusKm).toBeGreaterThan(5);
    expect(region.radiusKm).toBeLessThan(6.5);
  });
});

describe('zona del mapa en los resultados', () => {
  const stations: Station[] = Array.from({ length: 6 }, (_, i) => ({
    id: String(i + 1),
    b: 'repsol',
    n: `E.S. ${i + 1}`,
    a: 'CALLE X',
    z: '29001',
    pid: 29,
    mid: 4800,
    lat: 36.7 + i * 0.009,
    lng: -4.4,
    h: '',
    s: 'P',
  }));
  const prices = Object.fromEntries(
    stations.map((s, i) => [s.id, [1500 - i * 10, null, null, null, null, null]]),
  );
  const brandGroups = buildBrandGroups(
    stations.map((s) => ({ b: s.b })),
    1,
  );
  const base = {
    stations,
    prices,
    fuel: 'g95e5' as const,
    brands: [] as string[],
    sort: 'distance' as const,
    brandGroups,
  };
  const center: Place = { kind: 'area', label: 'Zona del mapa', lat: 36.7, lng: -4.4 };
  const user = { lat: 36.745, lng: -4.4 };

  it('es una búsqueda por radio con distancia', () => {
    expect(usesRadius(center)).toBe(true);
    expect(hasOrigin(center)).toBe(true);
  });
  it('el radio se mide desde el centro de la zona y la distancia, desde él si no hay ubicación', () => {
    const result = buildResultSet({ ...base, place: center, radiusKm: 3.5 });
    // 0,009° ≈ 1 km: entran las estaciones a ≤ 3 km del centro (las 4 primeras; la 4.ª a 3,0 km)
    expect(result.items.map((i) => i.station.id)).toEqual(['1', '2', '3', '4']);
    expect(result.items[0]?.distanceKm).toBeCloseTo(0, 1);
  });
  it('con la ubicación del usuario, las distancias se miden desde ella y el radio no cambia', () => {
    const place: Place = { ...center, origin: user };
    expect(distanceOrigin(place)).toEqual(user);
    const result = buildResultSet({ ...base, place, radiusKm: 3.5 });
    expect(result.items.map((i) => i.station.id).sort()).toEqual(['1', '2', '3', '4']);
    // La estación 5 está más cerca del usuario, pero fuera del radio de 3,5 km del centro
    expect(result.items[0]?.station.id).toBe('4');
    expect(result.items[0]?.distanceKm).toBeCloseTo(2, 0);
  });
  it('se mantienen combustible, orden y filtro de marcas', () => {
    const byPrice = buildResultSet({ ...base, place: center, radiusKm: 6, sort: 'price' });
    expect(byPrice.items[0]?.station.id).toBe('6');
    const filtered = buildResultSet({ ...base, place: center, radiusKm: 6, brands: ['shell'] });
    expect(filtered.visible).toHaveLength(0);
    expect(filtered.items.length).toBeGreaterThan(0);
  });
});

describe('zona del mapa en la URL', () => {
  const area: Place = { kind: 'area', label: 'Zona del mapa', lat: 36.72134, lng: -4.42141 };
  it('se escribe con 4 decimales (≈ 11 m), con el radio y sin zoom', () => {
    expect(placeRef(area)).toEqual({ kind: 'area', lat: 36.7213, lng: -4.4214 });
    const search = buildUrlSearch({ place: area, fuel: 'g95e5', radiusKm: 12, sort: 'price' });
    expect(search).toBe('?q=a36.7213_-4.4214&fuel=g95e5&r=12');
    expect(search).not.toMatch(/zoom|z=/);
  });
  it('se restaura', () => {
    const state = parseUrlState('?q=a36.7213_-4.4214&fuel=g95e5&r=12&sort=distance');
    expect(state.place).toEqual({ kind: 'area', lat: 36.7213, lng: -4.4214 });
    expect(state.radiusKm).toBe(12);
    expect(state.sort).toBe('distance');
  });
  it('NUNCA se escribe si la búsqueda usó la ubicación del usuario', () => {
    const withUser: Place = { ...area, origin: { lat: 36.72, lng: -4.42 } };
    expect(placeRef(withUser)).toBeNull();
    expect(buildUrlSearch({ place: withUser, fuel: 'g95e5', radiusKm: 12, sort: 'price' })).toBe(
      '',
    );
  });
  it('rechaza coordenadas inválidas o con formato raro', () => {
    for (const q of ['a91_0', 'a10_181', 'a1.123456_2', 'a10_', 'b10_10', 'a10;_5']) {
      expect(parseUrlState(`?q=${q}`).place, q).toBeUndefined();
    }
  });
});
