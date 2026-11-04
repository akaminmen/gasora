import { BIG_CP } from './data';
import { expect, test } from './fixtures';

/**
 * Carga de datos (Fase 7): el nombre con hash del fichero de estaciones va en el HTML, así que
 * resultados y ficha lo piden a la vez que meta.json, sin esperar a que cargue el JS; el código del
 * mapa no se pide hasta que hay resultados.
 */
test.describe('fichero de estaciones desde el HTML', () => {
  test('el index.html lleva el nombre con hash y es el que publica meta.json', async ({ page }) => {
    await page.goto('/acerca');
    const hint = await page.locator('meta[name="gasora-stations"]').getAttribute('content');
    const meta = (await (await page.request.get('/data/meta.json')).json()) as {
      stationsFile: string;
    };
    expect(hint).toMatch(/^stations\.[0-9a-f]+\.json$/);
    expect(hint).toBe(meta.stationsFile);
  });

  test('en resultados se precarga y se descarga una sola vez; en otras pantallas no se precarga', async ({
    page,
  }) => {
    const stations: string[] = [];
    page.on('request', (r) => {
      if (/\/data\/stations\.[0-9a-f]+\.json$/.test(r.url())) stations.push(r.url());
    });
    await page.goto(`/?q=${BIG_CP}`);
    await expect(page.getByTestId('station-card').first()).toBeVisible();
    expect(await page.locator('link[rel="preload"][as="fetch"]').count()).toBe(1);
    expect(stations).toHaveLength(1);

    stations.length = 0;
    await page.goto('/acerca');
    await expect(page.getByTestId('about-licenses')).toBeVisible();
    expect(await page.locator('link[rel="preload"]').count()).toBe(0);
  });

  test('con un nombre desactualizado en el HTML la app funciona igual', async ({ page }) => {
    await page.route('**/', async (route) => {
      const response = await route.fetch();
      const body = (await response.text()).replace(
        /(<meta name="gasora-stations" content=")[^"]*"/,
        '$1stations.0000000000.json"',
      );
      await route.fulfill({ response, body });
    });
    await page.goto(`/?q=${BIG_CP}`);
    await expect(page.getByTestId('station-card').first()).toBeVisible();
  });
});

test.describe('mapa aplazado hasta que hay datos', () => {
  test.use({ viewport: { width: 1280, height: 900 } });

  test('el código del mapa no se pide antes de los datos y sí después', async ({ page }) => {
    const order: string[] = [];
    page.on('requestfinished', (r) => {
      const url = r.url();
      if (/\/data\/stations\.[0-9a-f]+\.json$/.test(url)) order.push('estaciones');
      if (/MapCanvas-[\w-]+\.js/.test(url)) order.push('mapa');
    });
    await page.goto(`/?q=${BIG_CP}`);
    await expect(page.getByTestId('station-card').first()).toBeVisible();
    await expect(page.locator('[data-testid="map"][data-ready="true"]').first()).toBeVisible({
      timeout: 20_000,
    });
    expect(order.indexOf('estaciones')).toBeGreaterThanOrEqual(0);
    expect(order.indexOf('mapa')).toBeGreaterThan(order.indexOf('estaciones'));
  });

  test('en la pantalla de inicio no se pide el mapa', async ({ page }) => {
    const requests: string[] = [];
    page.on('request', (r) => requests.push(r.url()));
    await page.goto('/');
    await page.waitForTimeout(1500);
    expect(requests.some((u) => /MapCanvas|maplibre/i.test(u))).toBe(false);
  });
});

test('«Acerca de» enlaza las licencias de terceros y el archivo se sirve', async ({ page }) => {
  await page.goto('/acerca');
  const link = page.getByTestId('about-licenses');
  await expect(link).toHaveAttribute('href', /licencias-de-terceros\.txt$/);
  const href = (await link.getAttribute('href'))!;
  const response = await page.request.get(href);
  expect(response.ok()).toBe(true);
  expect(response.headers()['content-type'] ?? '').toContain('text/plain');
  const text = await response.text();
  for (const name of ['maplibre-gl', 'react', 'SIL OPEN FONT LICENSE', 'OpenStreetMap']) {
    expect(text).toContain(name);
  }
});
