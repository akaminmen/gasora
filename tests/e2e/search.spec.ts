import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { type Page } from '@playwright/test';
import { expect, test } from './fixtures';

/** Búsqueda, autocompletado con teclado, ubicación, filtros y caché de datos (Fase 3). */
const DATA = resolve(import.meta.dirname, '../../public/data');
const index = JSON.parse(readFileSync(resolve(DATA, 'search-index.json'), 'utf8')) as {
  postalCodes: { code: string; lat: number; lng: number; count: number }[];
  provinces: { name: string }[];
};
// Un código postal con muchas gasolineras, para que haya lista, orden y filtros que comprobar.
const BIG_CP = [...index.postalCodes].sort((a, b) => b.count - a.count)[0];
if (!BIG_CP) throw new Error('El índice no tiene códigos postales');
const MALAGA = { latitude: 36.7213, longitude: -4.4214 };

const search = (page: Page) => page.getByRole('combobox', { name: /Buscar por provincia/ }).first();
const cards = (page: Page) => page.getByTestId('station-card');
const results = (page: Page) => page.getByTestId('results-list');

async function cardPrices(page: Page): Promise<number[]> {
  const texts = await page.locator('.station-card__value').allTextContents();
  return texts.map((t) => Number(t.replace(',', '.')));
}

test.describe('buscar por código postal', () => {
  test('teclear el prefijo sugiere CP; Enter elige el primero y lista de más barata a más cara', async ({
    page,
  }) => {
    await page.goto('/');
    await search(page).fill(BIG_CP.code.slice(0, 3));
    const options = page.getByRole('option');
    await expect(options.first()).toBeVisible();
    await expect(page.getByRole('group', { name: 'CP' })).toBeVisible();
    await search(page).press('Enter');

    await expect(page.getByTestId('results-title')).toHaveText(/Gasolineras en CP \d{5}/);
    await expect(results(page)).toBeVisible();
    const prices = await cardPrices(page);
    expect(prices.length).toBeGreaterThan(1);
    expect(prices).toEqual([...prices].sort((a, b) => a - b));
    // La primera es la más barata y lo dice; los empates en el mínimo también.
    await expect(cards(page).first().locator('.badge-best')).toBeVisible();
  });

  test('un CP completo sin gasolineras no da sugerencias y lo explica', async ({ page }) => {
    await page.goto('/');
    await search(page).fill('00000');
    await expect(page.getByRole('status').filter({ hasText: 'Sin coincidencias' })).toBeVisible();
    await search(page).press('Enter');
    await expect(page.getByTestId('results-title')).toHaveCount(0);
  });
});

test.describe('autocompletado por nombre, sin acentos y con teclado', () => {
  test('«malag» sugiere Provincia y Municipio', async ({ page }) => {
    await page.goto('/');
    await search(page).fill('malag');
    await expect(page.getByRole('group', { name: 'Provincia' })).toContainText('Málaga');
    await expect(page.getByRole('group', { name: 'Municipio' })).toContainText('Málaga');
    // Cada sugerencia dice cuántas gasolineras tiene
    await expect(page.getByRole('option').first()).toContainText(/\d+ gasolineras/);
  });

  test('flechas, Enter y Esc', async ({ page }) => {
    await page.goto('/');
    const box = search(page);
    await box.fill('malag');
    const options = page.getByRole('option');
    await expect(options.nth(1)).toBeVisible(); // provincia y municipio, al menos

    // Ninguna resaltada al empezar; ↓ resalta la primera y ↓ la segunda
    await expect(box).not.toHaveAttribute('aria-activedescendant', /.+/);
    await box.press('ArrowDown');
    await expect(options.nth(0)).toHaveAttribute('aria-selected', 'true');
    await box.press('ArrowDown');
    await expect(options.nth(1)).toHaveAttribute('aria-selected', 'true');
    await expect(options.nth(0)).toHaveAttribute('aria-selected', 'false');
    // ↑ vuelve a la primera
    await box.press('ArrowUp');
    await expect(options.nth(0)).toHaveAttribute('aria-selected', 'true');

    // Esc cierra la lista sin elegir nada
    await box.press('Escape');
    await expect(options).toHaveCount(0);
    await expect(page.getByTestId('results-title')).toHaveCount(0);

    // ↓ la reabre y Enter elige la resaltada (el municipio, segunda fila)
    await box.press('ArrowDown');
    await box.press('ArrowDown');
    await box.press('Enter');
    await expect(page.getByTestId('results-title')).toHaveText('Gasolineras en Málaga');
    await expect(page.getByRole('button', { name: 'Ampliar a 10 km' })).toBeVisible();
  });

  test('Enter sin resaltar elige la primera sugerencia (la provincia)', async ({ page }) => {
    await page.goto('/');
    await search(page).fill('Malaga');
    await expect(page.getByRole('option').first()).toBeVisible();
    await search(page).press('Enter');
    await expect(page.getByTestId('results-title')).toHaveText('Gasolineras en Málaga');
    await expect(page.getByRole('button', { name: 'Ampliar a 10 km' })).toHaveCount(0);
    expect(await cards(page).count()).toBeGreaterThan(0);
  });

  test('un municipio se puede ampliar a 10 km', async ({ page }) => {
    await page.goto('/');
    await search(page).fill('malag');
    await page.getByRole('group', { name: 'Municipio' }).getByRole('option').first().click();
    const before = await cards(page).count();
    await page.getByRole('button', { name: 'Ampliar a 10 km' }).click();
    await expect(page.getByRole('slider', { name: /Radio/ })).toHaveValue('10');
    expect(await cards(page).count()).toBeGreaterThanOrEqual(before);
  });

  test('desde otra pantalla, elegir un lugar lleva a los resultados', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/acerca');
    await search(page).fill(BIG_CP.code);
    await search(page).press('Enter');
    await expect(page).toHaveURL('/');
    await expect(page.getByTestId('results-title')).toContainText(BIG_CP.code);
  });
});

test.describe('índice de búsqueda bajo demanda', () => {
  test('no se descarga al cargar la página y sí al usar el buscador', async ({ page }) => {
    const files: string[] = [];
    page.on('request', (request) => {
      const match = /\/data\/([^/?]+)/.exec(request.url());
      if (match?.[1]) files.push(match[1]);
    });
    await page.goto('/');
    await expect(page.getByTestId('status-line')).toContainText('estaciones');
    expect(files.some((f) => f.startsWith('stations.'))).toBe(true);
    expect(files).not.toContain('search-index.json');
    await search(page).focus();
    await expect.poll(() => files.includes('search-index.json')).toBe(true);
  });
});

test('Enter justo después de teclear funciona aunque el índice aún no haya llegado', async ({
  page,
}) => {
  await page.route('**/data/search-index.json', async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 1500));
    await route.continue();
  });
  await page.goto('/');
  await search(page).fill(BIG_CP.code);
  await search(page).press('Enter');
  await expect(page.getByTestId('results-title')).toContainText(BIG_CP.code);
});

test.describe('ubicación', () => {
  test.use({ geolocation: MALAGA });

  test('concedida de antemano: busca directamente y muestra distancias ordenables', async ({
    page,
    context,
  }) => {
    await context.grantPermissions(['geolocation']);
    await page.goto('/');
    await page.getByRole('button', { name: 'Usar mi ubicación' }).click();
    await expect(page.getByTestId('results-title')).toHaveText('Gasolineras cerca de ti');
    await expect(page.locator('.station-card__dist').first()).toBeVisible();
    const byPrice = await cardPrices(page);
    expect(byPrice).toEqual([...byPrice].sort((a, b) => a - b));

    await page.getByRole('button', { name: 'Distancia' }).click();
    const km = (await page.locator('.station-card__dist').allTextContents()).map((t) =>
      Number.parseFloat(t.replace(',', '.')),
    );
    expect(km).toEqual([...km].sort((a, b) => a - b));
  });

  test('sin decidir: explicación previa, «Permitir» y resultados', async ({ page, context }) => {
    await context.grantPermissions(['geolocation']);
    // Se simula un permiso aún sin decidir para ver la explicación previa
    await page.addInitScript(() => {
      const query = navigator.permissions.query.bind(navigator.permissions);
      navigator.permissions.query = (descriptor) =>
        descriptor.name === 'geolocation'
          ? Promise.resolve({ state: 'prompt', onchange: null } as PermissionStatus)
          : query(descriptor);
    });
    await page.goto('/');
    await page.getByRole('button', { name: 'Usar mi ubicación' }).click();
    await expect(
      page.getByRole('heading', { name: 'Encuentra la gasolina más barata a tu alrededor' }),
    ).toBeVisible();
    await page.getByRole('button', { name: 'Permitir' }).click();
    await expect(page.getByTestId('results-title')).toHaveText('Gasolineras cerca de ti');
  });

  test('«Ahora no» vuelve al inicio sin pedir nada', async ({ page }) => {
    await page.addInitScript(() => {
      navigator.permissions.query = () =>
        Promise.resolve({ state: 'prompt', onchange: null } as PermissionStatus);
    });
    await page.goto('/');
    await page.getByRole('button', { name: 'Usar mi ubicación' }).click();
    await page.getByRole('button', { name: 'Ahora no' }).click();
    await expect(page.getByRole('heading', { level: 1 })).toContainText('La gasolina más barata');
  });

  test('denegada: ofrece buscar por zona y una ciudad lleva a los resultados', async ({ page }) => {
    // Sin permiso concedido, el navegador sin interfaz rechaza la petición
    await page.addInitScript(() => {
      navigator.permissions.query = () =>
        Promise.resolve({ state: 'denied', onchange: null } as PermissionStatus);
    });
    await page.goto('/');
    await page.getByRole('button', { name: 'Usar mi ubicación' }).click();
    await expect(page.getByRole('heading', { name: 'Sin problema, busca por zona' })).toBeVisible();
    await page.getByRole('button', { name: 'Málaga' }).click();
    await expect(page.getByTestId('results-title')).toHaveText('Gasolineras en Málaga');
  });

  test('si el navegador la rechaza al pedirla, pasa a «denegado»', async ({ page }) => {
    await page.addInitScript(() => {
      navigator.permissions.query = () =>
        Promise.resolve({ state: 'prompt', onchange: null } as PermissionStatus);
    });
    await page.goto('/');
    await page.getByRole('button', { name: 'Usar mi ubicación' }).click();
    await page.getByRole('button', { name: 'Permitir' }).click(); // sin permiso: lo rechaza
    await expect(page.getByRole('heading', { name: 'Sin problema, busca por zona' })).toBeVisible();
  });

  test('si no se puede obtener (error o tiempo agotado) se explica y se puede reintentar', async ({
    page,
  }) => {
    await page.addInitScript(() => {
      navigator.permissions.query = () =>
        Promise.resolve({ state: 'granted', onchange: null } as PermissionStatus);
      navigator.geolocation.getCurrentPosition = (_ok, fail) =>
        fail?.({
          code: 3,
          message: 'timeout',
          PERMISSION_DENIED: 1,
          POSITION_UNAVAILABLE: 2,
          TIMEOUT: 3,
        });
    });
    await page.goto('/');
    await page.getByRole('button', { name: 'Usar mi ubicación' }).click();
    await expect(page.getByRole('heading', { name: 'No hemos podido localizarte' })).toBeVisible();
    await expect(page.getByText('Hemos tardado demasiado')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Reintentar' })).toBeVisible();
    await page.getByRole('button', { name: 'Buscar por ciudad o código postal' }).click();
    await expect(page.getByRole('heading', { level: 1 })).toContainText('La gasolina más barata');
  });

  test('en medio del mar no hay resultados y se puede ampliar el radio', async ({
    page,
    context,
  }) => {
    await context.grantPermissions(['geolocation']);
    await context.setGeolocation({ latitude: 37.5, longitude: -9.5 });
    await page.goto('/');
    await page.getByRole('button', { name: 'Usar mi ubicación' }).click();
    await expect(
      page.getByRole('heading', { name: 'No encontramos gasolineras aquí' }),
    ).toBeVisible();
    await page.getByRole('button', { name: 'Ampliar radio' }).click();
    await expect(page.getByRole('slider', { name: /Radio/ })).toHaveValue('10');
  });

  test('el radio reduce los resultados y no se guarda la ubicación', async ({ page, context }) => {
    await context.grantPermissions(['geolocation']);
    await page.goto('/');
    await page.getByRole('button', { name: 'Usar mi ubicación' }).click();
    await expect(results(page)).toBeVisible();
    const slider = page.getByRole('slider', { name: /Radio/ });
    await slider.fill('30');
    const wide = await cards(page).count();
    await slider.fill('1');
    await expect.poll(() => cards(page).count()).toBeLessThanOrEqual(wide);
    const stored = await page.evaluate(() => JSON.stringify({ ...localStorage }));
    expect(stored).not.toContain('36.72');
    expect(stored).not.toContain('Tu ubicación');
  });
});

test.describe('combustible, marcas y «Ver más»', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await search(page).fill('malag');
    await page.getByRole('group', { name: 'Provincia' }).getByRole('option').first().click();
    await expect(results(page)).toBeVisible();
  });

  test('cambiar de combustible actualiza el resumen y los precios', async ({ page }) => {
    const summary = page.getByTestId('results-summary');
    await expect(summary).toContainText('Gasolina 95');
    const gasolina = await cardPrices(page);
    await page.getByRole('button', { name: 'Diésel', exact: true }).click();
    await expect(summary).toContainText('Diésel');
    const diesel = await cardPrices(page);
    expect(diesel).not.toEqual(gasolina);
    expect(diesel).toEqual([...diesel].sort((a, b) => a - b));
  });

  test('«Ver más» añade de 50 en 50 hasta 200', async ({ page }) => {
    // La provincia de Málaga tiene más de 200 estaciones con gasolina 95
    expect(await cards(page).count()).toBe(50);
    await page.getByRole('button', { name: 'Ver más' }).click();
    await expect(cards(page)).toHaveCount(100);
    await page.getByRole('button', { name: 'Ver más' }).click();
    await page.getByRole('button', { name: 'Ver más' }).click();
    await expect(cards(page)).toHaveCount(200);
    await expect(page.getByRole('button', { name: 'Ver más' })).toHaveCount(0);
    await expect(page.getByText('Mostramos las 200 primeras')).toBeVisible();
  });

  test('el filtro de marcas agrupa las pequeñas en «Otras» pero la tarjeta muestra el rótulo real', async ({
    page,
  }) => {
    const total = await page.getByTestId('results-summary').textContent();
    await page.getByRole('button', { name: /^Marcas/ }).click();
    const panel = page.getByRole('group', { name: 'Marcas' });
    await expect(panel.getByLabel(/Repsol/)).toBeVisible();
    await expect(panel.getByLabel(/Otras/)).toBeVisible();
    // Las marcas pequeñas (p. ej. PCAN) no aparecen como opción propia
    await expect(panel.getByLabel(/PCAN|Pcan/)).toHaveCount(0);

    await panel.getByLabel(/Otras/).check();
    await expect(page.getByRole('button', { name: 'Marcas (1)' })).toBeVisible();
    // El conjunto y el resumen no cambian: solo la lista
    await expect(page.getByTestId('results-summary')).toHaveText(total ?? '');
    const names = await page.locator('.station-card__link').allTextContents();
    expect(names.length).toBeGreaterThan(0);
    expect(names.some((n) => /repsol/i.test(n))).toBe(false);

    await panel.getByLabel(/Otras/).uncheck();
    await panel.getByLabel(/Repsol/).check();
    const repsol = await page.locator('.station-card__link').allTextContents();
    expect(repsol.every((n) => /repsol/i.test(n))).toBe(true);
  });

  test('«Borrar búsqueda» vuelve al inicio', async ({ page }) => {
    await page.getByTestId('clear-search').click();
    await expect(page.getByRole('heading', { level: 1 })).toContainText('La gasolina más barata');
  });
});

test.describe('caché de datos sin conexión', () => {
  test('si la red falla, usa los últimos datos guardados y avisa con su fecha', async ({
    page,
  }) => {
    await page.goto('/');
    await search(page).focus(); // carga también el índice, que queda guardado
    await expect(page.getByTestId('status-line')).toContainText('estaciones');
    await expect.poll(() => page.evaluate(async () => (await caches.keys()).length)).toBe(1);
    await expect
      .poll(() =>
        page.evaluate(async () => (await (await caches.open('gasora-data-v1')).keys()).length),
      )
      .toBe(4);

    await page.route('**/data/**', (route) => route.abort());
    await page.reload();
    await search(page).fill(BIG_CP.code);
    await search(page).press('Enter');
    await expect(page.getByTestId('results-title')).toContainText(BIG_CP.code);
    await expect(page.getByText('Sin conexión:')).toBeVisible();
    expect(await cards(page).count()).toBeGreaterThan(0);
  });

  test('sin red y sin copia, muestra el error con «Reintentar»', async ({ page }) => {
    await page.route('**/data/**', (route) => route.abort());
    await page.goto('/');
    await expect(page.getByTestId('status-error')).toBeVisible();
    await page.unroute('**/data/**');
    await page.getByRole('button', { name: 'Reintentar' }).click();
    await expect(page.getByTestId('status-line')).toContainText('estaciones');
  });
});
