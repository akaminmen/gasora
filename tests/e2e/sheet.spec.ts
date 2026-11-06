import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect, test } from './fixtures';
import type { Locator, Page } from '@playwright/test';

/**
 * Hoja inferior móvil (Fase 4b): tres alturas, arrastre, teclado, zonas táctiles, movimiento
 * reducido y gestos del mapa. Los gestos táctiles reales (dedo) no se pueden reproducir en
 * Chromium sin interfaz: se prueban con eventos de puntero de tipo «touch» y con ratón.
 */
const DATA = resolve(import.meta.dirname, '../../dist/data');
const index = JSON.parse(readFileSync(resolve(DATA, 'search-index.json'), 'utf8')) as {
  postalCodes: { code: string; count: number }[];
};
const BIG_CP = [...index.postalCodes].sort((a, b) => b.count - a.count)[0];
if (!BIG_CP) throw new Error('El índice no tiene códigos postales');
const CP = BIG_CP.code;

test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });

const sheet = (page: Page) => page.locator('section.bottom-sheet');
const handle = (page: Page) => page.getByRole('button', { name: /Cambiar la altura de la hoja/ });
const map = (page: Page) => page.getByTestId('map');

async function open(page: Page) {
  await page.goto('/');
  const box = page.getByRole('combobox', { name: /Buscar por provincia/ }).first();
  await box.fill(CP);
  await box.press('Enter');
  await expect(map(page)).toHaveAttribute('data-ready', 'true');
  await expect(sheet(page)).toBeVisible();
}

const height = async (page: Page) => (await sheet(page).boundingBox())?.height ?? 0;
const snapOf = (page: Page) => sheet(page).getAttribute('data-snap');

/** Arrastre con eventos de puntero táctiles sobre el asa, de `from` a `to` (coordenadas de página). */
async function touchDrag(handleEl: Locator, dy: number, fast = false) {
  await handleEl.evaluate(
    async (el, { dy, fast }) => {
      const rect = el.getBoundingClientRect();
      const x = rect.x + rect.width / 2;
      const y = rect.y + rect.height / 2;
      const fire = (type: string, yy: number) =>
        el.dispatchEvent(
          new PointerEvent(type, {
            pointerId: 7,
            pointerType: 'touch',
            isPrimary: true,
            clientX: x,
            clientY: yy,
            bubbles: true,
            cancelable: true,
          }),
        );
      const steps = 10;
      fire('pointerdown', y);
      for (let i = 1; i <= steps; i++) {
        fire('pointermove', y + (dy * i) / steps);
        await new Promise((r) => setTimeout(r, fast ? 3 : 40));
      }
      fire('pointerup', y + dy);
    },
    { dy, fast },
  );
}

test.describe('tres alturas', () => {
  test('el asa cambia de compacta a intermedia, a expandida y vuelve a compacta', async ({
    page,
  }) => {
    await open(page);
    const seen: [string | null, number][] = [];
    for (let i = 0; i < 4; i++) {
      await page.waitForTimeout(450); // termina la transición
      seen.push([await snapOf(page), Math.round(await height(page))]);
      await handle(page).click();
    }
    expect(seen.map(([s]) => s)).toEqual(['mid', 'full', 'compact', 'mid']);
    const [mid, full, compact] = seen.map(([, h]) => h) as [number, number, number];
    expect(compact).toBe(180);
    expect(mid).toBeGreaterThan(compact + 100);
    expect(full).toBeGreaterThan(mid + 60);
  });

  test('expandida deja libres el buscador y los chips; compacta deja ver el mapa', async ({
    page,
  }) => {
    await open(page);
    await handle(page).click(); // mid → full
    await expect.poll(() => snapOf(page)).toBe('full');
    await page.waitForTimeout(450);
    const top = (await sheet(page).boundingBox())?.y ?? 0;
    const chips = await page.getByRole('group', { name: 'Tipo de combustible' }).boundingBox();
    const search = await page.getByRole('combobox', { name: /Buscar por provincia/ }).boundingBox();
    expect(top).toBeGreaterThanOrEqual((chips?.y ?? 0) + (chips?.height ?? 0) - 0.5);
    expect(top).toBeGreaterThanOrEqual((search?.y ?? 0) + (search?.height ?? 0));
  });

  test('la hoja termina justo encima de la navegación inferior', async ({ page }) => {
    await open(page);
    await page.waitForTimeout(450);
    const s = await sheet(page).boundingBox();
    const nav = await page.getByRole('navigation', { name: 'Principal' }).last().boundingBox();
    expect(Math.round((s?.y ?? 0) + (s?.height ?? 0))).toBeLessThanOrEqual(Math.round(nav?.y ?? 0));
  });

  test('el radio y las marcas solo aparecen con la hoja expandida', async ({ page }) => {
    await open(page);
    const radius = page.getByRole('slider', { name: /Radio/ });
    const brands = page.getByRole('button', { name: /^Marcas/ });
    await expect(radius).toHaveCount(0);
    await expect(brands).toHaveCount(0);
    await handle(page).click();
    await expect(radius).toBeVisible();
    await expect(brands).toBeVisible();
    await handle(page).click();
    await expect(radius).toHaveCount(0);
  });

  test('el botón «Lista» / «Mapa» alterna entre la hoja expandida y el mapa', async ({ page }) => {
    await open(page);
    const toggle = page.getByTestId('sheet-toggle');
    await expect(toggle).toHaveText('Lista');
    await toggle.click();
    await expect.poll(() => snapOf(page)).toBe('full');
    await expect(toggle).toHaveText('Mapa');
    await toggle.click();
    await expect.poll(() => snapOf(page)).toBe('compact');
    await expect(toggle).toHaveText('Lista');
    const box = await toggle.boundingBox();
    expect(box?.height).toBeGreaterThanOrEqual(44);
  });
});

test.describe('arrastre', () => {
  test('arrastrar el asa hacia arriba con el dedo expande la hoja y hacia abajo la compacta', async ({
    page,
  }) => {
    await open(page);
    await touchDrag(handle(page), -400);
    await expect.poll(() => snapOf(page)).toBe('full');
    await page.waitForTimeout(450);
    await touchDrag(handle(page), 600);
    await expect.poll(() => snapOf(page)).toBe('compact');
  });

  test('mientras se arrastra, la altura sigue al dedo y al soltar se ajusta a una de las tres', async ({
    page,
  }) => {
    await open(page);
    const start = await height(page);
    const el = handle(page);
    const rect = await el.boundingBox();
    if (!rect) throw new Error('sin asa');
    const x = rect.x + rect.width / 2;
    const y = rect.y + rect.height / 2;
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x, y - 60, { steps: 6 });
    await expect(sheet(page)).toHaveAttribute('data-dragging', 'true');
    expect(Math.abs((await height(page)) - (start + 60))).toBeLessThan(3);
    await page.waitForTimeout(200); // parado antes de soltar: sin inercia
    await page.mouse.up();
    await expect(sheet(page)).toHaveAttribute('data-dragging', 'false');
    await page.waitForTimeout(450);
    // 404 + 60 queda más cerca de la intermedia que de la expandida
    expect(await snapOf(page)).toBe('mid');
    expect(await height(page)).toBeCloseTo(start, 0);
  });

  test('un arrastre corto desde la compacta llega a la intermedia (la inercia se prueba en unitarios)', async ({
    page,
  }) => {
    await open(page);
    await handle(page).click(); // mid → full
    await page.waitForTimeout(450);
    await handle(page).click(); // full → compact
    await page.waitForTimeout(450);
    expect(await snapOf(page)).toBe('compact');
    await touchDrag(handle(page), -120, true); // 180 + 120 = 300 px: más cerca de la intermedia
    await expect.poll(() => snapOf(page)).toBe('mid');
  });

  test('un toque sencillo en el asa no se confunde con un arrastre', async ({ page }) => {
    await open(page);
    expect(await snapOf(page)).toBe('mid');
    await handle(page).tap();
    await expect.poll(() => snapOf(page)).toBe('full');
  });

  test('desplazar la lista por dentro no mueve la hoja', async ({ page }) => {
    await open(page);
    await handle(page).click();
    await page.waitForTimeout(450);
    const before = await height(page);
    await page.getByTestId('sheet-content').evaluate((el) => (el.scrollTop = 300));
    expect(await height(page)).toBe(before);
  });
});

test.describe('teclado y accesibilidad', () => {
  test('el asa es un botón con nombre que dice la altura actual', async ({ page }) => {
    await open(page);
    await expect(handle(page)).toHaveAttribute('aria-label', /ahora intermedia/);
    await handle(page).click();
    await expect(handle(page)).toHaveAttribute('aria-label', /ahora expandida/);
  });

  test('flechas, Inicio y Fin mueven la hoja', async ({ page }) => {
    await open(page);
    await handle(page).focus();
    await page.keyboard.press('ArrowUp');
    await expect.poll(() => snapOf(page)).toBe('full');
    await page.keyboard.press('ArrowDown');
    await expect.poll(() => snapOf(page)).toBe('mid');
    await page.keyboard.press('ArrowDown');
    await expect.poll(() => snapOf(page)).toBe('compact');
    await page.keyboard.press('ArrowDown');
    await expect.poll(() => snapOf(page)).toBe('compact');
    await page.keyboard.press('End');
    await expect.poll(() => snapOf(page)).toBe('full');
    await page.keyboard.press('Home');
    await expect.poll(() => snapOf(page)).toBe('compact');
    await expect(handle(page)).toBeFocused();
  });

  test('Intro y Espacio también cambian la altura', async ({ page }) => {
    await open(page);
    await handle(page).focus();
    await page.keyboard.press('Enter');
    await expect.poll(() => snapOf(page)).toBe('full');
    await page.keyboard.press('Space');
    await expect.poll(() => snapOf(page)).toBe('compact');
  });

  test('zonas táctiles de al menos 44 px en la hoja y en los controles del mapa', async ({
    page,
  }) => {
    await open(page);
    await handle(page).click();
    await page.waitForTimeout(450);
    const small = await page.evaluate(() => {
      const s = document.querySelector('section[aria-label="Gasolineras"]');
      const controls = document.querySelector('.map-controls');
      return [
        ...(s?.querySelectorAll<HTMLElement>('button:not(.station-card__link), input') ?? []),
        ...(controls?.querySelectorAll<HTMLElement>('button') ?? []),
      ]
        .filter((el) => el.getBoundingClientRect().width > 0)
        .filter((el) => {
          const r = el.getBoundingClientRect();
          return r.height < 43.5 || (el.tagName === 'BUTTON' && r.width < 43.5);
        })
        .map(
          (el) => `${el.tagName} ${el.getAttribute('aria-label') ?? el.textContent?.slice(0, 20)}`,
        );
    });
    expect(small).toEqual([]);
  });
});

test.describe('movimiento reducido', () => {
  test('con «reducir movimiento» la hoja cambia de altura sin transición', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await open(page);
    const duration = await sheet(page).evaluate((el) => getComputedStyle(el).transitionDuration);
    expect(duration).toBe('0s');
    await handle(page).click();
    // Sin transición, la altura final se alcanza de inmediato (no a mitad de camino)
    expect(Math.round(await height(page))).toBeGreaterThan(500);
  });

  test('sin esa preferencia la transición dura 0,35 s', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await open(page);
    const duration = await sheet(page).evaluate((el) => getComputedStyle(el).transitionDuration);
    expect(duration).toBe('0.35s');
  });
});

test.describe('no bloquea los gestos del mapa', () => {
  test('la zona del mapa por encima de la hoja llega al lienzo, también entre los controles flotantes', async ({
    page,
  }) => {
    await open(page);
    await handle(page).click(); // full: la hoja ocupa lo máximo
    await page.waitForTimeout(450);
    const result = await page.evaluate(() => {
      const sheetEl = document.querySelector('section[aria-label="Gasolineras"]')!;
      const sheetTop = sheetEl.getBoundingClientRect().top;
      const canvas = document.querySelector('canvas.maplibregl-canvas')!.getBoundingClientRect();
      // Un punto de la franja libre, a la izquierda y entre los chips y la hoja
      const points = [[20, sheetTop - 6]] as const;
      return {
        sheetTop,
        canvasBottom: canvas.bottom,
        hits: points.map(([x, y]) => document.elementFromPoint(x, y)?.className ?? ''),
      };
    });
    expect(result.canvasBottom).toBeGreaterThan(result.sheetTop);
    for (const hit of result.hits) expect(String(hit)).toMatch(/maplibregl-canvas|maplibregl-map/);
  });

  test('arrastrar el mapa en la zona libre lo desplaza; la hoja se repliega y conserva su altura anterior', async ({
    page,
  }) => {
    await open(page);
    const before = await map(page).getAttribute('data-center');
    const sheetBefore = await height(page);
    // Con la hoja compacta, la mitad superior del mapa está libre
    await handle(page).click();
    await handle(page).click();
    await page.waitForTimeout(450);
    expect(await snapOf(page)).toBe('compact');
    await page.mouse.move(200, 300);
    await page.mouse.down();
    await page.mouse.move(120, 380, { steps: 8 });
    await page.mouse.up();
    await expect.poll(() => map(page).getAttribute('data-center')).not.toBe(before);
    // Modo exploración: la hoja se repliega, pero su altura (compacta) se recuerda
    expect(await snapOf(page)).toBe('compact');
    await expect(sheet(page)).toHaveAttribute('data-collapsed', 'true');
    expect(sheetBefore).toBeGreaterThan(0);
  });

  test('la atribución del mapa queda por encima de la hoja, en las tres alturas', async ({
    page,
  }) => {
    await open(page);
    const attribution = page.locator('.maplibregl-ctrl-attrib');
    await expect(attribution).toContainText('OpenStreetMap');
    for (let i = 0; i < 3; i++) {
      await page.waitForTimeout(450);
      const a = await attribution.boundingBox();
      const s = await sheet(page).boundingBox();
      expect((a?.y ?? 0) + (a?.height ?? 0)).toBeLessThanOrEqual((s?.y ?? 0) + 1);
      await handle(page).click();
    }
  });
});

test.describe('selección en móvil', () => {
  test('tocar un pin con la hoja compacta la sube y muestra la ficha; cerrarla vuelve a la lista', async ({
    page,
  }) => {
    await open(page);
    await handle(page).click(); // mid → full
    await handle(page).click(); // full → compact
    await page.waitForTimeout(450);
    const pin = page.getByTestId('price-pin').first();
    await expect(pin).toBeVisible();
    await pin.click();
    await expect.poll(() => snapOf(page)).toBe('mid');
    await expect(page.getByTestId('station-detail')).toBeVisible();
    await expect(pin).toHaveAttribute('aria-pressed', 'true');
    await page.getByRole('button', { name: 'Cerrar ficha' }).click();
    await expect(page.getByTestId('station-detail')).toHaveCount(0);
    await expect(page.getByTestId('station-card').first()).toBeVisible();
  });

  test('tocar una tarjeta de la lista abre la ficha en la hoja y centra el mapa', async ({
    page,
  }) => {
    await open(page);
    await page.getByTestId('station-card').nth(1).locator('.station-card__link').click();
    await expect(page.getByTestId('station-detail')).toBeVisible();
    await expect(page.locator('[data-testid="price-pin"][aria-pressed="true"]')).toHaveCount(1);
  });
});

test.describe('sin desbordes a ningún ancho', () => {
  for (const width of [320, 360, 390, 414]) {
    test(`${width} px: la pantalla de mapa no desborda y los controles flotantes caben`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 800 });
      await open(page);
      for (let i = 0; i < 3; i++) {
        await page.waitForTimeout(450);
        const overflow = await page.evaluate(
          () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
        );
        expect(overflow).toBeLessThanOrEqual(0);
        const controls = await page
          .getByRole('group', { name: 'Tipo de combustible' })
          .boundingBox();
        expect((controls?.x ?? 0) + (controls?.width ?? 0)).toBeLessThanOrEqual(width + 0.5);
        await handle(page).click();
      }
    });
  }
});
