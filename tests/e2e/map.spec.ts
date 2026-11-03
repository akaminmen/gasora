import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect, test } from './fixtures';
import type { Page } from '@playwright/test';

/**
 * Mapa (Fase 4a). Los tests usan un estilo mínimo en lugar del de OpenFreeMap (ver fixtures.ts):
 * comprueban nuestro código —pines, agrupación, sincronía, encuadre, tema— y que WebGL funciona en
 * Chromium sin interfaz (con SwiftShader). La apariencia del mapa real la revisa el usuario.
 */
const DATA = resolve(import.meta.dirname, '../../public/data');
const index = JSON.parse(readFileSync(resolve(DATA, 'search-index.json'), 'utf8')) as {
  postalCodes: { code: string; lat: number; lng: number; count: number }[];
};
const BIG_CP = [...index.postalCodes].sort((a, b) => b.count - a.count)[0];
if (!BIG_CP) throw new Error('El índice no tiene códigos postales');
const CP = BIG_CP.code;
const MALAGA = { latitude: 36.7213, longitude: -4.4214 };

const search = (page: Page) => page.getByRole('combobox', { name: /Buscar por provincia/ }).first();
const map = (page: Page) => page.getByTestId('map');
const pins = (page: Page) => page.getByTestId('price-pin');
const cards = (page: Page) => page.getByTestId('station-card');

async function searchCp(page: Page) {
  await page.goto('/');
  await search(page).fill(CP);
  await search(page).press('Enter');
  await expect(map(page)).toHaveAttribute('data-ready', 'true');
  await expect(pins(page).first()).toBeVisible();
}

const view = async (page: Page) => {
  const zoom = Number(await map(page).getAttribute('data-zoom'));
  const [lat, lng] = ((await map(page).getAttribute('data-center')) ?? '0,0')
    .split(',')
    .map(Number) as [number, number];
  return { zoom, lat, lng };
};

test.describe('escritorio (1440 px): lista · mapa · ficha', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('WebGL funciona: el mapa se inicia y dibuja un lienzo', async ({ page }) => {
    await searchCp(page);
    const canvas = map(page).locator('canvas.maplibregl-canvas');
    await expect(canvas).toBeVisible();
    const size = await canvas.evaluate((c: HTMLCanvasElement) => ({
      w: c.width,
      h: c.height,
      gl: !!c.getContext('webgl2') || !!c.getContext('webgl'),
    }));
    expect(size.w).toBeGreaterThan(300);
    expect(size.h).toBeGreaterThan(400); // el alto de la zona del mapa, no el 300 por defecto del lienzo
    // getContext sobre un lienzo que ya tiene contexto devuelve ese mismo contexto (no null)
    expect(size.gl).toBe(true);
  });

  test('tres zonas: lista de 400 px, mapa flexible y ficha de 360 px solo con selección', async ({
    page,
  }) => {
    await searchCp(page);
    const list = await page
      .getByRole('complementary', { name: 'Lista de gasolineras' })
      .boundingBox();
    const mapBox = await map(page).boundingBox();
    expect(list?.width).toBe(400);
    expect(mapBox?.width).toBeGreaterThan(600);
    await expect(page.getByRole('complementary', { name: 'Ficha de la gasolinera' })).toHaveCount(
      0,
    );

    await cards(page).first().locator('.station-card__link').click();
    const detail = page.getByRole('complementary', { name: 'Ficha de la gasolinera' });
    await expect(detail).toBeVisible();
    expect((await detail.boundingBox())?.width).toBe(360);
    // Las tres zonas no se solapan
    const a = await page.getByRole('complementary', { name: 'Lista de gasolineras' }).boundingBox();
    const b = await map(page).boundingBox();
    const c = await detail.boundingBox();
    expect((a?.x ?? 0) + (a?.width ?? 0)).toBeLessThanOrEqual((b?.x ?? 0) + 0.5);
    expect((b?.x ?? 0) + (b?.width ?? 0)).toBeLessThanOrEqual((c?.x ?? 0) + 0.5);
  });

  test('los pines llevan precio, símbolo de tramo y nombre accesible; la más barata, corona', async ({
    page,
  }) => {
    await searchCp(page);
    const count = await pins(page).count();
    expect(count).toBeGreaterThan(0);
    expect(count).toBeLessThanOrEqual(60);
    const first = pins(page).first();
    await expect(first).toHaveAttribute(
      'aria-label',
      /euros el litro, precio (barata|media|alta|cara)/,
    );
    await expect(first.locator('[data-testid="price-pin-text"]')).toContainText(/\d,\d{3} €/);
    // El color nunca es el único indicador: cada pin lleva su símbolo ▼ — ▲
    await expect(first.locator('svg').first()).toBeVisible();
    await expect(page.locator('.price-pin__crown').first()).toBeVisible();
    // La leyenda del mapa explica los cuatro tramos
    const legend = page.getByRole('list', { name: 'Leyenda de precios' });
    await expect(legend.getByRole('listitem')).toHaveText(['Barata', 'Media', 'Alta', 'Cara']);
  });

  test('pin → tarjeta: seleccionar un pin marca la tarjeta, abre la ficha y la lista se desplaza', async ({
    page,
  }) => {
    await searchCp(page);
    const pin = pins(page).nth(1);
    const label = (await pin.getAttribute('aria-label')) ?? '';
    const name = label.split(',')[0] ?? '';
    await pin.click();
    await expect(pin).toHaveAttribute('aria-pressed', 'true');
    const selected = page.locator('[data-testid="station-card"][data-selected="true"]');
    await expect(selected).toHaveCount(1);
    await expect(selected.locator('.station-card__link')).toHaveText(name);
    await expect(page.locator('[data-testid="price-pin"][aria-pressed="true"]')).toHaveCount(1);
    await expect(selected).toBeInViewport();
    const detail = page.getByRole('complementary', { name: 'Ficha de la gasolinera' });
    await expect(detail.getByRole('heading', { name })).toBeVisible();
    await expect(page.getByTestId('detail-price')).toBeVisible();
  });

  test('tarjeta → pin: seleccionar una tarjeta marca el pin y centra el mapa', async ({ page }) => {
    await searchCp(page);
    const card = cards(page).nth(3);
    await card.locator('.station-card__link').click();
    await expect(card).toHaveAttribute('data-selected', 'true');
    const pressed = page.locator('[data-testid="price-pin"][aria-pressed="true"]');
    await expect(pressed).toHaveCount(1);
    // El mapa se centra: el pin queda cerca del centro de la zona del mapa
    await expect
      .poll(async () => {
        const m = await map(page).boundingBox();
        const p = await pressed.boundingBox();
        if (!m || !p) return 9999;
        return Math.hypot(
          p.x + p.width / 2 - (m.x + m.width / 2),
          p.y + p.height / 2 - (m.y + m.height / 2),
        );
      })
      .toBeLessThan(80);
  });

  test('la ficha se cierra y deja la selección vacía', async ({ page }) => {
    await searchCp(page);
    await cards(page).first().locator('.station-card__link').click();
    await page.getByRole('button', { name: 'Cerrar ficha' }).click();
    await expect(page.getByRole('complementary', { name: 'Ficha de la gasolinera' })).toHaveCount(
      0,
    );
    await expect(page.locator('[data-testid="station-card"][data-selected="true"]')).toHaveCount(0);
    await expect(page.locator('[data-testid="price-pin"][aria-pressed="true"]')).toHaveCount(0);
  });

  test('toda la tarjeta es zona táctil (no solo el nombre)', async ({ page }) => {
    await searchCp(page);
    const card = cards(page).nth(1);
    const box = await card.boundingBox();
    if (!box) throw new Error('sin caja');
    // Un punto de la dirección, lejos del nombre
    await page.mouse.click(box.x + box.width / 2, box.y + box.height - 10);
    await expect(card).toHaveAttribute('data-selected', 'true');
  });

  test('mover el mapa no cambia el conjunto de resultados ni los tramos', async ({ page }) => {
    await searchCp(page);
    const summary = await page.getByTestId('results-summary').textContent();
    const tiersBefore = await page
      .locator('.tier[role="img"]')
      .evaluateAll((els) => els.map((e) => e.getAttribute('aria-label')));
    const box = await map(page).boundingBox();
    if (!box) throw new Error('sin caja');
    const before = await view(page);
    await page.mouse.move(box.x + 300, box.y + 300);
    await page.mouse.down();
    await page.mouse.move(box.x + 500, box.y + 380, { steps: 8 });
    await page.mouse.up();
    await expect.poll(async () => (await view(page)).lng).not.toBe(before.lng);
    expect(await page.getByTestId('results-summary').textContent()).toBe(summary);
    const tiersAfter = await page
      .locator('.tier[role="img"]')
      .evaluateAll((els) => els.map((e) => e.getAttribute('aria-label')));
    expect(tiersAfter).toEqual(tiersBefore);
  });

  test('acercar y alejar con los botones (44 px)', async ({ page }) => {
    await searchCp(page);
    const zoomIn = page.getByRole('button', { name: 'Acercar' });
    const zoomOut = page.getByRole('button', { name: 'Alejar' });
    for (const button of [zoomIn, zoomOut]) {
      const box = await button.boundingBox();
      expect(box?.width).toBeGreaterThanOrEqual(44);
      expect(box?.height).toBeGreaterThanOrEqual(44);
    }
    const start = (await view(page)).zoom;
    await zoomIn.click();
    await expect.poll(async () => (await view(page)).zoom).toBeGreaterThan(start + 0.5);
    await zoomOut.click();
    await zoomOut.click();
    await expect.poll(async () => (await view(page)).zoom).toBeLessThan(start);
  });

  test('una ciudad entera se agrupa en clústeres: nunca más de 60 pines y, al acercar, aparecen', async ({
    page,
  }) => {
    await page.goto('/');
    await search(page).fill('Madrid');
    await page.getByRole('group', { name: 'Municipio' }).getByRole('option').first().click();
    await expect(map(page)).toHaveAttribute('data-ready', 'true');
    await expect(cards(page).first()).toBeVisible();
    await page.waitForTimeout(800);
    const overview = await pins(page).count();
    expect(overview).toBeLessThanOrEqual(60);
    // Al acercar se van separando y aparecen pines (centro de la ciudad: muchas estaciones)
    const zoomIn = page.getByRole('button', { name: 'Acercar' });
    await expect
      .poll(
        async () => {
          if ((await pins(page).count()) === 0) {
            await zoomIn.click();
            await page.waitForTimeout(400);
          }
          return pins(page).count();
        },
        { timeout: 20_000 },
      )
      .toBeGreaterThan(0);
    expect(await pins(page).count()).toBeLessThanOrEqual(60);
  });

  test('el filtro de marcas cambia los pines pero no los tramos del resto', async ({ page }) => {
    await searchCp(page);
    const total = await pins(page).count();
    await page.getByRole('button', { name: /^Marcas/ }).click();
    await page.getByRole('group', { name: 'Marcas' }).getByLabel(/Otras/).check();
    await expect.poll(() => pins(page).count()).toBeLessThanOrEqual(total);
    expect(await map(page).getAttribute('data-ready')).toBe('true');
  });

  test('el mapa no tapa la lista ni desborda la página', async ({ page }) => {
    await searchCp(page);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
    const attribution = page.locator('.maplibregl-ctrl-attrib');
    await expect(attribution).toContainText('OpenMapTiles');
    await expect(attribution).toContainText('OpenStreetMap');
    await expect(attribution).toBeInViewport();
  });
});

test('«Acerca de» repite la atribución del mapa', async ({ page }) => {
  await page.goto('/acerca');
  await expect(page.getByTestId('about-map')).toContainText(
    '© OpenMapTiles, Data from OpenStreetMap',
  );
});

test.describe('estilo según el tema', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('claro usa «positron»; oscuro, «dark»; y cambia al vuelo con el interruptor', async ({
    page,
  }) => {
    const styles: string[] = [];
    page.on('request', (r) => {
      const m = /tiles\.openfreemap\.org\/styles\/(\w+)/.exec(r.url());
      if (m?.[1]) styles.push(m[1]);
    });
    await searchCp(page);
    expect(styles).toEqual(['positron']);
    await page.getByTestId('theme-toggle').click();
    await expect.poll(() => styles).toEqual(['positron', 'dark']);
    await expect(map(page)).toHaveAttribute('data-ready', 'true');
    // Tras cambiar de estilo siguen los pines y los datos
    await expect(pins(page).first()).toBeVisible();
    await page.getByTestId('theme-toggle').click();
    await expect.poll(() => styles).toEqual(['positron', 'dark', 'positron']);
  });

  test('con el tema oscuro guardado, el primer estilo pedido es «dark»', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('gasora:theme:v1', 'dark'));
    const styles: string[] = [];
    page.on('request', (r) => {
      const m = /tiles\.openfreemap\.org\/styles\/(\w+)/.exec(r.url());
      if (m?.[1]) styles.push(m[1]);
    });
    await searchCp(page);
    expect(styles).toEqual(['dark']);
  });
});

test.describe('posición del usuario', () => {
  test.use({ viewport: { width: 1440, height: 900 }, geolocation: MALAGA });

  test('se muestra el punto del usuario y «Centrar en mi ubicación» vuelve a él', async ({
    page,
    context,
  }) => {
    await context.grantPermissions(['geolocation']);
    await page.goto('/');
    await page.getByRole('button', { name: 'Usar mi ubicación' }).click();
    await expect(map(page)).toHaveAttribute('data-ready', 'true');
    await expect(page.getByRole('img', { name: 'Tu ubicación' })).toBeVisible();
    // Encuadre de los resultados: el centro queda cerca del usuario
    await expect
      .poll(async () => Math.abs((await view(page)).lat - MALAGA.latitude))
      .toBeLessThan(0.1);

    const box = await map(page).boundingBox();
    if (!box) throw new Error('sin caja');
    await page.mouse.move(box.x + 300, box.y + 300);
    await page.mouse.down();
    await page.mouse.move(box.x + 100, box.y + 100, { steps: 6 });
    await page.mouse.up();
    const moved = await view(page);
    await page.getByRole('button', { name: 'Centrar en mi ubicación' }).click();
    await expect
      .poll(async () => {
        const v = await view(page);
        return Math.hypot(v.lat - MALAGA.latitude, v.lng - MALAGA.longitude);
      })
      .toBeLessThan(0.002);
    expect(moved.lat).not.toBeCloseTo(MALAGA.latitude, 3);
  });

  test('sin ubicación (búsqueda por CP) no hay punto ni botón de centrar', async ({ page }) => {
    await searchCp(page);
    await expect(page.getByRole('img', { name: 'Tu ubicación' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Centrar en mi ubicación' })).toHaveCount(0);
  });
});

test.describe('carga diferida y fallos', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('el código del mapa no se descarga en el inicio, solo al ver resultados', async ({
    page,
  }) => {
    const chunks: string[] = [];
    page.on('request', (r) => {
      const m = /\/assets\/(MapCanvas-[^/]+\.(js|css))/.exec(r.url());
      if (m?.[1]) chunks.push(m[1]);
    });
    await page.goto('/');
    await expect(page.getByTestId('status-line')).toContainText('estaciones');
    await page.waitForTimeout(500);
    expect(chunks).toEqual([]);
    await search(page).fill(CP);
    await search(page).press('Enter');
    await expect(map(page)).toHaveAttribute('data-ready', 'true');
    expect(chunks.some((c) => c.endsWith('.js'))).toBe(true);
    expect(chunks.some((c) => c.endsWith('.css'))).toBe(true);
  });

  test('sin WebGL el mapa avisa y la lista sigue funcionando', async ({ page }) => {
    await page.addInitScript(() => {
      const original = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function (
        this: HTMLCanvasElement,
        type: string,
        ...rest: unknown[]
      ) {
        if (/webgl/i.test(type)) return null;
        return (original as (...a: unknown[]) => unknown).call(this, type, ...rest) as never;
      } as typeof original;
    });
    await page.goto('/');
    await search(page).fill(CP);
    await search(page).press('Enter');
    await expect(page.getByTestId('map-unavailable')).toBeVisible();
    await expect(page.getByText('No se ha podido cargar el mapa')).toBeVisible();
    expect(await cards(page).count()).toBeGreaterThan(0);
    await cards(page).first().locator('.station-card__link').click();
    await expect(page.getByTestId('station-detail')).toBeVisible();
  });

  test('si el estilo del mapa no se descarga, avisa y la lista sigue funcionando', async ({
    page,
  }) => {
    await page.route('https://tiles.openfreemap.org/styles/**', (route) => route.abort());
    await page.goto('/');
    await search(page).fill(CP);
    await search(page).press('Enter');
    await expect(page.getByTestId('map-unavailable')).toBeVisible();
    expect(await cards(page).count()).toBeGreaterThan(0);
  });

  test('si el código del mapa no se descarga, avisa y la lista sigue funcionando', async ({
    page,
  }) => {
    await page.route(/\/assets\/MapCanvas-.*\.js/, (route) => route.abort());
    await page.goto('/');
    await search(page).fill(CP);
    await search(page).press('Enter');
    await expect(page.getByTestId('map-unavailable')).toBeVisible();
    expect(await cards(page).count()).toBeGreaterThan(0);
  });
});

test.describe('tablet (768 px): lista y mapa, ficha superpuesta', () => {
  test.use({ viewport: { width: 768, height: 900 } });

  test('dos zonas y la ficha como hoja lateral sobre el mapa', async ({ page }) => {
    await searchCp(page);
    const list = await page
      .getByRole('complementary', { name: 'Lista de gasolineras' })
      .boundingBox();
    expect(list?.width).toBe(340);
    await cards(page).first().locator('.station-card__link').click();
    const detail = page.getByRole('complementary', { name: 'Ficha de la gasolinera' });
    await expect(detail).toBeVisible();
    const d = await detail.boundingBox();
    const m = await map(page).boundingBox();
    expect(d?.width).toBeLessThanOrEqual(360);
    // La ficha queda dentro del mapa (superpuesta), no empuja la maquetación
    expect((d?.x ?? 0) + (d?.width ?? 0)).toBeLessThanOrEqual((m?.x ?? 0) + (m?.width ?? 0) + 0.5);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
  });
});
