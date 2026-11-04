import { expect, test } from './fixtures';
import type { Page } from '@playwright/test';
import { BIG_CP, someStation } from './data';

/**
 * Teclado (Fase 6): Esc y trampa de foco en los desplegables, foco al cambiar de pantalla, enlace
 * de salto y foco visible en cada parada de tabulación. La prueba con lector de pantalla y el
 * recorrido completo a mano los hace el usuario (lista en docs/STATUS.md).
 * Se ejecuta en Chromium, Firefox y WebKit.
 */
test.use({ viewport: { width: 1440, height: 900 } });

/** Safari no pone los enlaces en el orden de tabulación por defecto (hay que activar un ajuste del sistema). */
const NO_TAB_ON_LINKS = 'WebKit no tabula por enlaces y botones por defecto (ajuste de Safari)';

const search = (page: Page) => page.getByRole('combobox', { name: /Buscar por provincia/ }).first();
const active = (page: Page) =>
  page.evaluate(() => {
    const el = document.activeElement as HTMLElement | null;
    return el
      ? `${el.tagName}|${el.getAttribute('aria-label') ?? el.textContent?.trim().slice(0, 30)}`
      : '';
  });

async function results(page: Page) {
  await page.goto('/');
  await search(page).fill(BIG_CP);
  await search(page).press('Enter');
  await expect(page.getByTestId('station-card').first()).toBeVisible();
}

test.describe('desplegable de marcas', () => {
  test('Esc lo cierra y el foco vuelve al botón', async ({ page }) => {
    await results(page);
    const trigger = page.getByRole('button', { name: /^Marcas/ });
    await trigger.focus();
    await page.keyboard.press('Enter');
    await expect(trigger).toHaveAttribute('aria-expanded', 'true');
    const panel = page.getByRole('group', { name: 'Marcas' });
    await expect(panel).toBeVisible();
    // El foco entra en el desplegable
    await expect(panel.locator(':focus')).toHaveCount(1);
    await page.keyboard.press('Escape');
    await expect(panel).toHaveCount(0);
    await expect(trigger).toHaveAttribute('aria-expanded', 'false');
    await expect(trigger).toBeFocused();
  });

  test('el foco no sale mientras está abierto: Tab y Mayús+Tab dan la vuelta', async ({ page }) => {
    await results(page);
    await page.getByRole('button', { name: /^Marcas/ }).click();
    const panel = page.getByRole('group', { name: 'Marcas' });
    const inside = () => panel.locator(':focus').count();
    await expect.poll(inside).toBe(1);
    const stops = (await panel.locator('input, button').count()) + 2;
    for (let i = 0; i < stops; i++) {
      await page.keyboard.press('Tab');
      expect(await inside(), `Tab ${i + 1}`).toBe(1);
    }
    for (let i = 0; i < stops; i++) {
      await page.keyboard.press('Shift+Tab');
      expect(await inside(), `Mayús+Tab ${i + 1}`).toBe(1);
    }
    // Desde el primero, Mayús+Tab va al último («Hecho»)
    await panel.locator('input').first().focus();
    await page.keyboard.press('Shift+Tab');
    await expect(panel.getByRole('button', { name: 'Hecho' })).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(panel.locator('input').first()).toBeFocused();
  });

  test('«Hecho» y pulsar fuera lo cierran; las casillas se marcan con Espacio', async ({
    page,
  }) => {
    await results(page);
    const trigger = page.getByRole('button', { name: /^Marcas/ });
    await trigger.click();
    const panel = page.getByRole('group', { name: 'Marcas' });
    await panel.locator('input').first().focus();
    await page.keyboard.press('Space');
    await expect(page.getByRole('button', { name: 'Marcas (1)' })).toBeVisible();
    await panel.getByRole('button', { name: 'Hecho' }).press('Enter');
    await expect(panel).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Marcas (1)' })).toBeFocused();

    await page.getByRole('button', { name: 'Marcas (1)' }).click();
    await expect(panel).toBeVisible();
    await page.getByTestId('results-title').click();
    await expect(panel).toHaveCount(0);
  });
});

test.describe('menú «Cómo llegar»', () => {
  test('Esc lo cierra, el foco da la vuelta y vuelve al botón', async ({ page, browserName }) => {
    test.skip(browserName === 'webkit', NO_TAB_ON_LINKS);
    await page.goto(`/e/${someStation().id}`);
    const trigger = page.getByRole('button', { name: 'Cómo llegar' });
    await trigger.focus();
    await page.keyboard.press('Enter');
    await expect(trigger).toHaveAttribute('aria-expanded', 'true');
    const menu = page.getByRole('list', { name: 'Abrir en' });
    await expect(menu.getByRole('link', { name: 'Google Maps' })).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(menu.getByRole('link', { name: 'Apple Maps' })).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(menu.getByRole('link', { name: 'Waze' })).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(menu.getByRole('link', { name: 'Google Maps' })).toBeFocused(); // da la vuelta
    await page.keyboard.press('Shift+Tab');
    await expect(menu.getByRole('link', { name: 'Waze' })).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(menu).toHaveCount(0);
    await expect(trigger).toBeFocused();
    await expect(trigger).toHaveAttribute('aria-expanded', 'false');
  });

  test('pulsar fuera lo cierra', async ({ page }) => {
    await page.goto(`/e/${someStation().id}`);
    await page.getByRole('button', { name: 'Cómo llegar' }).click();
    const menu = page.getByRole('list', { name: 'Abrir en' });
    await expect(menu).toBeVisible();
    await page.getByRole('heading', { level: 2 }).first().click();
    await expect(menu).toHaveCount(0);
  });

  test('en la ficha lateral del mapa también', async ({ page }) => {
    await results(page);
    await page.getByTestId('station-card').first().locator('.station-card__link').click();
    const trigger = page.getByRole('button', { name: 'Cómo llegar' });
    await trigger.click();
    const menu = page.getByRole('list', { name: 'Abrir en' });
    await expect(menu).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(menu).toHaveCount(0);
    await expect(trigger).toBeFocused();
  });
});

test.describe('foco y enlace de salto', () => {
  test('al cambiar de pantalla el foco pasa al contenido', async ({ page, browserName }) => {
    test.skip(browserName === 'webkit', NO_TAB_ON_LINKS);
    await page.goto('/');
    await page
      .getByRole('navigation', { name: 'Principal' })
      .first()
      .getByRole('link', { name: 'Favoritos' })
      .click();
    await expect(page.getByRole('heading', { level: 1, name: 'Favoritos' })).toBeVisible();
    expect(await page.evaluate(() => document.activeElement?.id)).toBe('contenido');
    // Y el siguiente Tab sigue dentro de la pantalla nueva, no vuelve a la cabecera
    await page.keyboard.press('Tab');
    expect(await page.evaluate(() => !!document.activeElement?.closest('main'))).toBe(true);
  });

  test('«Saltar al contenido» es lo primero al tabular y lleva al contenido', async ({
    page,
    browserName,
  }) => {
    test.skip(browserName === 'webkit', NO_TAB_ON_LINKS);
    await page.goto('/acerca');
    await page.keyboard.press('Tab');
    const skip = page.getByRole('link', { name: 'Saltar al contenido' });
    await expect(skip).toBeFocused();
    await expect(skip).toBeInViewport();
    await page.keyboard.press('Enter');
    expect(await page.evaluate(() => document.activeElement?.id)).toBe('contenido');
  });
});

/**
 * Foco visible: cada parada de tabulación muestra un indicador (contorno o sombra) en el propio
 * elemento, en su pseudoelemento (tarjetas) o en un ancestro cercano (campos de búsqueda).
 */
async function visibleFocus(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const has = (style: CSSStyleDeclaration) =>
      (style.outlineStyle !== 'none' && Number.parseFloat(style.outlineWidth) > 0) ||
      (style.boxShadow !== 'none' && style.boxShadow !== '');
    const el = document.activeElement as HTMLElement | null;
    if (!el || el === document.body) return [];
    let node: HTMLElement | null = el;
    for (let i = 0; i < 4 && node; i++) {
      if (has(getComputedStyle(node)) || has(getComputedStyle(node, '::after'))) return [];
      node = node.parentElement;
    }
    return [
      `${el.tagName} «${el.getAttribute('aria-label') ?? el.textContent?.trim().slice(0, 25)}»`,
    ];
  });
}

for (const [name, open] of [
  ['inicio', async (page: Page) => page.goto('/')],
  ['resultados', results],
  ['favoritos', async (page: Page) => page.goto('/favoritos')],
  ['calculadora', async (page: Page) => page.goto('/calculadora')],
  ['acerca de', async (page: Page) => page.goto('/acerca')],
  ['ficha', async (page: Page) => page.goto(`/e/${someStation().id}`)],
] as const) {
  test(`recorrido con Tab por ${name}: cada parada tiene foco visible y no hay trampas`, async ({
    page,
    browserName,
  }) => {
    test.skip(browserName === 'webkit', NO_TAB_ON_LINKS);
    await open(page);
    const seen = new Set<string>();
    const missing: string[] = [];
    let left = 0;
    for (let i = 0; i < 90; i++) {
      await page.keyboard.press('Tab');
      const now = await active(page);
      if (now === 'BODY|') {
        left += 1; // el foco salió de la página (a la barra del navegador)
        if (left > 1) break;
        continue;
      }
      seen.add(now);
      missing.push(...(await visibleFocus(page)));
    }
    expect(missing, 'paradas sin indicador de foco').toEqual([]);
    // Recorre bastantes elementos distintos: ninguna trampa que lo deje atascado
    expect(seen.size).toBeGreaterThanOrEqual(6);
  });
}
