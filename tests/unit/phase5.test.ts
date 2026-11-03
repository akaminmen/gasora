import { describe, expect, it } from 'vitest';
import { calcSaving } from '../../src/lib/calc';
import type { Place } from '../../src/lib/place';
import type { ResultItem } from '../../src/lib/resultset';
import { buildUrlSearch, parseUrlState } from '../../src/lib/urlstate';
import { sellableFuel } from '../../src/lib/zone';
import { MAX_FAVORITES, parseFavorites } from '../../src/stores/favorites';
import { parseLiters } from '../../src/stores/search';

describe('favoritos guardados (gasora:favorites:v1)', () => {
  it('lee un array de IDEESS', () => {
    expect(parseFavorites('["4375","10943"]')).toEqual(['4375', '10943']);
  });
  it('ignora lo que no sea un array de identificadores y los repetidos', () => {
    expect(parseFavorites(null)).toEqual([]);
    expect(parseFavorites('')).toEqual([]);
    expect(parseFavorites('no es json')).toEqual([]);
    expect(parseFavorites('{"a":1}')).toEqual([]);
    expect(parseFavorites('["1",2,null,"x","<b>","3","1"]')).toEqual(['1', '3']);
  });
  it('limita la cantidad', () => {
    const many = JSON.stringify(
      Array.from({ length: MAX_FAVORITES + 20 }, (_, i) => String(i + 1)),
    );
    expect(parseFavorites(many)).toHaveLength(MAX_FAVORITES);
  });
});

describe('litros del depósito (gasora:liters:v1)', () => {
  it('acepta de 1 a 120 y si no, 50', () => {
    expect(parseLiters('35')).toBe(35);
    expect(parseLiters('1')).toBe(1);
    expect(parseLiters('120')).toBe(120);
    for (const bad of [null, '', '0', '121', '-5', '12,5', 'abc'])
      expect(parseLiters(bad)).toBe(50);
  });
});

describe('URL compartible', () => {
  const postal: Place = { kind: 'postal', label: 'CP 29002', code: '29002', lat: 36.7, lng: -4.4 };
  const muni: Place = {
    kind: 'municipality',
    label: 'Málaga',
    id: 4800,
    pid: 29,
    lat: 36.7,
    lng: -4.4,
  };
  const base = { fuel: 'g95e5' as const, radiusKm: 5, sort: 'price' as const };

  it('un código postal con combustible y radio', () => {
    expect(buildUrlSearch({ ...base, place: postal })).toBe('?q=29002&fuel=g95e5&r=5');
    expect(
      buildUrlSearch({ ...base, place: postal, fuel: 'goa', radiusKm: 12, sort: 'distance' }),
    ).toBe('?q=29002&fuel=goa&r=12&sort=distance');
  });
  it('un municipio (sin radio) y ampliado (con radio)', () => {
    expect(buildUrlSearch({ ...base, place: muni })).toBe('?q=m4800&fuel=g95e5');
    expect(buildUrlSearch({ ...base, place: { ...muni, expanded: true }, radiusKm: 10 })).toBe(
      '?q=m4800&fuel=g95e5&r=10&x=1',
    );
  });
  it('una provincia', () => {
    const province: Place = { kind: 'province', label: 'Málaga', id: 29, lat: 0, lng: 0 };
    expect(buildUrlSearch({ ...base, place: province })).toBe('?q=p29&fuel=g95e5');
  });
  it('la ubicación del usuario no se escribe nunca en la URL', () => {
    const here: Place = { kind: 'location', label: 'Tu ubicación', lat: 36.7213, lng: -4.4214 };
    expect(buildUrlSearch({ ...base, place: here })).toBe('');
    expect(buildUrlSearch({ ...base, place: null })).toBe('');
  });
  it('lo que se escribe se lee igual', () => {
    const search = buildUrlSearch({
      ...base,
      place: postal,
      fuel: 'goap',
      radiusKm: 20,
      sort: 'distance',
    });
    expect(parseUrlState(search)).toEqual({
      place: { kind: 'postal', code: '29002' },
      fuel: 'goap',
      radiusKm: 20,
      sort: 'distance',
    });
    expect(parseUrlState('?q=m4800&x=1&r=10')).toEqual({
      place: { kind: 'municipality', id: 4800 },
      radiusKm: 10,
      expanded: true,
    });
    expect(parseUrlState('?q=p29').place).toEqual({ kind: 'province', id: 29 });
  });
  it('ignora valores inválidos o fuera de rango', () => {
    expect(parseUrlState('?q=1234&fuel=xx&r=999&sort=raro&x=2')).toEqual({});
    expect(parseUrlState('?q=m&r=0')).toEqual({});
    expect(parseUrlState('?r=2.5')).toEqual({});
    expect(parseUrlState('')).toEqual({});
    expect(parseUrlState('?q=<script>')).toEqual({});
  });
});

function item(id: string, price: number, distanceKm?: number): ResultItem {
  return {
    station: {
      id,
      b: 'repsol',
      n: `E.S. ${id}`,
      a: '',
      z: '',
      pid: 1,
      mid: 1,
      lat: 0,
      lng: 0,
      h: '',
      s: 'P',
    },
    price,
    tier: 'mid',
    best: false,
    saving: 0,
    brandGroup: 'repsol',
    ...(distanceKm !== undefined ? { distanceKm } : {}),
  };
}

describe('calculadora de ahorro', () => {
  const items = [
    item('a', 1359, 0.9),
    item('b', 1419, 0.6),
    item('c', 1459, 0.4),
    item('d', 1529, 0.7),
  ];
  const mean = (1359 + 1419 + 1459 + 1529) / 4; // 1441,5

  it('frente a la media: (media − más barata) × litros', () => {
    const r = calcSaving(items, 'avg', 50, mean);
    expect(r?.best.station.id).toBe('a');
    expect(r?.reference.label).toBe('la media de la zona');
    expect(r?.saving).toBe(4.13); // (1441,5 − 1359) / 1000 × 50 = 4,125 → 4,13
    expect(calcSaving(items, 'avg', 30, mean)?.saving).toBe(2.48);
  });
  it('frente a la más cercana: la de menor distancia', () => {
    const r = calcSaving(items, 'near', 50, mean);
    expect(r?.nearest?.station.id).toBe('c');
    expect(r?.reference.price).toBe(1459);
    expect(r?.saving).toBe(5);
  });
  it('si la más barata es la más cercana, no ahorra (0, nunca negativo)', () => {
    const r = calcSaving([item('a', 1359, 0.1), item('b', 1419, 0.9)], 'near', 50, 1389);
    expect(r?.saving).toBe(0);
  });
  it('sin distancias no hay comparación con la más cercana; sin estaciones, nada', () => {
    expect(calcSaving([item('a', 1359), item('b', 1419)], 'near', 50, 1389)).toBeNull();
    expect(calcSaving([item('a', 1359), item('b', 1419)], 'avg', 50, 1389)?.saving).toBe(1.5);
    expect(calcSaving([], 'avg', 50, 0)).toBeNull();
  });
  it('en un empate de precio, gana la más cercana', () => {
    const r = calcSaving(
      [item('a', 1400, 3), item('b', 1400, 1), item('c', 1500, 2)],
      'avg',
      50,
      1433,
    );
    expect(r?.best.station.id).toBe('b');
  });
});

describe('combustible que vende una estación', () => {
  const prices = {
    '1': [1459, null, 1399, null, null, null],
    '2': [null, null, null, null, 900, null],
  };
  it('el preferido si lo vende; si no, el primero que venda; si no vende nada, null', () => {
    expect(sellableFuel(prices, '1', 'goa')).toBe('goa');
    expect(sellableFuel(prices, '2', 'g95e5')).toBe('glp');
    expect(sellableFuel(prices, '3', 'g95e5')).toBeNull();
    expect(sellableFuel({ '4': [null, null, null, null, null, null] }, '4', 'g95e5')).toBeNull();
  });
});
