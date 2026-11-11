import type { Page } from '@playwright/test';
import { BIG_CP } from './data';
import { expect, test } from './fixtures';
import { waitForMap } from './map-support';

/**
 * Vista móvil de resultados (iPhone 11 Pro, WebKit): sin solapes entre el botón Mapa/Lista y los
 * chips, orden una sola vez, sin hueco sobre la barra inferior y sin que la página se desplace.
 */
const SNAPS = ['compacta', 'intermedia', 'expandida'] as const;

async function open(
  page: Page,
  width: number,
  height: number,
  scale = 100,
  theme: 'light' | 'dark' = 'light',
) {
  await page.setViewportSize({ width, height });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.addInitScript((t) => localStorage.setItem('gasora:theme:v1', t), theme);
  await page.goto('/');
  const box = page.getByRole('combobox', { name: /Buscar por provincia/ }).first();
  await box.fill(BIG_CP);
  await box.press('Enter');
  await waitForMap(page);
  if (scale !== 100)
    await page.evaluate((s) => (document.documentElement.style.fontSize = `${s}%`), scale);
}

async function goTo(page: Page, target: (typeof SNAPS)[number]) {
  const handle = page.getByRole('button', { name: /Cambiar la altura de la hoja/ });
  for (let i = 0; i < 3 && !(await handle.getAttribute('aria-label'))?.includes(target); i++)
    await handle.click();
  await page.waitForTimeout(250);
}

const rect = (page: Page, selector: string) =>
  page
    .locator(selector)
    .first()
    .evaluate((el) => {
      const b = el.getBoundingClientRect();
      return { l: b.left, t: b.top, r: b.right, b: b.bottom };
    });

const overlap = (
  a: { l: number; t: number; r: number; b: number },
  b: { l: number; t: number; r: number; b: number },
) => a.l < b.r - 0.5 && b.l < a.r - 0.5 && a.t < b.b - 0.5 && b.t < a.b - 0.5;

for (const width of [320, 360, 375, 390, 414]) {
  for (const snap of SNAPS) {
    test(`${width} px, hoja ${snap}: el botón Mapa/Lista no tapa los chips ni el buscador`, async ({
      page,
    }) => {
      await open(page, width, 700);
      await goTo(page, snap);
      const toggle = await rect(page, '[data-testid="sheet-toggle"]');
      const chips = await page
        .locator('[aria-label="Tipo de combustible"] button')
        .evaluateAll((els) =>
          els.map((el) => {
            const b = el.getBoundingClientRect();
            return { l: b.left, t: b.top, r: b.right, b: b.bottom };
          }),
        );
      for (const [i, chip] of chips.entries())
        expect(overlap(toggle, chip), `chip ${i + 1}`).toBe(false);
      expect(overlap(toggle, await rect(page, 'form[role="search"]'))).toBe(false);
      expect(toggle.r).toBeLessThanOrEqual(width + 0.5);
    });
  }
}

for (const [width, height] of [
  [375, 635],
  [375, 812],
  [320, 568],
  [414, 715],
] as const) {
  // Con el texto al 200 % y menos de ~800 px de alto, los chips flotantes pisan el asa de la hoja
  // expandida (límite anterior, documentado en STATUS): solo se mide al 200 % con el alto del iPhone
  for (const scale of height >= 800 ? [100, 200] : [100]) {
    for (const snap of SNAPS) {
      test(`${width}×${height}, texto ${scale} %, hoja ${snap}: buscador visible, sin hueco sobre la barra y sin scroll de página`, async ({
        page,
      }) => {
        await open(page, width, height, scale);
        await goTo(page, snap);
        const header = await rect(page, 'header');
        const search = await rect(page, 'form[role="search"]');
        expect(search.t, 'buscador bajo la cabecera').toBeGreaterThanOrEqual(header.b - 0.5);
        const nav = await rect(page, 'nav.fixed');
        const sheet = await rect(page, 'section.bottom-sheet');
        expect(
          Math.abs(sheet.b - nav.t),
          'hueco entre la hoja y la barra inferior',
        ).toBeLessThanOrEqual(1);
        const doc = await page.evaluate(() => ({
          scrollH: document.documentElement.scrollHeight,
          h: innerHeight,
          y: scrollY,
        }));
        expect(doc.scrollH).toBeLessThanOrEqual(doc.h);
        expect(doc.y).toBe(0);
      });
    }
  }
}

test('el orden no se repite en ninguna altura de la hoja', async ({ page }) => {
  await open(page, 375, 700);
  for (const snap of SNAPS) {
    await goTo(page, snap);
    await expect(page.getByRole('group', { name: 'Ordenar por' })).toHaveCount(1);
  }
});

test('la raíz usa el viewport dinámico (dvh), no el grande (vh) de Safari', async ({ page }) => {
  await open(page, 375, 700);
  const css = await page.evaluate(async () => {
    const href = document.querySelector<HTMLLinkElement>('link[rel="stylesheet"]')?.href ?? '';
    const text = await (await fetch(href)).text();
    return /\.app-root\{[^}]*min-height:100dvh/.test(text);
  });
  expect(css).toBe(true);
  expect(await page.locator('.app-root').count()).toBe(1);
});
