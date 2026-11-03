import { createServer, type Server } from 'node:http';
import { mkdtemp, readFile, rm, readdir } from 'node:fs/promises';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildDataset, type RawResponse } from '../../scripts/build-dataset';
import { readDataset, writeDataset } from '../../scripts/dataset-io';
import { fetchStations } from '../../scripts/ministry';
import { runIngest } from '../../scripts/run-ingest';

const root = resolve(import.meta.dirname, '../..');
const fixture = JSON.parse(
  await readFile(join(root, 'fixtures', 'estaciones-terrestres.sample.json'), 'utf8'),
) as RawResponse;

let outDir: string;
let logs: string[];
let warnings: string[];

beforeEach(async () => {
  outDir = await mkdtemp(join(tmpdir(), 'gasora-ingest-'));
  logs = [];
  warnings = [];
});
afterEach(async () => {
  await rm(outDir, { recursive: true, force: true });
});

const run = (options: Parameters<typeof runIngest>[0]) =>
  runIngest({ log: (m) => logs.push(m), warn: (m) => warnings.push(m), ...options });

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

/** fetch que responde 503 en todos los intentos y apunta las URL pedidas. */
function always503(urls: string[] = []): typeof fetch {
  return async (input) => {
    urls.push(String(input));
    return new Response('Service Unavailable', { status: 503, statusText: 'Service Unavailable' });
  };
}

/** fetch que no responde nunca: solo termina cuando salta el timeout (AbortSignal). */
const neverAnswers: typeof fetch = (_input, init) =>
  new Promise((_resolve, reject) => {
    init?.signal?.addEventListener('abort', () => reject(init.signal?.reason));
  });

/** Escribe un dataset anterior «de producción» (no demo) en outDir. */
async function seedPrevious() {
  const { dataset } = buildDataset(fixture, { demo: false, now: new Date('2026-10-27T10:00:00Z') });
  await writeDataset(outDir, dataset);
  return dataset;
}

const fast = { retries: 2, baseDelayMs: 1 };

describe('fetchStations: reintentos', () => {
  it('reintenta un 503 y alterna los dos dominios del Ministerio', async () => {
    const urls: string[] = [];
    await expect(
      fetchStations(() => undefined, { ...fast, fetchImpl: always503(urls) }),
    ).rejects.toThrow(/HTTP 503/);
    expect(urls).toHaveLength(3); // 1 intento + 2 reintentos
    expect(urls[0]).toContain('sedeaplicaciones.minetur.gob.es');
    expect(urls[1]).toContain('energia.serviciosmin.gob.es');
    expect(urls[2]).toContain('sedeaplicaciones.minetur.gob.es');
  });

  it('se recupera si un reintento responde bien', async () => {
    let calls = 0;
    const flaky: typeof fetch = async () => (++calls < 2 ? always503()('x') : json(fixture));
    const raw = await fetchStations(() => undefined, { ...fast, fetchImpl: flaky });
    expect(calls).toBe(2);
    expect(raw.ListaEESSPrecio.length).toBe(fixture.ListaEESSPrecio.length);
  });

  it('un timeout aborta el intento y se reintenta', async () => {
    let calls = 0;
    const countingHang: typeof fetch = (input, init) => {
      calls++;
      return neverAnswers(input, init);
    };
    await expect(
      fetchStations(() => undefined, { ...fast, timeoutMs: 20, fetchImpl: countingHang }),
    ).rejects.toThrow(/timeout/i);
    expect(calls).toBe(3);
  });

  it('rechaza una respuesta con ResultadoConsulta distinto de OK', async () => {
    const bad: typeof fetch = async () => json({ ...fixture, ResultadoConsulta: 'ERROR' });
    await expect(fetchStations(() => undefined, { ...fast, fetchImpl: bad })).rejects.toThrow(
      /Respuesta inesperada/,
    );
  });
});

describe('runIngest: respaldo ante fallos de la API', () => {
  it('503 persistente: conserva el dataset anterior con aviso y sale con 0', async () => {
    const previous = await seedPrevious();
    const code = await run({
      root,
      outDir,
      fetchStations: (log) => fetchStations(log, { ...fast, fetchImpl: always503() }),
    });
    expect(code).toBe(0);
    expect(warnings.join('\n')).toMatch(/HTTP 503/);
    expect(warnings.join('\n')).toMatch(/Se conserva el dataset anterior/);
    const kept = await readDataset(outDir);
    expect(kept.meta).toEqual(previous.meta);
  });

  it('timeout persistente: conserva el dataset anterior con aviso y sale con 0', async () => {
    const previous = await seedPrevious();
    const code = await run({
      root,
      outDir,
      fetchStations: (log) =>
        fetchStations(log, { retries: 1, baseDelayMs: 1, timeoutMs: 20, fetchImpl: neverAnswers }),
    });
    expect(code).toBe(0);
    expect(warnings.join('\n')).toMatch(/timeout/i);
    expect((await readDataset(outDir)).meta.priceHash).toBe(previous.meta.priceHash);
  });

  it('503 sin dato anterior: falla (código 1) y no escribe nada', async () => {
    const code = await run({
      root,
      outDir,
      fetchStations: (log) => fetchStations(log, { ...fast, fetchImpl: always503() }),
    });
    expect(code).toBe(1);
    expect(warnings).toEqual([]);
    expect(logs.join('\n')).toMatch(/No hay dato anterior/);
    expect(await readdir(outDir)).toEqual([]);
  });

  it('timeout sin dato anterior: falla (código 1)', async () => {
    const code = await run({
      root,
      outDir,
      fetchStations: (log) =>
        fetchStations(log, { retries: 0, baseDelayMs: 1, timeoutMs: 20, fetchImpl: neverAnswers }),
    });
    expect(code).toBe(1);
    expect(await readdir(outDir)).toEqual([]);
  });

  it('un 503 seguido de una respuesta buena publica los datos nuevos', async () => {
    await seedPrevious();
    let calls = 0;
    const flaky: typeof fetch = async () =>
      ++calls < 2 ? always503()('x') : json({ ...fixture, Fecha: '28/10/2026 20:00:00' });
    const code = await run({
      root,
      outDir,
      fetchStations: (log) => fetchStations(log, { ...fast, fetchImpl: flaky }),
    });
    expect(code).toBe(0);
    expect(warnings).toEqual([]);
    expect((await readDataset(outDir)).meta.sourceDate).toBe('2026-10-28T19:00:00.000Z');
  });

  it('respuesta parcial (caída > 20 % de estaciones): conserva el anterior', async () => {
    const previous = await seedPrevious();
    const partial = { ...fixture, ListaEESSPrecio: fixture.ListaEESSPrecio.slice(0, 40) };
    const code = await run({ root, outDir, fetchStations: async () => partial });
    expect(code).toBe(0);
    expect(warnings.join('\n')).toMatch(/respuesta parcial/);
    expect((await readDataset(outDir)).meta.stationCount).toBe(previous.meta.stationCount);
  });

  it('respuesta con ResultadoConsulta de error: conserva el anterior', async () => {
    const previous = await seedPrevious();
    const code = await run({
      root,
      outDir,
      fetchStations: async () => ({ ...fixture, ResultadoConsulta: 'ERROR' }),
    });
    expect(code).toBe(0);
    expect(warnings.join('\n')).toMatch(/no supera la validación/);
    expect((await readDataset(outDir)).meta.priceHash).toBe(previous.meta.priceHash);
  });

  it('sin dato local pero con la URL publicada: restaura ese dataset (caso de CI)', async () => {
    const published = await mkdtemp(join(tmpdir(), 'gasora-published-'));
    const { dataset } = buildDataset(fixture, {
      demo: false,
      now: new Date('2026-10-27T10:00:00Z'),
    });
    await writeDataset(published, dataset);
    const server: Server = createServer((req, res) => {
      readFile(join(published, (req.url ?? '/').replace(/^\/+/, '')))
        .then((body) => res.writeHead(200).end(body))
        .catch(() => res.writeHead(404).end());
    });
    await new Promise<void>((done) => server.listen(0, '127.0.0.1', done));
    try {
      const port = (server.address() as AddressInfo).port;
      const code = await run({
        root,
        outDir,
        previousUrl: `http://127.0.0.1:${port}/`,
        fetchStations: (log) => fetchStations(log, { ...fast, fetchImpl: always503() }),
      });
      expect(code).toBe(0);
      expect(warnings.join('\n')).toMatch(/Se conserva el dataset anterior \(http:/);
      expect((await readDataset(outDir)).meta).toEqual(dataset.meta);
    } finally {
      await new Promise((done) => server.close(done));
      await rm(published, { recursive: true, force: true });
    }
  });
});
