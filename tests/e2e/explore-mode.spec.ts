import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';

/**
 * Hoja inferior en móvil, modo exploración (Bloque A): mientras se explora el mapa, la hoja se
 * repliega a una línea fina con un botón de 44 px. Se repliega con gestos de una persona sobre el
 * mapa (arrastrar, pellizcar, doble toque, tocar una zona vacía) y NO con movimientos
 * programáticos (botones +/−, centrar al elegir una tarjeta) ni al tocar un pin. Los gestos se
 * simulan con ratón, eventos de puntero y eventos táctiles del protocolo de Chromium; los dedos
 * reales los prueba el usuario.
 */
const DATA = resolve(import.meta.dirname, '../../dist/data');
const index = JSON.parse(readFileSync(resolve(DATA, 'search-index.json'), 'utf8')) as {
  postalCodes: { code: string; count: number }[];
};
const CP = [...index.postalCodes].sort((a, b) => b.count - a.count)[0]!.code;

test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });

const sheet = (page: Page) => page.locator('section.bottom-sheet');
const restore = (page: Page) => page.getByTestId('sheet-restore');
const handle = (page: Page) => page.getByRole('button', { name: /Cambiar la altura de la hoja/ });
const map = (page: Page) => page.getByTestId('map');

async function open(page: Page) {
  await page.goto('/');
  const box = page.getByRole('combobox', { name: /Buscar por provincia/ }).first();
  await box.fill(CP);
  await box.press('Enter');
  await expect(map(page)).toHaveAttribute('data-ready', 'true');
  await expect(sheet(page)).toBeVisible();
  await expect(page.getByTestId('station-card').first()).toBeVisible();
  // El encuadre inicial es programático: que termine antes de empezar
  await page.waitForTimeout(900);
}

/** Con la hoja compacta, la franja libre del mapa queda entre los chips y la hoja. */
async function compact(page: Page) {
  await handle(page).click();
  await handle(page).click();
  await expect(sheet(page)).toHaveAttribute('data-snap', 'compact');
  await page.waitForTimeout(450);
}

/** Un punto del lienzo sin pines, controles ni marcadores (para arrastrar y tocar). */
async function freePoint(page: Page): Promise<{ x: number; y: number }> {
  return page.evaluate(() => {
    const canvas = document.querySelector('canvas.maplibregl-canvas')!.getBoundingClientRect();
    const sheetTop = document.querySelector('section.bottom-sheet')!.getBoundingClientRect().top;
    for (let y = 230; y < sheetTop - 20; y += 12) {
      for (let x = 40; x < canvas.right - 90; x += 14) {
        const el = document.elementFromPoint(x, y);
        if (el?.classList.contains('maplibregl-canvas')) return { x, y };
      }
    }
    throw new Error('No hay un punto libre en el mapa');
  });
}

async function mouseDrag(page: Page, from: { x: number; y: number }, dx: number, dy: number) {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(from.x + dx, from.y + dy, { steps: 8 });
  await page.mouse.up();
}

test.describe('se repliega con gestos de una persona sobre el mapa', () => {
  test('arrastrar el mapa', async ({ page }) => {
    await open(page);
    await compact(page);
    await expect(restore(page)).toHaveCount(0);
    await mouseDrag(page, await freePoint(page), -50, 40);
    await expect(sheet(page)).toHaveAttribute('data-collapsed', 'true');
    await expect(restore(page)).toBeVisible();
  });

  test('doble toque', async ({ page }) => {
    await open(page);
    await compact(page);
    const p = await freePoint(page);
    await page.mouse.dblclick(p.x, p.y);
    await expect(sheet(page)).toHaveAttribute('data-collapsed', 'true');
  });

  test('tocar una zona vacía del mapa', async ({ page }) => {
    await open(page);
    await compact(page);
    const p = await freePoint(page);
    await page.mouse.click(p.x, p.y);
    await expect(sheet(page)).toHaveAttribute('data-collapsed', 'true');
  });

  test('pellizcar (eventos táctiles de Chromium)', async ({ page }) => {
    await open(page);
    await compact(page);
    const p = await freePoint(page);
    const cdp = await page.context().newCDPSession(page);
    const touch = (
      type: 'touchStart' | 'touchMove' | 'touchEnd',
      points: { x: number; y: number }[],
    ) =>
      cdp.send('Input.dispatchTouchEvent', {
        type,
        touchPoints: points.map((q, i) => ({ x: q.x, y: q.y, id: i + 1 })),
      });
    await touch('touchStart', [
      { x: p.x - 20, y: p.y },
      { x: p.x + 20, y: p.y },
    ]);
    for (let i = 1; i <= 8; i++) {
      await touch('touchMove', [
        { x: p.x - 20 - i * 8, y: p.y },
        { x: p.x + 20 + i * 8, y: p.y },
      ]);
    }
    await touch('touchEnd', []);
    await expect(sheet(page)).toHaveAttribute('data-collapsed', 'true');
  });
});

test.describe('NO se repliega con movimientos programáticos ni al tocar un pin', () => {
  test('encuadre de la búsqueda, botones +/− y elegir una tarjeta', async ({ page }) => {
    await open(page);
    await expect(sheet(page)).toHaveAttribute('data-collapsed', 'false');
    await page.getByRole('button', { name: 'Acercar' }).click();
    await page.getByRole('button', { name: 'Alejar' }).click();
    await page.waitForTimeout(500);
    await expect(sheet(page)).toHaveAttribute('data-collapsed', 'false');
    // Elegir una tarjeta centra el mapa en la estación: tampoco repliega (abre la ficha)
    await page.getByTestId('station-card').first().getByRole('button').first().click();
    await expect(page.getByTestId('station-detail')).toBeVisible();
    await page.waitForTimeout(600);
    await expect(sheet(page)).toHaveAttribute('data-collapsed', 'false');
  });

  test('tocar un pin con la hoja replegada muestra la tarjeta de esa estación', async ({
    page,
  }) => {
    await open(page);
    await compact(page);
    await mouseDrag(page, await freePoint(page), 10, 6);
    await expect(sheet(page)).toHaveAttribute('data-collapsed', 'true');
    const pin = page.getByTestId('price-pin').first();
    await expect(pin).toBeVisible();
    await pin.click();
    await expect(sheet(page)).toHaveAttribute('data-collapsed', 'false');
    await expect(page.getByTestId('station-detail')).toBeVisible();
  });
});

test.describe('la línea (asa) replegada', () => {
  test('es un botón de 44 px con aria-expanded y nombre «Mostrar lista de gasolineras (N)»', async ({
    page,
  }) => {
    await open(page);
    const total = await page.getByTestId('sheet-count').innerText();
    await compact(page);
    await mouseDrag(page, await freePoint(page), 20, 20);
    const button = restore(page);
    await expect(button).toHaveAttribute('aria-expanded', 'false');
    const name = (await button.getAttribute('aria-label')) ?? '';
    expect(name).toMatch(/^Mostrar lista de gasolineras \(\d+\)$/);
    expect(Number(/\((\d+)\)/.exec(name)?.[1])).toBe(
      Number(/^[\d.]+/.exec(total)?.[0]?.replaceAll('.', '')),
    );
    const box = (await button.boundingBox())!;
    expect(box.height).toBeGreaterThanOrEqual(44);
    expect(box.width).toBeGreaterThanOrEqual(44);
    expect(box.y + box.height).toBeLessThanOrEqual(844);
    // Lo único visible es una línea fina
    const line = (await page.locator('.bottom-sheet__line').boundingBox())!;
    expect(line.height).toBeLessThanOrEqual(6);
    // La hoja ocupa solo el asa (44 px más el margen de seguridad, 0 en este navegador)
    // (la hoja se anima hasta la línea: se espera a que termine; en un equipo lento tarda más)
    await expect
      .poll(async () => (await sheet(page).boundingBox())!.height, { timeout: 5000 })
      .toBeLessThanOrEqual(46);
    // El margen de seguridad del dispositivo está en la hoja y en el botón
    const usesSafeArea = await page.evaluate(() =>
      [...document.styleSheets].some((s) =>
        [...s.cssRules].some(
          (r) =>
            r.cssText.includes('bottom-sheet__restore') &&
            r.cssText.includes('safe-area-inset-bottom'),
        ),
      ),
    );
    expect(usesSafeArea).toBe(true);
  });

  test('no tapa la atribución ni los controles del mapa', async ({ page }) => {
    await open(page);
    await compact(page);
    await mouseDrag(page, await freePoint(page), 20, 20);
    await page.waitForTimeout(450);
    const rects = await page.evaluate(() => {
      const rect = (selector: string) => document.querySelector(selector)?.getBoundingClientRect();
      const pick = (r?: DOMRect) => (r ? { x: r.x, y: r.y, w: r.width, h: r.height } : null);
      return {
        attribution: pick(rect('.maplibregl-ctrl-attrib')),
        controls: pick(rect('.map-controls')),
        restore: pick(rect('[data-testid="sheet-restore"]')),
        toggle: pick(rect('[data-testid="sheet-toggle"]')),
      };
    });
    const apart = (a: { x: number; y: number; w: number; h: number } | null, b: typeof a) =>
      !a ||
      !b ||
      a.x + a.w <= b.x ||
      b.x + b.w <= a.x ||
      a.y + a.h <= b.y + 0.5 ||
      b.y + b.h <= a.y + 0.5;
    expect(rects.attribution).not.toBeNull();
    expect(apart(rects.restore, rects.attribution)).toBe(true);
    expect(apart(rects.restore, rects.controls)).toBe(true);
    expect(apart(rects.restore, rects.toggle)).toBe(true);
    // La atribución sigue a la vista, dentro de la pantalla
    await expect(page.locator('.maplibregl-ctrl-attrib')).toBeVisible();
    expect(rects.attribution!.y + rects.attribution!.h).toBeLessThanOrEqual(844 - 40);
  });

  test('se reabre con un toque y recupera la altura anterior', async ({ page }) => {
    await open(page);
    await page.waitForTimeout(450);
    const snapBefore = await sheet(page).getAttribute('data-snap');
    await mouseDrag(page, await freePoint(page), 20, 20);
    await expect(sheet(page)).toHaveAttribute('data-collapsed', 'true');
    await restore(page).click();
    await expect(sheet(page)).toHaveAttribute('data-collapsed', 'false');
    await expect(sheet(page)).toHaveAttribute('data-snap', snapBefore!);
    await expect(page.getByTestId('station-card').first()).toBeVisible();
    // El foco pasa al asa normal
    await expect(handle(page)).toBeFocused();
  });

  for (const key of ['Enter', 'Space']) {
    test(`se reabre con ${key}`, async ({ page }) => {
      await open(page);
      await mouseDrag(page, await freePoint(page), 20, 20);
      await restore(page).focus();
      await page.keyboard.press(key);
      await expect(sheet(page)).toHaveAttribute('data-collapsed', 'false');
    });
  }

  test('se reabre arrastrándola hacia arriba (eventos de puntero)', async ({ page }) => {
    await open(page);
    await mouseDrag(page, await freePoint(page), 20, 20);
    await restore(page).evaluate(async (el) => {
      const r = el.getBoundingClientRect();
      const x = r.x + r.width / 2;
      const y = r.y + r.height / 2;
      const fire = (type: string, yy: number) =>
        el.dispatchEvent(
          new PointerEvent(type, {
            pointerId: 9,
            pointerType: 'touch',
            isPrimary: true,
            clientX: x,
            clientY: yy,
            bubbles: true,
            cancelable: true,
          }),
        );
      fire('pointerdown', y);
      for (let i = 1; i <= 6; i++) {
        fire('pointermove', y - i * 8);
        await new Promise((resolveTimer) => setTimeout(resolveTimer, 20));
      }
      fire('pointerup', y - 48);
    });
    await expect(sheet(page)).toHaveAttribute('data-collapsed', 'false');
  });

  test('con «reducir movimiento» la hoja no se anima', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await open(page);
    const duration = await sheet(page).evaluate((el) => getComputedStyle(el).transitionDuration);
    expect(duration).toMatch(/^0s(, 0s)*$/);
  });

  test('una búsqueda nueva la reabre', async ({ page }) => {
    await open(page);
    await mouseDrag(page, await freePoint(page), 20, 20);
    await expect(sheet(page)).toHaveAttribute('data-collapsed', 'true');
    const box = page.getByRole('combobox', { name: /Buscar por provincia/ }).first();
    await box.fill('Albacete');
    await page.getByRole('option').first().click();
    await expect(sheet(page)).toHaveAttribute('data-collapsed', 'false');
  });
});

test.describe('escritorio y tablet no cambian', () => {
  for (const viewport of [
    { width: 1440, height: 900 },
    { width: 820, height: 1100 },
  ]) {
    test(`a ${viewport.width} px mover el mapa no repliega nada`, async ({ page }) => {
      await page.setViewportSize(viewport);
      await page.goto('/');
      const box = page.getByRole('combobox', { name: /Buscar por provincia/ }).first();
      await box.fill(CP);
      await box.press('Enter');
      await expect(map(page)).toHaveAttribute('data-ready', 'true');
      await page.waitForTimeout(900);
      const canvas = (await map(page).boundingBox())!;
      await mouseDrag(
        page,
        { x: canvas.x + canvas.width / 2, y: canvas.y + canvas.height / 2 },
        -60,
        40,
      );
      await expect(page.getByTestId('sheet-restore')).toHaveCount(0);
      await expect(page.locator('section.bottom-sheet')).toHaveCount(0);
    });
  }
});
