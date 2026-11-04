import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildDataset, type RawResponse } from '../../scripts/build-dataset';
import { parsePricesLight, parseStationsLight, sampleIndexes } from '../../src/lib/data-schema';

const fixture = JSON.parse(
  readFileSync(
    resolve(import.meta.dirname, '../../fixtures/estaciones-terrestres.sample.json'),
    'utf8',
  ),
) as RawResponse;
const { dataset } = buildDataset(fixture, { demo: true, now: new Date('2026-10-28T16:00:00Z') });
const clone = <T>(value: T) => structuredClone(value);

describe('muestra de filas', () => {
  it('reparte los índices por todo el fichero, con el primero y el último', () => {
    const idx = sampleIndexes(11357, 40);
    expect(idx).toHaveLength(40);
    expect(idx[0]).toBe(0);
    expect(idx[39]).toBe(11356);
    expect(idx).toEqual([...idx].sort((a, b) => a - b));
    expect(sampleIndexes(5, 40)).toEqual([0, 1, 2, 3, 4]);
    expect(sampleIndexes(0)).toEqual([]);
  });
});

describe('validación ligera de estaciones y precios', () => {
  it('acepta los ficheros que genera la ingesta', () => {
    expect(parseStationsLight(dataset.stations).stations).toHaveLength(dataset.meta.stationCount);
    expect(parsePricesLight(dataset.prices).p).toBe(dataset.prices.p);
  });
  it('rechaza una cabecera estropeada (versión de esquema, combustibles, lista vacía)', () => {
    expect(() => parseStationsLight({ ...clone(dataset.stations), schema: 2 })).toThrow();
    expect(() => parseStationsLight({ ...clone(dataset.stations), fuels: ['x'] })).toThrow();
    expect(() => parseStationsLight({ ...clone(dataset.stations), stations: [] })).toThrow();
    expect(() => parseStationsLight(null)).toThrow();
    expect(() => parsePricesLight({ updatedAt: 'ayer', p: {} })).toThrow();
    expect(() => parsePricesLight('texto')).toThrow();
  });
  it('rechaza filas estropeadas en la muestra (primera, última…)', () => {
    const first = clone(dataset.stations);
    (first.stations[0] as unknown as Record<string, unknown>)['lat'] = 'norte';
    expect(() => parseStationsLight(first)).toThrow();
    const last = clone(dataset.stations);
    last.stations[last.stations.length - 1] = { id: 5 } as never;
    expect(() => parseStationsLight(last)).toThrow();
    const prices = clone(dataset.prices);
    const ids = Object.keys(prices.p);
    prices.p[ids[0] as string] = [1, 2, 3] as never;
    expect(() => parsePricesLight(prices)).toThrow();
  });
});
