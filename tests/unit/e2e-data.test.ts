import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildDataset, type RawResponse } from '../../scripts/build-dataset';
import { amplifyFixture } from '../../scripts/e2e-data';

const fixture = JSON.parse(
  readFileSync(
    resolve(import.meta.dirname, '../../fixtures/estaciones-terrestres.sample.json'),
    'utf8',
  ),
) as RawResponse;
const NOW = new Date('2026-10-28T16:00:00Z');

describe('datos de prueba de los e2e', () => {
  const amplified = amplifyFixture(fixture);
  const { dataset } = buildDataset(amplified, { demo: true, now: NOW });

  it('multiplica Málaga y Albacete y deja el resto como en la muestra', () => {
    const count = (raw: RawResponse, province: string) =>
      raw.ListaEESSPrecio.filter((s) => String(s['Provincia']).toUpperCase() === province).length;
    expect(count(amplified, 'MÁLAGA')).toBe(count(fixture, 'MÁLAGA') * 6);
    expect(count(amplified, 'ALBACETE')).toBe(count(fixture, 'ALBACETE') * 4);
    expect(count(amplified, 'MADRID')).toBe(count(fixture, 'MADRID'));
  });

  it('da más de 200 estaciones con gasolina 95 en la provincia de Málaga', () => {
    const malaga = dataset.searchIndex.provinces.find((p) => p.name === 'Málaga');
    const ids = new Set(
      dataset.stations.stations.filter((s) => s.pid === malaga?.id).map((s) => s.id),
    );
    const selling = [...ids].filter((id) => dataset.prices.p[id]?.[0] != null);
    expect(selling.length).toBeGreaterThan(200);
  });

  it('es válido, sin ids repetidos y determinista', () => {
    const ids = dataset.stations.stations.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    const again = buildDataset(amplifyFixture(fixture), { demo: true, now: NOW }).dataset;
    expect(again.meta.stationsFile).toBe(dataset.meta.stationsFile);
    expect(again.meta.priceHash).toBe(dataset.meta.priceHash);
  });

  it('hay marcas suficientes para el filtro con «Otras»', () => {
    const counts = new Map<string, number>();
    for (const s of dataset.stations.stations) counts.set(s.b, (counts.get(s.b) ?? 0) + 1);
    expect([...counts.values()].filter((n) => n >= 40).length).toBeGreaterThanOrEqual(2);
  });
});
