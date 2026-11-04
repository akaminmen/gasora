import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildDataset, type RawResponse } from '../../scripts/build-dataset';
import { loadData } from '../../src/lib/data';

const fixture = JSON.parse(
  readFileSync(
    resolve(import.meta.dirname, '../../fixtures/estaciones-terrestres.sample.json'),
    'utf8',
  ),
) as RawResponse;
const { dataset } = buildDataset(fixture, { demo: true, now: new Date('2026-10-28T16:00:00Z') });
const STATIONS = dataset.meta.stationsFile;

/** fetch simulado: registra el orden de las peticiones y responde con el conjunto de datos. */
function mockFetch(options: { missing?: string[] } = {}) {
  const calls: string[] = [];
  const settled: string[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: string) => {
      const file = input.split('/data/')[1] ?? '';
      calls.push(file);
      await Promise.resolve();
      settled.push(file);
      if (options.missing?.includes(file)) return new Response('no existe', { status: 404 });
      const body =
        file === 'meta.json'
          ? dataset.meta
          : file === 'prices.json'
            ? dataset.prices
            : file === STATIONS
              ? dataset.stations
              : null;
      return body
        ? new Response(JSON.stringify(body), { status: 200 })
        : new Response('no existe', { status: 404 });
    }),
  );
  return { calls, settled };
}

beforeEach(() => {
  vi.stubGlobal('caches', undefined);
});
afterEach(() => {
  vi.unstubAllGlobals();
});

describe('loadData con el nombre del fichero de estaciones en el HTML', () => {
  it('pide meta, precios y estaciones a la vez, sin esperar a meta.json', async () => {
    const { calls } = mockFetch();
    const data = await loadData(STATIONS);
    // Las tres peticiones salen antes de que se resuelva ninguna
    expect(calls.slice(0, 3).sort()).toEqual(['meta.json', 'prices.json', STATIONS].sort());
    // El fichero de estaciones se pide una sola vez
    expect(calls.filter((c) => c === STATIONS)).toHaveLength(1);
    expect(data.meta.stationsFile).toBe(STATIONS);
    expect(data.stations.stations.length).toBe(dataset.stations.stations.length);
    expect(data.fromCache).toBe(false);
  });

  it('con un nombre viejo (404) vuelve al camino normal y descarga el vigente', async () => {
    const stale = 'stations.0000000000.json';
    const { calls } = mockFetch({ missing: [stale] });
    const data = await loadData(stale);
    expect(calls).toContain(stale);
    expect(calls.filter((c) => c === STATIONS)).toHaveLength(1);
    expect(data.stations.stations.length).toBe(dataset.stations.stations.length);
  });

  it('con un nombre viejo que aún existe en el servidor, usa siempre el vigente de meta.json', async () => {
    const stale = 'stations.1111111111.json';
    const old = { ...dataset.stations, stations: dataset.stations.stations.slice(0, 1) };
    const { calls } = mockFetch();
    const base = vi.mocked(fetch).getMockImplementation()!;
    vi.mocked(fetch).mockImplementation(async (input, init) =>
      String(input).endsWith(stale)
        ? new Response(JSON.stringify(old), { status: 200 })
        : base(input, init),
    );
    const data = await loadData(stale);
    expect(calls).toContain(STATIONS);
    expect(data.stations.stations.length).toBe(dataset.stations.stations.length);
  });

  it('sin nombre en el HTML (build sin datos, desarrollo): meta primero, luego estaciones', async () => {
    const { calls } = mockFetch();
    await loadData(undefined);
    expect(calls[calls.length - 1]).toBe(STATIONS);
    expect(calls.indexOf('meta.json')).toBeLessThan(calls.indexOf(STATIONS));
  });
});
