import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { buildDataset, type RawResponse } from '../../scripts/build-dataset';
import {
  decideDeploy,
  fetchPublished,
  parsePublishedMeta,
  parsePublishedSha,
  type DecideInput,
} from '../../scripts/compare-published';

const fixture = JSON.parse(
  readFileSync(
    resolve(import.meta.dirname, '../../fixtures/estaciones-terrestres.sample.json'),
    'utf8',
  ),
) as RawResponse;
const fresh = buildDataset(fixture, { demo: false, now: new Date('2026-11-06T10:00:00Z') }).dataset
  .meta;
const SHA = 'a'.repeat(40);

const base: DecideInput = {
  event: 'schedule',
  force: false,
  sha: SHA,
  fresh,
  published: fresh,
  publishedSha: SHA,
};

describe('decideDeploy', () => {
  it('omite el despliegue si todo coincide (schedule y workflow_dispatch)', () => {
    for (const event of ['schedule', 'workflow_dispatch']) {
      const decision = decideDeploy({ ...base, event });
      expect(decision).toEqual({ deploy: false, reason: 'sin cambios, no se despliega' });
    }
  });
  it('un push siempre despliega', () => {
    expect(decideDeploy({ ...base, event: 'push' }).deploy).toBe(true);
  });
  it('force=true despliega aunque no haya cambios (solo en workflow_dispatch)', () => {
    expect(decideDeploy({ ...base, event: 'workflow_dispatch', force: true }).deploy).toBe(true);
    // force no tiene efecto en otros eventos, que ya deciden por sí mismos
    expect(decideDeploy({ ...base, event: 'schedule', force: true }).deploy).toBe(false);
  });
  it('despliega si cambia cualquier cosa que ve la persona usuaria', () => {
    expect(decideDeploy({ ...base, published: { ...fresh, contentHash: 'otra' } }).deploy).toBe(
      true,
    );
    expect(
      decideDeploy({ ...base, published: { ...fresh, stationsFile: 'stations.abc.json' } }).deploy,
    ).toBe(true);
    expect(decideDeploy({ ...base, published: { ...fresh, demo: !fresh.demo } }).deploy).toBe(true);
  });
  it('NO despliega si solo cambian las fechas (la hora de consulta no es un cambio)', () => {
    const later = {
      ...fresh,
      sourceDate: '2026-11-06T12:00:00.000Z',
      generatedAt: '2026-11-06T12:00:30.000Z',
    };
    expect(decideDeploy({ ...base, fresh: later }).deploy).toBe(false);
  });
  it('despliega si el código publicado no es el de esta ejecución', () => {
    const decision = decideDeploy({ ...base, publishedSha: 'b'.repeat(40) });
    expect(decision.deploy).toBe(true);
    expect(decision.reason).toMatch(/código publicado/);
  });
  it('falla abierto: sin meta publicado, sin versión o sin huella, despliega', () => {
    expect(decideDeploy({ ...base, published: null }).deploy).toBe(true);
    expect(decideDeploy({ ...base, publishedSha: null }).deploy).toBe(true);
    const withoutHash = { ...fresh };
    delete withoutHash.contentHash;
    expect(decideDeploy({ ...base, published: withoutHash }).deploy).toBe(true);
    expect(decideDeploy({ ...base, fresh: withoutHash, published: withoutHash }).deploy).toBe(true);
  });
});

describe('lectura de lo publicado', () => {
  it('acepta un meta.json válido, también de antes de la huella, y rechaza el resto', () => {
    expect(parsePublishedMeta(fresh)).toEqual(fresh);
    const old = { ...fresh };
    delete old.contentHash;
    expect(parsePublishedMeta(old)?.contentHash).toBeUndefined();
    expect(parsePublishedMeta({ nada: 1 })).toBeNull();
    expect(parsePublishedMeta(null)).toBeNull();
    expect(parsePublishedMeta('<html>')).toBeNull();
  });
  it('lee la versión publicada solo si parece un commit', () => {
    expect(parsePublishedSha({ sha: SHA })).toBe(SHA);
    expect(parsePublishedSha({ sha: 'local' })).toBeNull();
    expect(parsePublishedSha({})).toBeNull();
    expect(parsePublishedSha(null)).toBeNull();
  });
});

describe('fetchPublished', () => {
  it('añade un parámetro único y cabeceras contra la caché, y devuelve el JSON', async () => {
    const fetchImpl = vi.fn();
    fetchImpl.mockResolvedValue(new Response(JSON.stringify({ ok: 1 })));
    const json = await fetchPublished('https://x.test/data/meta.json', fetchImpl as never);
    expect(json).toEqual({ ok: 1 });
    const [url, init] = fetchImpl.mock.calls[0] as [string, RequestInit];
    expect(url).toMatch(/^https:\/\/x\.test\/data\/meta\.json\?nocache=\d+-[a-z0-9]+$/);
    expect(init.cache).toBe('no-store');
    expect(init.headers).toMatchObject({ 'Cache-Control': 'no-cache', Pragma: 'no-cache' });
  });
  it('cada llamada usa un parámetro distinto', async () => {
    const urls: string[] = [];
    const fetchImpl = async (url: string) => {
      urls.push(url);
      return new Response('{}');
    };
    await fetchPublished('https://x.test/a.json', fetchImpl as never);
    await fetchPublished('https://x.test/a.json', fetchImpl as never);
    expect(new Set(urls).size).toBe(2);
  });
  it('devuelve null ante un error de red, un HTTP distinto de 200 o un cuerpo que no es JSON', async () => {
    const failing = async () => {
      throw new Error('red');
    };
    expect(await fetchPublished('https://x.test/a', failing as never)).toBeNull();
    const notFound = async () => new Response('x', { status: 404 });
    expect(await fetchPublished('https://x.test/a', notFound as never)).toBeNull();
    const html = async () => new Response('<html>');
    expect(await fetchPublished('https://x.test/a', html as never)).toBeNull();
  });
});
