import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildDataset, type RawResponse } from '../../scripts/build-dataset';

/** La huella de contenido cubre todo lo que ve la persona usuaria y ninguna fecha. */
const fixture = JSON.parse(
  readFileSync(
    resolve(import.meta.dirname, '../../fixtures/estaciones-terrestres.sample.json'),
    'utf8',
  ),
) as RawResponse;
const hashOf = (raw: RawResponse, now = '2026-11-06T10:00:00Z') =>
  buildDataset(raw, { demo: false, now: new Date(now) }).dataset.meta;
const clone = () => structuredClone(fixture);
type Row = Record<string, string>;
// Una fila que la ingesta conserva (algunas del ejemplo se descartan por coordenadas o precios)
const keptId = buildDataset(fixture, { demo: false }).dataset.stations.stations[0]!.id;
const rowOf = (raw: RawResponse) =>
  raw.ListaEESSPrecio.find((r) => (r as unknown as Row)['IDEESS'] === keptId) as unknown as Row;
const row = (raw: RawResponse) => rowOf(raw);

describe('meta.contentHash', () => {
  const base = hashOf(fixture);

  it('es estable: los mismos datos dan la misma huella aunque cambie la hora de la ingesta', () => {
    expect(base.contentHash).toMatch(/^[0-9a-f]{16}$/);
    const later = hashOf(fixture, '2026-11-07T23:59:59Z');
    expect(later.contentHash).toBe(base.contentHash);
    expect(later.generatedAt).not.toBe(base.generatedAt);
  });
  it('NO cambia porque cambie la hora de consulta de la API (`Fecha`)', () => {
    const raw = clone();
    raw.Fecha = '06/11/2026 12:34:56';
    const meta = hashOf(raw);
    expect(meta.sourceDate).not.toBe(base.sourceDate);
    expect(meta.contentHash).toBe(base.contentHash);
    expect(meta.priceHash).toBe(base.priceHash);
    expect(meta.stationsFile).toBe(base.stationsFile);
  });
  it('cambia si cambia un precio', () => {
    const raw = clone();
    // Se cambia el primer precio que exista en la primera estación que tenga alguno
    const target = row(raw);
    const key = Object.keys(target).find((k) => k.startsWith('Precio ') && target[k])!;
    target[key] = target[key] === '1,999' ? '1,998' : '1,999';
    const meta = hashOf(raw);
    expect(meta.contentHash).not.toBe(base.contentHash);
    expect(meta.priceHash).not.toBe(base.priceHash);
  });
  it('cambia si cambia la dirección, el rótulo o el horario de una estación, aunque no cambie ningún precio', () => {
    for (const field of ['Dirección', 'Rótulo', 'Horario']) {
      const raw = clone();
      const station = row(raw);
      station[field] = `${station[field] ?? ''} X`;
      const meta = hashOf(raw);
      expect(meta.contentHash, field).not.toBe(base.contentHash);
      expect(meta.priceHash, `${field}: el hash de precios no lo ve`).toBe(base.priceHash);
      expect(meta.stationsFile, field).not.toBe(base.stationsFile);
    }
  });
  it('cambia con una baja y con un alta', () => {
    const removed = clone();
    removed.ListaEESSPrecio = removed.ListaEESSPrecio.filter(
      (r) => (r as unknown as Row)['IDEESS'] !== keptId,
    );
    expect(hashOf(removed).contentHash).not.toBe(base.contentHash);
    const added = clone();
    const extra = { ...row(added), IDEESS: '99990001' };
    added.ListaEESSPrecio.push(extra as unknown as (typeof added.ListaEESSPrecio)[number]);
    expect(hashOf(added).contentHash).not.toBe(base.contentHash);
  });
  it('vuelve al valor anterior si los datos vuelven a ser los de antes', () => {
    const changed = clone();
    row(changed)['Dirección'] = 'OTRA CALLE, 1';
    expect(hashOf(changed).contentHash).not.toBe(base.contentHash);
    expect(hashOf(clone()).contentHash).toBe(base.contentHash);
  });
});
