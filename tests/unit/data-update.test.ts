import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildDataset, type RawResponse } from '../../scripts/build-dataset';
import { useDataStore } from '../../src/stores/data';

/** Datos nuevos en segundo plano: no tocan la pantalla hasta que se aplican. */
const fixture = JSON.parse(
  readFileSync(
    resolve(import.meta.dirname, '../../fixtures/estaciones-terrestres.sample.json'),
    'utf8',
  ),
) as RawResponse;
type Row = Record<string, string>;
const build = (mutate?: (raw: RawResponse) => void, fecha?: string) => {
  const raw = structuredClone(fixture);
  mutate?.(raw);
  if (fecha) raw.Fecha = fecha;
  return buildDataset(raw, { demo: false, now: new Date('2026-11-06T10:00:00Z') }).dataset;
};

const current = build();
// Mismo contenido que `current`, otra hora de consulta
const sameContentLater = build(undefined, '06/11/2026 12:34:56');
// Contenido distinto: cambia la dirección de una estación (cambia el fichero de estaciones)
const stationEdit = build((raw) => {
  const kept = current.stations.stations[0]!.id;
  const row = raw.ListaEESSPrecio.find((r) => (r as unknown as Row)['IDEESS'] === kept);
  (row as unknown as Row)['Dirección'] = 'CALLE NUEVA, 1';
}, '06/11/2026 12:34:56');
// Contenido distinto: solo un precio
const priceEdit = build((raw) => {
  const kept = current.stations.stations[0]!.id;
  const row = raw.ListaEESSPrecio.find(
    (r) => (r as unknown as Row)['IDEESS'] === kept,
  ) as unknown as Row;
  const key = Object.keys(row).find((k) => k.startsWith('Precio ') && row[k])!;
  row[key] = row[key] === '1,999' ? '1,998' : '1,999';
}, '06/11/2026 12:34:56');

/** fetch simulado que sirve el conjunto de datos «publicado» que se indique. */
function serve(published: { value: ReturnType<typeof build> }) {
  const calls: string[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: string) => {
      const file = input.split('/data/')[1] ?? '';
      calls.push(file);
      const d = published.value;
      const body =
        file === 'meta.json'
          ? d.meta
          : file === 'prices.json'
            ? d.prices
            : file === d.meta.stationsFile
              ? d.stations
              : null;
      return body ? new Response(JSON.stringify(body)) : new Response('no', { status: 404 });
    }),
  );
  return calls;
}

function showScreenWith(data: typeof current) {
  useDataStore.setState({
    state: { status: 'ready', data: { ...data, fromCache: false } },
    stationsById: new Map(data.stations.stations.map((s) => [s.id, s])),
    update: { status: 'idle' },
    notice: '',
  });
}

beforeEach(() => {
  vi.stubGlobal('caches', undefined);
  showScreenWith(current);
});
afterEach(() => {
  vi.unstubAllGlobals();
});

describe('checkForUpdate / applyUpdate', () => {
  it('sin cambios en el contenido (solo otra hora de consulta): no hace nada y pide solo meta.json', async () => {
    const calls = serve({ value: sameContentLater });
    const before = useDataStore.getState().state;
    expect(await useDataStore.getState().checkForUpdate()).toBe('same');
    expect(calls).toEqual(['meta.json']);
    expect(useDataStore.getState().update.status).toBe('idle');
    expect(useDataStore.getState().state).toBe(before);
  });

  it('con cambio de precios: descarga en segundo plano precios (no estaciones) y NO toca lo que se ve', async () => {
    const calls = serve({ value: priceEdit });
    const before = useDataStore.getState().state;
    expect(priceEdit.meta.stationsFile).toBe(current.meta.stationsFile);
    expect(await useDataStore.getState().checkForUpdate()).toBe('new');
    expect(calls).toEqual(['meta.json', 'prices.json']);
    const store = useDataStore.getState();
    expect(store.update.status).toBe('ready');
    // La pantalla sigue con los datos de antes: la misma referencia, nada recalculado
    expect(store.state).toBe(before);
    expect(store.notice).toBe('');
  });

  it('con cambio de estaciones descarga también el fichero de estaciones nuevo', async () => {
    const calls = serve({ value: stationEdit });
    expect(await useDataStore.getState().checkForUpdate()).toBe('new');
    expect(calls).toEqual(['meta.json', 'prices.json', stationEdit.meta.stationsFile]);
  });

  it('aplicar: la pantalla pasa a los datos nuevos, se recalculan los índices y se anuncia', async () => {
    serve({ value: stationEdit });
    await useDataStore.getState().checkForUpdate();
    const stationId = current.stations.stations[0]!.id;
    expect(useDataStore.getState().stationsById.get(stationId)?.a).toBe(
      current.stations.stations[0]!.a,
    );
    useDataStore.getState().applyUpdate();
    const store = useDataStore.getState();
    expect(store.update.status).toBe('idle');
    expect(store.notice).toBe('Precios actualizados');
    expect(store.stationsById.get(stationId)?.a).toBe('CALLE NUEVA, 1');
    if (store.state.status === 'ready') {
      expect(store.state.data.meta.contentHash).toBe(stationEdit.meta.contentHash);
      expect(store.state.data.fromCache).toBe(false);
    }
  });

  it('aplicar sin datos pendientes no hace nada', () => {
    const before = useDataStore.getState().state;
    useDataStore.getState().applyUpdate();
    expect(useDataStore.getState().state).toBe(before);
    expect(useDataStore.getState().notice).toBe('');
  });

  it('un fallo de red no hace ruido: devuelve «error» y no cambia nada', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('sin red');
      }),
    );
    const before = useDataStore.getState();
    expect(await useDataStore.getState().checkForUpdate()).toBe('error');
    expect(useDataStore.getState().state).toBe(before.state);
    expect(useDataStore.getState().update.status).toBe('idle');
  });

  it('meta.json nuevo pero precios a medio publicar: error (se reintenta) y no queda nada a medias', async () => {
    const calls: string[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: string) => {
        const file = input.split('/data/')[1] ?? '';
        calls.push(file);
        // meta de los datos nuevos pero precios todavía de los de antes
        if (file === 'meta.json') return new Response(JSON.stringify(priceEdit.meta));
        if (file === 'prices.json') return new Response(JSON.stringify(current.prices));
        return new Response('no', { status: 404 });
      }),
    );
    expect(await useDataStore.getState().checkForUpdate()).toBe('error');
    expect(useDataStore.getState().update.status).toBe('idle');
  });

  it('con datos guardados de una sesión sin conexión no comprueba (se encarga «recuperar»)', async () => {
    useDataStore.setState({ state: { status: 'ready', data: { ...current, fromCache: true } } });
    const calls = serve({ value: priceEdit });
    expect(await useDataStore.getState().checkForUpdate()).toBe('same');
    expect(calls).toEqual([]);
  });

  it('si lo publicado vuelve a ser lo que ya se ve, los datos pendientes se descartan', async () => {
    const published = { value: priceEdit };
    serve(published);
    await useDataStore.getState().checkForUpdate();
    expect(useDataStore.getState().update.status).toBe('ready');
    published.value = current;
    expect(await useDataStore.getState().checkForUpdate()).toBe('same');
    expect(useDataStore.getState().update.status).toBe('idle');
  });

  it('si llegan unos datos aún más nuevos mientras hay unos pendientes, se sustituyen sin tocar la pantalla', async () => {
    const published = { value: priceEdit };
    serve(published);
    await useDataStore.getState().checkForUpdate();
    published.value = stationEdit;
    const screen = useDataStore.getState().state;
    expect(await useDataStore.getState().checkForUpdate()).toBe('new');
    const update = useDataStore.getState().update;
    expect(update.status === 'ready' && update.data.meta.contentHash).toBe(
      stationEdit.meta.contentHash,
    );
    expect(useDataStore.getState().state).toBe(screen);
  });
});
