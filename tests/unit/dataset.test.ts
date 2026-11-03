import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { FUELS } from '../../src/lib/data-schema';
import { buildDataset, sha, type RawResponse } from '../../scripts/build-dataset';
import { checkStationDrop, validateDataset } from '../../scripts/validate';

const fixture = JSON.parse(
  readFileSync(
    resolve(import.meta.dirname, '../../fixtures/estaciones-terrestres.sample.json'),
    'utf8',
  ),
) as RawResponse;
const NOW = new Date('2026-10-28T16:00:00Z');

describe('buildDataset con la muestra real (fixtures)', () => {
  const { dataset, report } = buildDataset(fixture, { demo: true, now: NOW });

  it('genera los cuatro ficheros coherentes', () => {
    expect(dataset.meta.demo).toBe(true);
    expect(dataset.meta.stationCount).toBe(dataset.stations.stations.length);
    expect(dataset.meta.stationsFile).toMatch(/^stations\.[0-9a-f]{10}\.json$/);
    expect(Object.keys(dataset.prices.p)).toHaveLength(dataset.meta.stationCount);
    expect(dataset.stations.fuels).toEqual([...FUELS]);
    expect(dataset.meta.sourceDate).toBe('2026-10-28T15:39:26.000Z');
  });

  it('no publica municipio ni provincia en las estaciones: sus nombres están en el índice', () => {
    const first = dataset.stations.stations[0];
    expect(first).toBeDefined();
    expect(first).not.toHaveProperty('m');
    expect(first).not.toHaveProperty('p');
    const { provinces, municipalities } = dataset.searchIndex;
    for (const s of dataset.stations.stations) {
      expect(provinces.some((p) => p.id === s.pid)).toBe(true);
      expect(municipalities.some((m) => m.id === s.mid)).toBe(true);
    }
  });

  it('descarta y registra las 5 coordenadas defectuosas de la Fase 0', () => {
    const bad = report.dropped.filter((d) =>
      ['coordenadasACero', 'coordenadasIntercambiadas', 'fueraDeEspana'].includes(d.reason),
    );
    expect(bad.map((d) => d.id).sort()).toEqual(['11988', '12883', '16268', '16499', '2115']);
    expect(report.dropsByReason.coordenadasIntercambiadas).toBe(1);
    expect(report.dropsByReason.coordenadasACero).toBe(4);
  });

  it('descarta las estaciones sin combustibles del MVP y no deja filas vacías', () => {
    expect(report.dropsByReason.sinCombustibleMvp).toBeGreaterThan(0);
    for (const row of Object.values(dataset.prices.p)) {
      expect(row.some((v) => v !== null)).toBe(true);
    }
  });

  it('conserva rótulos y direcciones largos de los datos reales', () => {
    const stations = dataset.stations.stations;
    expect(Math.max(...stations.map((s) => s.n.length))).toBeGreaterThanOrEqual(40);
    expect(Math.max(...stations.map((s) => s.a.length))).toBeGreaterThanOrEqual(60);
  });

  it('el hash de precios cambia si cambia un precio, y el de estaciones no', () => {
    const changed = structuredClone(fixture);
    // Una estación que sí se conserva (las descartadas no afectan al hash).
    const keptId = dataset.stations.stations.find((s) => dataset.prices.p[s.id]?.[2] != null)?.id;
    const first = changed.ListaEESSPrecio.find((s) => s['IDEESS'] === keptId);
    if (!first) throw new Error('La muestra no tiene una estación conservada con gasóleo A');
    first['Precio Gasoleo A'] = '2,222';
    const other = buildDataset(changed, { demo: true, now: NOW }).dataset;
    expect(other.meta.priceHash).not.toBe(dataset.meta.priceHash);
    expect(other.meta.stationsFile).toBe(dataset.meta.stationsFile);
  });

  it('el hash de precios no depende de la hora de la consulta', () => {
    const later = { ...fixture, Fecha: '28/10/2026 23:59:59' };
    const other = buildDataset(later, { demo: true, now: NOW }).dataset;
    expect(other.meta.sourceDate).not.toBe(dataset.meta.sourceDate);
    expect(other.meta.priceHash).toBe(dataset.meta.priceHash);
  });

  it('indexa provincias, municipios y códigos postales con centroide', () => {
    const index = dataset.searchIndex;
    const malaga = index.provinces.find((p) => p.name === 'Málaga');
    expect(malaga?.count).toBeGreaterThan(30);
    expect(malaga?.bbox[0]).toBeLessThan(malaga?.lat ?? 0);
    expect(index.postalCodes.every((c) => /^\d{5}$/.test(c.code))).toBe(true);
    expect(index.provinces.some((p) => p.name === 'Las Palmas')).toBe(true);
  });
});

describe('validación', () => {
  it('rechaza una respuesta con ResultadoConsulta distinto de OK', () => {
    expect(() =>
      buildDataset({ ...fixture, ResultadoConsulta: 'ERROR' }, { demo: true }),
    ).toThrow();
  });

  it('detecta incoherencias entre ficheros', () => {
    const { dataset } = buildDataset(fixture, { demo: true, now: NOW });
    const broken = structuredClone(dataset);
    broken.meta.stationCount += 1;
    expect(() => validateDataset(broken)).toThrow(/stationCount/);

    const noPrices = structuredClone(dataset);
    const firstId = noPrices.stations.stations[0]?.id ?? '';
    delete noPrices.prices.p[firstId];
    expect(() => validateDataset(noPrices)).toThrow(/no tiene fila de precios/);
  });

  it('aborta si las estaciones caen más del 20 %', () => {
    expect(checkStationDrop(10000, 7900).ok).toBe(false);
    expect(checkStationDrop(10000, 8000).ok).toBe(true);
    expect(checkStationDrop(11434, 11417).ok).toBe(true);
    expect(checkStationDrop(null, 5).ok).toBe(true);
  });

  it('sha es estable', () => {
    expect(sha('a', 8)).toBe(sha('a', 8));
    expect(sha('a', 8)).not.toBe(sha('b', 8));
  });
});
