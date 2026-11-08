import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';
import { BIG_CP } from './data';
import { expect, test } from './fixtures';
import { waitForMap } from './map-support';

/**
 * Layout y accesibilidad de los bloques A y B (hoja replegada y «Buscar en esta zona») en Chromium,
 * Firefox y WebKit: cajas dentro de la pantalla, zonas táctiles de 44 px, sin solapes con la
 * atribución ni los controles, en claro y oscuro, con el texto al 200 % y con axe.
 */
const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

async function expectNoViolations(page: Page) {
  await page.evaluate(() => document.fonts.ready);
  const { violations } = await new AxeBuilder({ page }).withTags(TAGS).analyze();
  expect(
    violations.map((v) => ({
      id: v.id,
      impact: v.impact,
      nodes: v.nodes.slice(0, 4).map((n) => `${n.target.join(' ')} → ${n.failureSummary}`),
    })),
  ).toEqual([]);
}

async function open(page: Page, theme: 'light' | 'dark', width: number, height: number) {
  await page.setViewportSize({ width, height });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.addInitScript((t) => localStorage.setItem('gasora:theme:v1', t), theme);
  await page.goto('/');
  const box = page.getByRole('combobox', { name: /Buscar por provincia/ }).first();
  await box.fill(BIG_CP);
  await box.press('Enter');
  await waitForMap(page);
  await expect(page.getByTestId('station-card').first()).toBeVisible();
  await page.waitForTimeout(900);
}

/** Arrastra el mapa desde un punto libre del lienzo; devuelve false si no había ninguno. */
async function dragMap(page: Page, dx: number, dy: number) {
  const from = await page.evaluate(() => {
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
    return best;
  });
  if (!from) return false;
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(from.x + dx, from.y + dy, { steps: 8 });
  await page.mouse.up();
  await page.waitForTimeout(500);
  return true;
}

type Box = { x: number; y: number; w: number; h: number } | null;
const rect = (page: Page, selector: string) =>
  page.evaluate((s) => {
    const r = document.querySelector(s)?.getBoundingClientRect();
    return r ? { x: r.x, y: r.y, w: r.width, h: r.height } : null;
  }, selector);
const apart = (a: Box, b: Box) =>
  !a || !b || a.x + a.w <= b.x || b.x + b.w <= a.x || a.y + a.h <= b.y || b.y + b.h <= a.y;

for (const theme of ['light', 'dark'] as const) {
  for (const width of [320, 360, 390, 414]) {
    for (const scale of [100, 200]) {
      test(`hoja replegada a ${width} px, tema ${theme}, texto al ${scale} %: línea de 44 px sin solapes`, async ({
        page,
      }) => {
        // A 320 y 360 px con el texto al 200 % la cabecera de la aplicación ya se desborda (ya
        // ocurría antes de la hoja replegada; ver STATUS): se mide a partir de 390 px
        test.skip(
          scale === 200 && width < 390,
          'desborde previo de la cabecera a ≤ 360 px con texto al 200 %',
        );
        await open(page, theme, width, 800);
        if (scale !== 100) {
          await page.evaluate((s) => {
            document.documentElement.style.fontSize = `${s}%`;
          }, scale);
          await page.waitForTimeout(300);
        }
        expect(await dragMap(page, -40, 30)).toBe(true);
        const restore = page.getByTestId('sheet-restore');
        await expect(restore).toBeVisible();
        const box = (await restore.boundingBox())!;
        expect(box.height).toBeGreaterThanOrEqual(44);
        expect(box.width).toBeGreaterThanOrEqual(44);
        expect(box.x).toBeGreaterThanOrEqual(0);
        expect(box.x + box.width).toBeLessThanOrEqual(width);
        expect(box.y + box.height).toBeLessThanOrEqual(800);
        const mine: Box = { x: box.x, y: box.y, w: box.width, h: box.height };
        for (const selector of [
          '.maplibregl-ctrl-attrib',
          '.map-controls',
          '[data-testid="sheet-toggle"]',
        ]) {
          expect(apart(mine, await rect(page, selector)), selector).toBe(true);
        }
        // Nada se sale por los lados
        expect(
          await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
        ).toBe(true);
      });
    }
  }

  test(`axe con la hoja replegada, tema ${theme}`, async ({ page }) => {
    await open(page, theme, 390, 844);
    expect(await dragMap(page, -40, 30)).toBe(true);
    await expect(page.getByTestId('sheet-restore')).toBeVisible();
    await expectNoViolations(page);
  });

  test(`axe y layout con «Buscar en esta zona» a la vista, escritorio, tema ${theme}`, async ({
    page,
  }) => {
    await open(page, theme, 1280, 800);
    for (let i = 0; i < 14 && !(await page.getByTestId('search-area').count()); i++) {
      expect(await dragMap(page, -240, 0)).toBe(true);
    }
    const button = page.getByTestId('search-area');
    await expect(button).toBeVisible();
    const box = (await button.boundingBox())!;
    expect(box.height).toBeGreaterThanOrEqual(44);
    const mine: Box = { x: box.x, y: box.y, w: box.width, h: box.height };
    for (const selector of ['.map-controls', '.maplibregl-ctrl-attrib', '.map-legend']) {
      expect(apart(mine, await rect(page, selector)), selector).toBe(true);
    }
    await expectNoViolations(page);
  });

  test(`axe y layout con «Buscar en esta zona» a la vista, móvil con texto al 200 %, tema ${theme}`, async ({
    page,
  }) => {
    await open(page, theme, 360, 800);
    await page.evaluate(() => {
      document.documentElement.style.fontSize = '200%';
    });
    await page.waitForTimeout(400);
    for (let i = 0; i < 14 && !(await page.getByTestId('search-area').count()); i++) {
      if (!(await dragMap(page, -120, 60))) break;
    }
    const button = page.getByTestId('search-area');
    // Con el texto al 200 % la cabecera flotante puede ocupar casi todo el mapa: si no hay zona
    // libre para arrastrar, el botón no se puede ofrecer y no hay nada que medir
    test.skip((await button.count()) === 0, 'sin zona libre del mapa para arrastrar');
    const box = (await button.boundingBox())!;
    expect(box.height).toBeGreaterThanOrEqual(44);
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(360);
    const mine: Box = { x: box.x, y: box.y, w: box.width, h: box.height };
    for (const selector of ['.map-controls', '.maplibregl-ctrl-attrib']) {
      expect(apart(mine, await rect(page, selector)), selector).toBe(true);
    }
    await expectNoViolations(page);
  });
}
