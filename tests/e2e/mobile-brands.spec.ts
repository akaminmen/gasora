import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';
import { BIG_CP } from './data';
import { expect, test } from './fixtures';
import { waitForMap } from './map-support';

/**
 * Selector de marcas en móvil (iPhone 11 Pro, WebKit): hoja de selección modal en un portal, fuera
 * de la hoja inferior. Antes el desplegable colgaba de la cabecera de la hoja: se salía por la
 * derecha (anchura fija de 16 rem desde el botón), la hoja lo recortaba (`overflow: hidden`) y no se
 * podía desplazar con el dedo (`touch-action: none` de esa cabecera).
 */
const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];
const WIDTHS = [320, 360, 375, 414];

async function openSheet(
  page: Page,
  {
    width,
    height = 700,
    theme = 'light',
    scale = 100,
  }: { width: number; height?: number; theme?: 'light' | 'dark'; scale?: number },
) {
  await page.setViewportSize({ width, height });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.addInitScript((t) => localStorage.setItem('gasora:theme:v1', t), theme);
  await page.goto('/');
  const box = page.getByRole('combobox', { name: /Buscar por provincia/ }).first();
  await box.fill(BIG_CP);
  await box.press('Enter');
  await waitForMap(page);
  if (scale !== 100) {
    await page.evaluate((s) => {
      document.documentElement.style.fontSize = `${s}%`;
    }, scale);
  }
  // Los controles (orden y marcas) están con la hoja expandida
  const handle = page.getByRole('button', { name: /Cambiar la altura de la hoja/ });
  for (let i = 0; i < 3; i++) {
    if ((await handle.getAttribute('aria-label'))?.includes('expandida')) break;
    await handle.click();
  }
  await expect(page.getByRole('button', { name: /^Marcas/ })).toBeVisible();
}

const trigger = (page: Page) => page.getByRole('button', { name: /^Marcas/ });
const dialog = (page: Page) => page.getByRole('dialog', { name: 'Marcas' });

async function openDialog(page: Page) {
  await trigger(page).click();
  await expect(dialog(page)).toBeVisible();
}

async function expectInsideViewport(page: Page, selector: string) {
  const r = await page
    .locator(selector)
    .first()
    .evaluate((el) => {
      const b = el.getBoundingClientRect();
      return { l: b.left, t: b.top, r: b.right, b: b.bottom, w: innerWidth, h: innerHeight };
    });
  expect(r.l, `${selector} izquierda`).toBeGreaterThanOrEqual(-0.5);
  expect(r.t, `${selector} arriba`).toBeGreaterThanOrEqual(-0.5);
  expect(r.r, `${selector} derecha`).toBeLessThanOrEqual(r.w + 0.5);
  expect(r.b, `${selector} abajo`).toBeLessThanOrEqual(r.h + 0.5);
}

test.describe('diálogo de marcas en el iPhone', () => {
  for (const width of WIDTHS) {
    for (const theme of ['light', 'dark'] as const) {
      test(`${width} px, tema ${theme}: cabe en la pantalla y sus botones miden 44 px`, async ({
        page,
      }) => {
        await openSheet(page, { width, theme });
        await openDialog(page);
        await expectInsideViewport(page, '[data-testid="brand-dialog"]');
        for (const name of ['Limpiar', 'Listo', 'Cerrar sin aplicar']) {
          const box = await page.getByRole('button', { name }).boundingBox();
          expect(box?.width, name).toBeGreaterThanOrEqual(43.5);
          expect(box?.height, name).toBeGreaterThanOrEqual(43.5);
          expect(box!.x + box!.width, name).toBeLessThanOrEqual(width + 0.5);
        }
        const rows = await dialog(page)
          .locator('label')
          .evaluateAll((els) => els.map((e) => e.getBoundingClientRect().height));
        for (const h of rows) expect(h).toBeGreaterThanOrEqual(43.5);
      });
    }
  }

  for (const width of [320, 375]) {
    test(`${width} px con el texto al 200 %: sigue dentro de la pantalla y todas las marcas se alcanzan`, async ({
      page,
    }) => {
      await openSheet(page, { width, height: 700, scale: 200 });
      await openDialog(page);
      // Pantalla baja (p. ej. horizontal o con las barras de Safari): el diálogo se adapta
      await page.setViewportSize({ width, height: 400 });
      await expectInsideViewport(page, '[data-testid="brand-dialog"]');
      const list = page.getByTestId('brand-dialog-list');
      const labels = dialog(page).locator('label');
      const count = await labels.count();
      expect(count).toBeGreaterThan(2);
      // Con la fuente al 200 % la lista no cabe: hay desplazamiento interno
      expect(await list.evaluate((el) => el.scrollHeight - el.clientHeight)).toBeGreaterThan(0);
      for (let i = 0; i < count; i++) {
        await labels.nth(i).scrollIntoViewIfNeeded();
        const inside = await labels.nth(i).evaluate((el) => {
          const l = el.getBoundingClientRect();
          const c = el.closest('[data-testid="brand-dialog-list"]')!.getBoundingClientRect();
          return l.top >= c.top - 0.5 && l.bottom <= c.bottom + 0.5;
        });
        expect(inside, `marca ${i + 1} de ${count}`).toBe(true);
      }
      // Y los botones del pie siguen visibles
      await expect(page.getByRole('button', { name: 'Listo' })).toBeInViewport();
      await expectInsideViewport(page, '[data-testid="brand-dialog"]');
    });
  }

  test('desplazar el diálogo no mueve la hoja, el mapa ni la página', async ({ page }) => {
    await openSheet(page, { width: 375, height: 700, scale: 200 });
    const sheet = page.locator('section.bottom-sheet');
    const map = page.getByTestId('map');
    const before = {
      sheet: await sheet.boundingBox(),
      map: await map.boundingBox(),
      snap: await sheet.getAttribute('data-snap'),
    };
    await openDialog(page);
    await page.setViewportSize({ width: 375, height: 400 });
    const list = page.getByTestId('brand-dialog-list');
    const box = (await list.boundingBox())!;
    expect(box.height).toBeGreaterThan(0);
    // WebKit móvil no admite la rueda del ratón: se desplaza la lista directamente
    await list.evaluate((el) => el.scrollBy(0, 400));
    await expect.poll(() => list.evaluate((el) => el.scrollTop)).toBeGreaterThan(0);
    // Arrastre con eventos de puntero táctiles dentro del diálogo: la hoja no debe moverse
    await list.evaluate((el) => {
      const rect = el.getBoundingClientRect();
      const x = rect.x + rect.width / 2;
      for (const [type, y] of [
        ['pointerdown', rect.y + 60],
        ['pointermove', rect.y + 20],
        ['pointermove', rect.y - 20],
        ['pointerup', rect.y - 20],
      ] as const) {
        el.dispatchEvent(
          new PointerEvent(type, {
            pointerId: 5,
            pointerType: 'touch',
            isPrimary: true,
            clientX: x,
            clientY: y,
            bubbles: true,
            cancelable: true,
          }),
        );
      }
    });
    expect(await page.evaluate(() => scrollY)).toBe(0);
    await page.getByRole('button', { name: 'Cerrar sin aplicar' }).click();
    await expect(dialog(page)).toHaveCount(0);
    await page.setViewportSize({ width: 375, height: 700 });
    await expect.poll(async () => (await sheet.boundingBox())?.height).toBe(before.sheet?.height);
    expect(await sheet.boundingBox()).toEqual(before.sheet);
    expect(await map.boundingBox()).toEqual(before.map);
    expect(await sheet.getAttribute('data-snap')).toBe(before.snap);
  });

  test('el desplazamiento del diálogo está contenido y no se interpreta como gesto de la hoja', async ({
    page,
  }) => {
    await openSheet(page, { width: 375 });
    await openDialog(page);
    const css = await page.getByTestId('brand-dialog-list').evaluate(async (el) => {
      const s = getComputedStyle(el);
      // El WebKit de Playwright descarta overscroll-behavior al analizar el CSS (Safari ≥ 16 sí lo
      // admite): se lee la regla en el CSS publicado
      const href = document.querySelector<HTMLLinkElement>('link[rel="stylesheet"]')?.href ?? '';
      const text = await (await fetch(href)).text();
      const rule = /\.dialog-sheet__list\{[^}]*\}/.exec(text)?.[0] ?? '';
      return {
        overflowY: s.overflowY,
        touchAction: s.touchAction,
        overscrollDeclared: /overscroll-behavior:contain/.test(rule),
      };
    });
    expect(css).toEqual({ overflowY: 'auto', touchAction: 'pan-y', overscrollDeclared: true });
    // El diálogo está fuera de la hoja inferior (portal) y de cualquier ancestro que recorte o capture
    const inside = await dialog(page).evaluate(
      (el) => !!el.closest('section.bottom-sheet, .bottom-sheet__drag'),
    );
    expect(inside).toBe(false);
    // Fondo bloqueado mientras está abierto
    expect(await page.evaluate(() => getComputedStyle(document.body).overflow)).toBe('hidden');
    expect(await page.locator('#root').getAttribute('inert')).not.toBeNull();
  });

  test('foco: entra, queda atrapado, Escape cierra y vuelve al botón; el fondo se desbloquea', async ({
    page,
  }) => {
    await openSheet(page, { width: 375 });
    await openDialog(page);
    const inDialog = () =>
      page.evaluate(() => !!document.activeElement?.closest('[role="dialog"]'));
    expect(await inDialog()).toBe(true);
    for (let i = 0; i < 14; i++) {
      await page.keyboard.press('Tab');
      expect(await inDialog(), `Tab ${i + 1}`).toBe(true);
    }
    for (let i = 0; i < 14; i++) {
      await page.keyboard.press('Shift+Tab');
      expect(await inDialog(), `Mayús+Tab ${i + 1}`).toBe(true);
    }
    await page.keyboard.press('Escape');
    await expect(dialog(page)).toHaveCount(0);
    await expect(trigger(page)).toBeFocused();
    expect(await page.evaluate(() => getComputedStyle(document.body).overflow)).not.toBe('hidden');
    expect(await page.locator('#root').getAttribute('inert')).toBeNull();
  });

  test('tocar fuera cierra sin aplicar y devuelve el foco', async ({ page }) => {
    await openSheet(page, { width: 375 });
    await openDialog(page);
    await dialog(page).getByRole('checkbox').first().check();
    await expect(dialog(page).getByRole('status')).toHaveText('1 marca elegida');
    await page.getByTestId('brand-dialog-backdrop').click({ position: { x: 187, y: 20 } });
    await expect(dialog(page)).toHaveCount(0);
    await expect(trigger(page)).toBeFocused();
    await expect(trigger(page)).toHaveAccessibleName('Marcas');
  });

  test('la selección se aplica al pulsar «Listo»; «Limpiar» vacía el borrador', async ({
    page,
  }) => {
    await openSheet(page, { width: 375 });
    const items = page.getByTestId('results-list').locator('li');
    const total = await items.count();
    await openDialog(page);
    const boxes = dialog(page).getByRole('checkbox');
    // La última marca de la lista es la de menos estaciones
    const last = boxes.last();
    await last.check();
    // Mientras se elige no cambia nada por detrás
    await expect(items).toHaveCount(total);
    await expect(dialog(page).getByRole('status')).toHaveText('1 marca elegida');
    await boxes.first().check();
    await expect(dialog(page).getByRole('status')).toHaveText('2 marcas elegidas');
    await page.getByRole('button', { name: 'Limpiar' }).click();
    await expect(dialog(page).getByRole('status')).toHaveText('Ninguna marca elegida');
    await last.check();
    await page.getByRole('button', { name: 'Listo' }).click();
    await expect(dialog(page)).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Marcas (1)' })).toBeFocused();
    await expect.poll(() => items.count()).toBeLessThan(total);
    // Reabrir parte de lo aplicado
    await page.getByRole('button', { name: 'Marcas (1)' }).click();
    await expect(dialog(page).getByRole('checkbox', { checked: true })).toHaveCount(1);
  });

  test('el orden aparece una sola vez en la hoja expandida', async ({ page }) => {
    await openSheet(page, { width: 375 });
    await expect(page.getByRole('group', { name: 'Ordenar por' })).toHaveCount(1);
  });

  for (const theme of ['light', 'dark'] as const) {
    test(`axe en el diálogo (${theme})`, async ({ page }) => {
      await openSheet(page, { width: 375, theme });
      await openDialog(page);
      await page.evaluate(() => document.fonts.ready);
      const { violations } = await new AxeBuilder({ page }).withTags(TAGS).analyze();
      expect(
        violations.map((v) => ({ id: v.id, nodes: v.nodes.map((n) => n.target.join(' ')) })),
      ).toEqual([]);
    });
  }
});
