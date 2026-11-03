import { describe, expect, it } from 'vitest';
import { OTHER_BRAND, buildBrandGroups } from '../../src/lib/brands';
import type { PricesFile, SearchIndex, Station } from '../../src/lib/data-schema';
import type { Place } from '../../src/lib/place';
import { buildResultSet } from '../../src/lib/resultset';
import { createSearcher } from '../../src/lib/search-index';

const index: SearchIndex = {
  schema: 1,
  provinces: [
    { id: 29, name: 'Málaga', lat: 36.7, lng: -4.4, bbox: [36, -5, 37, -4], count: 300 },
    { id: 28, name: 'Madrid', lat: 40.4, lng: -3.7, bbox: [40, -4, 41, -3], count: 900 },
    { id: 15, name: 'A Coruña', lat: 43.3, lng: -8.4, bbox: [43, -9, 44, -8], count: 150 },
  ],
  municipalities: [
    {
      id: 4800,
      name: 'Málaga',
      pid: 29,
      lat: 36.72,
      lng: -4.42,
      bbox: [36, -5, 37, -4],
      count: 120,
    },
    {
      id: 4801,
      name: 'Torremolinos',
      pid: 29,
      lat: 36.62,
      lng: -4.5,
      bbox: [36, -5, 37, -4],
      count: 20,
    },
    {
      id: 2800,
      name: 'Las Rozas de Madrid',
      pid: 28,
      lat: 40.49,
      lng: -3.87,
      bbox: [40, -4, 41, -3],
      count: 25,
    },
    {
      id: 1500,
      name: 'A Coruña',
      pid: 15,
      lat: 43.36,
      lng: -8.41,
      bbox: [43, -9, 44, -8],
      count: 40,
    },
  ],
  postalCodes: [
    { code: '29002', lat: 36.7, lng: -4.45, count: 10 },
    { code: '29001', lat: 36.71, lng: -4.43, count: 14 },
    { code: '28001', lat: 40.42, lng: -3.69, count: 8 },
  ],
};
const searcher = createSearcher(index);
const texts = (query: string) => searcher.suggest(query).map((s) => `${s.group}:${s.text}`);

describe('buscador (índice en memoria)', () => {
  it('«290» sugiere códigos postales, el de más gasolineras primero', () => {
    expect(texts('290')).toEqual(['CP:29001', 'CP:29002']);
  });
  it('«malag» sugiere provincia y municipio, sin importar tildes ni mayúsculas', () => {
    expect(texts('malag')).toEqual(['Provincia:Málaga', 'Municipio:Málaga']);
    expect(texts('MÁLAG')).toEqual(texts('malag'));
    expect(texts('Malaga')).toEqual(texts('malag'));
  });
  it('encuentra por inicio de palabra y por contenido, en ese orden', () => {
    expect(texts('rozas')).toEqual(['Municipio:Las Rozas de Madrid']);
    expect(texts('coru')).toEqual(['Provincia:A Coruña', 'Municipio:A Coruña']);
    expect(texts('lag')).toEqual(['Provincia:Málaga', 'Municipio:Málaga']);
  });
  it('el municipio indica su provincia y todo lleva el nº de gasolineras', () => {
    const [muni] = searcher.suggest('torre');
    expect(muni).toMatchObject({ detail: 'Málaga', count: 20, group: 'Municipio' });
  });
  it('devuelve el lugar listo para buscar', () => {
    const cp = searcher.suggest('29002')[0];
    expect(cp?.place).toEqual({
      kind: 'postal',
      label: 'CP 29002',
      code: '29002',
      lat: 36.7,
      lng: -4.45,
    });
  });
  it('sin texto, con una sola letra o sin coincidencias no sugiere nada', () => {
    expect(texts('')).toEqual([]);
    expect(texts('   ')).toEqual([]);
    expect(texts('m')).toEqual([]);
    expect(texts('zzzz')).toEqual([]);
    expect(texts('99999')).toEqual([]);
  });
});

// 10 estaciones en línea alrededor de (36.7, -4.4), a unos 1 km una de otra.
const stations: Station[] = Array.from({ length: 10 }, (_, i) => ({
  id: String(i + 1),
  b: i < 6 ? 'repsol' : i < 8 ? 'shell' : OTHER_BRAND,
  n: i < 8 ? `E.S. ${i + 1}` : `ROTULO REAL ${i + 1}`,
  a: 'CALLE X',
  z: '29001',
  pid: 29,
  mid: i < 7 ? 4800 : 4801,
  lat: 36.7 + i * 0.009,
  lng: -4.4,
  h: '',
  s: 'P',
}));
const prices: PricesFile['p'] = Object.fromEntries(
  stations.map((s, i) => [
    s.id,
    // g95e5: 1500 − i·10 (la última, la más barata); g98e5 solo las 3 primeras; nada más
    [1500 - i * 10, i < 3 ? 1700 : null, null, null, null, null],
  ]),
);
// Umbral 15 con 5 copias de cada estación: repsol 30, shell 10 (→ otras) y otras 10
const brandGroups = buildBrandGroups(
  [...stations, ...stations, ...stations, ...stations, ...stations].map((s) => ({ b: s.b })),
  15,
);
const base = {
  stations,
  prices,
  fuel: 'g95e5' as const,
  radiusKm: 5,
  brands: [] as string[],
  sort: 'price' as const,
  brandGroups,
};
const here: Place = { kind: 'location', label: 'Tu ubicación', lat: 36.7, lng: -4.4 };

describe('buildResultSet', () => {
  it('por ubicación: solo las del radio, con distancia y orden por precio', () => {
    const result = buildResultSet({ ...base, place: here, radiusKm: 5 });
    // i · 0,009° ≈ 1 km: entran las 5 primeras (la sexta queda a 5,004 km)
    expect(result.items.map((i) => i.station.id)).toEqual(['5', '4', '3', '2', '1']);
    expect(result.items[0]?.price).toBe(1460);
    expect(result.items.every((i) => i.distanceKm !== undefined)).toBe(true);
  });
  it('por distancia, la más cercana primero', () => {
    const result = buildResultSet({ ...base, place: here, radiusKm: 5, sort: 'distance' });
    expect(result.items.map((i) => i.station.id)).toEqual(['1', '2', '3', '4', '5']);
  });
  it('solo cuentan las estaciones que venden el combustible elegido', () => {
    const result = buildResultSet({ ...base, place: here, radiusKm: 50, fuel: 'g98e5' });
    expect(result.items.map((i) => i.station.id).sort()).toEqual(['1', '2', '3']);
    expect(buildResultSet({ ...base, place: here, fuel: 'gnc' }).items).toEqual([]);
  });
  it('por municipio: las suyas, sin distancia; ampliado, por radio desde su centroide', () => {
    const muni: Place = {
      kind: 'municipality',
      label: 'Málaga',
      id: 4800,
      pid: 29,
      lat: 36.7,
      lng: -4.4,
    };
    const result = buildResultSet({ ...base, place: muni });
    expect(result.items).toHaveLength(7);
    expect(result.items.every((i) => i.distanceKm === undefined)).toBe(true);
    const wide = buildResultSet({ ...base, place: { ...muni, expanded: true }, radiusKm: 10 });
    expect(wide.items).toHaveLength(10);
  });
  it('por provincia: todas las de la provincia', () => {
    const province = (id: number): Place => ({
      kind: 'province',
      label: 'X',
      id,
      lat: 36.7,
      lng: -4.4,
    });
    expect(buildResultSet({ ...base, place: province(29) }).items).toHaveLength(10);
    expect(buildResultSet({ ...base, place: province(28) }).items).toEqual([]);
  });
  it('la más barata es el mínimo y lleva la marca; el ahorro es respecto a la media', () => {
    const result = buildResultSet({ ...base, place: here, radiusKm: 50 });
    const best = result.items.filter((i) => i.best);
    expect(best.map((i) => i.station.id)).toEqual(['10']);
    expect(result.stats?.mean).toBe(1455);
    expect(best[0]?.saving).toBe(Math.round(((1455 - 1410) / 1000) * 50 * 100) / 100);
    expect(result.items.at(-1)?.saving).toBeLessThan(0);
  });
  it('los empates en el mínimo son todos «más barata»', () => {
    const tied = { ...prices, '1': [1410, null, null, null, null, null] };
    const result = buildResultSet({ ...base, prices: tied, place: here, radiusKm: 50 });
    const ids = result.items.filter((i) => i.best).map((i) => i.station.id);
    expect(ids.sort()).toEqual(['1', '10']);
  });
  it('el filtro de marcas no cambia el ranking: se calcula sobre todo el conjunto', () => {
    const all = buildResultSet({ ...base, place: here, radiusKm: 50 });
    const some = buildResultSet({ ...base, place: here, radiusKm: 50, brands: [OTHER_BRAND] });
    expect(some.items).toHaveLength(10);
    expect(some.visible).toHaveLength(4);
    for (const item of some.visible) {
      const same = all.items.find((i) => i.station.id === item.station.id);
      expect(item.tier).toBe(same?.tier);
      expect(item.saving).toBe(same?.saving);
    }
    expect(some.stats).toEqual(all.stats);
  });
  it('agrupa las marcas pequeñas en «Otras» solo en el filtro; la tarjeta conserva el rótulo', () => {
    const result = buildResultSet({ ...base, place: here, radiusKm: 50 });
    expect(result.brands.map((b) => [b.key, b.label, b.count])).toEqual([
      ['repsol', 'Repsol', 6],
      [OTHER_BRAND, 'Otras', 4],
    ]);
    const others = buildResultSet({ ...base, place: here, radiusKm: 50, brands: [OTHER_BRAND] });
    expect(others.visible.map((i) => i.station.n).sort()).toEqual([
      'E.S. 7',
      'E.S. 8',
      'ROTULO REAL 10',
      'ROTULO REAL 9',
    ]);
    // La marca real (shell) no se pierde: solo el filtro la agrupa
    expect(others.visible.filter((i) => i.station.b === 'shell')).toHaveLength(2);
  });
});

describe('buildBrandGroups', () => {
  it('las marcas con pocas estaciones pasan a «otras»; las desconocidas ya lo son', () => {
    const list = [
      ...Array.from({ length: 50 }, () => ({ b: 'repsol' })),
      ...Array.from({ length: 39 }, () => ({ b: 'pcan' })),
      ...Array.from({ length: 80 }, () => ({ b: OTHER_BRAND })),
    ];
    const groups = buildBrandGroups(list);
    expect(groups.get('repsol')).toBe('repsol');
    expect(groups.get('pcan')).toBe(OTHER_BRAND);
    expect(groups.get(OTHER_BRAND)).toBe(OTHER_BRAND);
  });
});
