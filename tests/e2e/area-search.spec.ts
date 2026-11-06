import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';

/**
 * «Buscar en esta zona» (Bloque B). Mover el mapa no cambia los resultados; al terminar un gesto,
 * si el centro queda fuera del área buscada o ya no se ve ningún resultado, aparece un botón que
 * convierte lo que se ve en la zona de búsqueda. Los gestos se simulan con ratón.
 */
const DATA = resolve(import.meta.dirname, '../../dist/data');
const index = JSON.parse(readFileSync(resolve(DATA, 'search-index.json'), 'utf8')) as {
  postalCodes: { code: string; count: number }[];
};
const CP = [...index.postalCodes].sort((a, b) => b.count - a.count)[0]!.code;
const MALAGA = { latitude: 36.7213, longitude: -4.4214 };

const map = (page: Page) => page.getByTestId('map');
const button = (page: Page) => page.getByTestId('search-area');
const sheet = (page: Page) => page.locator('section.bottom-sheet');

async function searchCp(page: Page) {
  await page.goto('/');
  const box = page.getByRole('combobox', { name: /Buscar por provincia/ }).first();
  await box.fill(CP);
  await box.press('Enter');
  await expect(map(page)).toHaveAttribute('data-ready', 'true');
  await expect(page.getByTestId('station-card').first()).toBeVisible();
  await page.waitForTimeout(900); // el encuadre inicial es programático
}

/** El punto libre del lienzo (sin controles, pines ni hojas) más cercano a su centro horizontal. */
async function freePoint(page: Page): Promise<{ x: number; y: number }> {
  return page.evaluate(() => {
    const canvas = document.querySelector('canvas.maplibregl-canvas')!.getBoundingClientRect();
    const sheetTop =
      document.querySelector('section.bottom-sheet')?.getBoundingClientRect().top ?? canvas.bottom;
    const centerX = canvas.left + canvas.width / 2;
    let best = null as { x: number; y: number } | null;
    for (let y = canvas.top + 160; y < Math.min(canvas.bottom, sheetTop) - 30; y += 12) {
      for (let x = canvas.left + 40; x < canvas.right - 120; x += 14) {
        if (!document.elementFromPoint(x, y)?.classList.contains('maplibregl-canvas')) continue;
        if (!best || Math.abs(x - centerX) < Math.abs(best.x - centerX)) best = { x, y };
      }
      if (best) break;
    }
    if (!best) throw new Error('No hay un punto libre en el mapa');
    return best;
  });
}

async function drag(page: Page, dx: number, dy: number) {
  const from = await freePoint(page);
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(from.x + dx, from.y + dy, { steps: 10 });
  await page.mouse.up();
  await page.waitForTimeout(700);
}

/** Arrastra el mapa en una dirección hasta que se ofrece el botón. */
async function dragUntilOffered(page: Page, dx = -240, dy = 0) {
  for (let i = 0; i < 12; i++) {
    if (await button(page).count()) return;
    await drag(page, dx, dy);
  }
  await expect(button(page)).toBeVisible();
}

const rect = (page: Page, selector: string) =>
  page.evaluate((s) => {
    const r = document.querySelector(s)?.getBoundingClientRect();
    return r ? { x: r.x, y: r.y, w: r.width, h: r.height } : null;
  }, selector);

type Box = { x: number; y: number; w: number; h: number } | null;
const apart = (a: Box, b: Box) =>
  !a || !b || a.x + a.w <= b.x || b.x + b.w <= a.x || a.y + a.h <= b.y || b.y + b.h <= a.y;

test.describe('escritorio', () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test('no aparece al principio ni durante el gesto; sí al terminar uno que saca el centro del área', async ({
    page,
  }) => {
    await searchCp(page);
    await expect(button(page)).toHaveCount(0);
    // Durante el gesto (botón del ratón pulsado) tampoco
    const from = await freePoint(page);
    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    await page.mouse.move(from.x - 200, from.y, { steps: 6 });
    await expect(button(page)).toHaveCount(0);
    await page.mouse.up();
    await dragUntilOffered(page);
    await expect(button(page)).toHaveAccessibleName('Buscar en esta zona');
  });

  test('mover el mapa no cambia los resultados', async ({ page }) => {
    await searchCp(page);
    const before = await page.getByTestId('results-summary').innerText();
    await dragUntilOffered(page);
    expect(await page.getByTestId('results-summary').innerText()).toBe(before);
    await expect(page.getByTestId('results-title')).not.toHaveText(/esta zona del mapa/);
  });

  test('es de 44 px, está arriba y centrado y no tapa controles, atribución ni leyenda', async ({
    page,
  }) => {
    await searchCp(page);
    await dragUntilOffered(page);
    const b = (await button(page).boundingBox())!;
    const mapBox = (await map(page).boundingBox())!;
    expect(b.height).toBeGreaterThanOrEqual(44);
    expect(Math.abs(b.x + b.width / 2 - (mapBox.x + mapBox.width / 2))).toBeLessThanOrEqual(2);
    expect(b.y - mapBox.y).toBeLessThanOrEqual(16);
    const box: Box = { x: b.x, y: b.y, w: b.width, h: b.height };
    for (const selector of ['.map-controls', '.maplibregl-ctrl-attrib', '.map-legend']) {
      expect(apart(box, await rect(page, selector)), selector).toBe(true);
    }
  });

  test('se puede usar con el teclado', async ({ page }) => {
    await searchCp(page);
    await dragUntilOffered(page);
    await button(page).focus();
    await expect(button(page)).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page.getByTestId('results-title')).toHaveText('Gasolineras en esta zona del mapa');
    await expect(button(page)).toHaveCount(0);
  });

  test('al pulsar: la zona pasa a ser lo visible, se mantienen combustible y orden, la lista vuelve arriba y se anuncia', async ({
    page,
  }) => {
    await searchCp(page);
    await page.getByRole('button', { name: 'Diésel', exact: true }).click();
    await page.getByRole('button', { name: 'Distancia' }).click();
    await page.getByTestId('list-scroll').evaluate((el) => (el.scrollTop = 400));
    await dragUntilOffered(page);
    const centerBefore = await map(page).getAttribute('data-center');
    await button(page).click();
    await expect(page.getByTestId('results-title')).toHaveText('Gasolineras en esta zona del mapa');
    await expect(button(page)).toHaveCount(0);
    // Se mantienen combustible y orden
    await expect(page.getByRole('button', { name: 'Diésel', exact: true })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await expect(page.getByRole('button', { name: 'Distancia' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    // La lista vuelve arriba
    await expect.poll(() => page.getByTestId('list-scroll').evaluate((el) => el.scrollTop)).toBe(0);
    // Aviso educado
    const live = page.getByTestId('results-announcement');
    await expect(live).toHaveAttribute('role', 'status');
    await expect(live).toHaveText(/^[\d.]+ gasolineras? en esta zona/);
    // El mapa se queda donde estaba (no se vuelve a encuadrar)
    await page.waitForTimeout(900);
    expect(await map(page).getAttribute('data-center')).toBe(centerBefore);
    // El radio es el del deslizador
    const radius = Number(await page.locator('input[type="range"]').first().inputValue());
    expect(radius).toBeGreaterThanOrEqual(1);
    expect(radius).toBeLessThanOrEqual(50);
  });

  test('desaparece al volver a la zona buscada', async ({ page }) => {
    await searchCp(page);
    await dragUntilOffered(page);
    for (let i = 0; i < 14 && (await button(page).count()); i++) await drag(page, 240, 0);
    await expect(button(page)).toHaveCount(0);
  });

  test('con el mapa muy alejado el radio se limita a 50 km y se indica', async ({ page }) => {
    await searchCp(page);
    for (let i = 0; i < 5; i++) await page.getByRole('button', { name: 'Alejar' }).click();
    await page.waitForTimeout(900);
    await dragUntilOffered(page, -300, 0);
    await button(page).click();
    await expect(page.locator('input[type="range"]').first()).toHaveValue('50');
    await expect(page.getByTestId('area-limited')).toHaveText(
      'Acerca el mapa para ver todas las gasolineras de la zona.',
    );
    await expect(page.getByTestId('results-announcement')).toContainText('Acerca el mapa');
  });

  test('la URL lleva el centro y el radio (sin zoom) y se restaura al recargar', async ({
    page,
  }) => {
    await searchCp(page);
    await dragUntilOffered(page);
    await button(page).click();
    await expect.poll(() => page.url()).toMatch(/[?&]q=a-?\d+\.\d{4}_-?\d+\.\d{4}/);
    expect(page.url()).toMatch(/[?&]r=\d+/);
    expect(page.url()).not.toMatch(/zoom|[?&]z=/);
    const url = page.url();
    await page.reload();
    await expect(page.getByTestId('results-title')).toHaveText('Gasolineras en esta zona del mapa');
    await expect(page.getByTestId('station-card').first()).toBeVisible();
    expect(page.url()).toBe(url);
  });

  test('una zona sin gasolineras muestra el estado vacío «Aleja el mapa o prueba otra zona»', async ({
    page,
  }) => {
    await page.goto('/?q=a40.0000_-30.0000&r=2');
    await expect(page.getByTestId('results-title')).toHaveText('Gasolineras en esta zona del mapa');
    await expect(page.getByText('No encontramos gasolineras aquí')).toBeVisible();
    await expect(page.getByText(/Aleja el mapa o prueba otra zona/)).toBeVisible();
  });

  test('si se usó la ubicación del usuario, la zona NO va a la URL', async ({ page, context }) => {
    await context.grantPermissions(['geolocation']);
    await context.setGeolocation(MALAGA);
    await page.goto('/');
    await page.getByRole('button', { name: 'Usar mi ubicación' }).click();
    await expect(map(page)).toHaveAttribute('data-ready', 'true');
    await expect(page.getByTestId('station-card').first()).toBeVisible();
    await page.waitForTimeout(900);
    await dragUntilOffered(page);
    await button(page).click();
    await expect(page.getByTestId('results-title')).toHaveText('Gasolineras en esta zona del mapa');
    expect(new URL(page.url()).search).toBe('');
    // El punto del usuario sigue en el mapa y las distancias se miden desde él
    await expect(page.getByRole('img', { name: 'Tu ubicación' })).toBeVisible();
  });
});

test.describe('móvil', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });

  test('el botón no se tapa con los chips, los controles, la hoja ni la atribución', async ({
    page,
  }) => {
    await searchCp(page);
    await dragUntilOffered(page, -120, 60);
    const b = (await button(page).boundingBox())!;
    expect(b.height).toBeGreaterThanOrEqual(44);
    const box: Box = { x: b.x, y: b.y, w: b.width, h: b.height };
    for (const selector of [
      '.map-controls',
      '.maplibregl-ctrl-attrib',
      'section.bottom-sheet',
      '[data-testid="sheet-toggle"]',
      '.bottom-sheet__restore',
    ]) {
      expect(apart(box, await rect(page, selector)), selector).toBe(true);
    }
    // Queda por debajo del buscador y los chips flotantes
    const chips = (await page.getByRole('group', { name: 'Tipo de combustible' }).boundingBox())!;
    expect(b.y).toBeGreaterThanOrEqual(chips.y + chips.height);
    expect(b.x).toBeGreaterThanOrEqual(0);
    expect(b.x + b.width).toBeLessThanOrEqual(390);
  });

  test('al buscar, la hoja pasa a la altura compacta mostrando la primera (la más barata)', async ({
    page,
  }) => {
    await searchCp(page);
    await dragUntilOffered(page, -120, 60);
    await button(page).click();
    await expect(sheet(page)).toHaveAttribute('data-snap', 'compact');
    await expect(sheet(page)).toHaveAttribute('data-collapsed', 'false');
    const first = page.getByTestId('station-card').first();
    await expect(first).toBeVisible();
    const sheetBox = (await sheet(page).boundingBox())!;
    const firstBox = (await first.boundingBox())!;
    // En la altura compacta se ve la cabecera con el precio más bajo y asoma la primera tarjeta
    expect(firstBox.y).toBeLessThan(sheetBox.y + sheetBox.height - 16);
    expect(await page.getByTestId('sheet-content').evaluate((el) => el.scrollTop)).toBe(0);
    await expect(page.getByTestId('results-summary')).toContainText(/Desde [\d,]+/);
    // Ordenadas por precio, la primera es la más barata: su precio es el de «Desde …»
    const from = await page.getByTestId('results-summary').innerText();
    const price = /Desde ([\d,]+)/.exec(from)?.[1];
    if (price) await expect(first).toContainText(price);
  });

  test('con la hoja replegada, pulsar «Buscar en esta zona» la reabre en compacta', async ({
    page,
  }) => {
    await searchCp(page);
    await dragUntilOffered(page, -120, 60);
    await expect(sheet(page)).toHaveAttribute('data-collapsed', 'true');
    await button(page).click();
    await expect(sheet(page)).toHaveAttribute('data-collapsed', 'false');
    await expect(sheet(page)).toHaveAttribute('data-snap', 'compact');
  });
});
