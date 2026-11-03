import { test as base, expect } from '@playwright/test';

/**
 * Estilo mínimo en lugar del de OpenFreeMap: los tests no dependen de la red ni de los servidores
 * de teselas. Un test aparte (`map-live.spec.ts`) comprueba el estilo y la atribución reales.
 */
const stubStyle = (background: string) =>
  JSON.stringify({
    version: 8,
    name: 'prueba',
    sources: {
      atribucion: {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
        attribution: '© OpenMapTiles, Data from OpenStreetMap',
      },
    },
    glyphs: 'https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf',
    layers: [
      { id: 'background', type: 'background', paint: { 'background-color': background } },
      { id: 'atribucion', type: 'circle', source: 'atribucion' },
    ],
  });

export const test = base.extend({
  page: async ({ page }, provide) => {
    await page.route('https://tiles.openfreemap.org/**', (route) => {
      const url = route.request().url();
      if (url.includes('/styles/')) {
        return route.fulfill({
          contentType: 'application/json',
          body: stubStyle(url.endsWith('/dark') ? '#0f1828' : '#eef1f6'),
        });
      }
      return route.fulfill({ status: 200, contentType: 'application/x-protobuf', body: '' });
    });
    await provide(page);
  },
});

export { expect };
