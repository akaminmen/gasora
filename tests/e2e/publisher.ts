import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Page } from '@playwright/test';
import { FUEL_INDEX, prices as realPrices, stations } from './data';

const DIR = resolve(import.meta.dirname, '../../dist/data');
const read = <T>(file: string) => JSON.parse(readFileSync(resolve(DIR, file), 'utf8')) as T;

interface Meta {
  sourceDate: string;
  contentHash?: string;
  priceHash: string;
  stationsFile: string;
  [key: string]: unknown;
}

/** Cuánto sube el precio de la gasolina 95 de la estación elegida en los datos «nuevos» (milésimas). */
export const RAISE = 3;

/**
 * Simula el servidor: sirve `meta.json` y `prices.json` reales hasta que se «publican» datos nuevos
 * (otra huella de contenido, otra hora de consulta y un precio distinto en una estación). Cuenta las
 * peticiones y permite hacer fallar las siguientes.
 */
export async function installPublisher(page: Page, changedStationId: string) {
  const realMeta = read<Meta>('meta.json');
  const state = {
    published: 'old' as 'old' | 'new',
    failNext: 0,
    meta: 0,
    prices: 0,
    stations: 0,
    changedId: changedStationId,
  };
  const newSourceDate = new Date(Date.parse(realMeta.sourceDate) + 3 * 3600 * 1000).toISOString();
  const newMeta: Meta = {
    ...realMeta,
    sourceDate: newSourceDate,
    contentHash: 'nuevo0123456789ab',
    priceHash: 'nuevoprecios',
  };
  const index = FUEL_INDEX.g95e5;
  const newPrices = () => {
    const row = (realPrices[state.changedId] ?? []).slice();
    row[index] = (row[index] ?? 1500) + RAISE;
    return { updatedAt: newSourceDate, p: { ...realPrices, [state.changedId]: row } };
  };
  const realPricesFile = read<{ updatedAt: string; p: unknown }>('prices.json');

  await page.route('**/data/meta.json', async (route) => {
    state.meta += 1;
    if (state.failNext > 0) {
      state.failNext -= 1;
      return route.abort('connectionfailed');
    }
    const body = state.published === 'new' ? newMeta : realMeta;
    return route.fulfill({ contentType: 'application/json', body: JSON.stringify(body) });
  });
  await page.route('**/data/prices.json', async (route) => {
    state.prices += 1;
    const body = state.published === 'new' ? newPrices() : realPricesFile;
    return route.fulfill({ contentType: 'application/json', body: JSON.stringify(body) });
  });
  await page.route('**/data/stations.*.json', (route) => {
    state.stations += 1;
    return route.continue();
  });
  return {
    state,
    publish: () => (state.published = 'new'),
    priceOf: (id: string) => realPrices[id]?.[index] ?? 0,
    realPrice: realPrices[changedStationId]?.[index] ?? 0,
    stationCount: stations.length,
  };
}

/** Simula una pestaña oculta o visible. */
export async function setVisibility(page: Page, visibility: 'hidden' | 'visible') {
  await page.evaluate((value) => {
    Object.defineProperty(document, 'visibilityState', { value, configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
  }, visibility);
}
