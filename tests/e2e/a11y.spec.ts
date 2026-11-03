import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

/** Accesibilidad automática (WCAG 2.2 AA) en la galería y en las pantallas, en claro y oscuro. */
const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];
const PAGES = ['/ui-kit', '/', '/favoritos', '/calculadora', '/acerca', '/e/4375'];

for (const theme of ['light', 'dark'] as const) {
  for (const width of [390, 1440]) {
    for (const path of PAGES) {
      test(`axe: ${path} a ${width} px, tema ${theme}`, async ({ page }) => {
        await page.setViewportSize({ width, height: 900 });
        await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' });
        await page.addInitScript((t) => localStorage.setItem('gasora:theme:v1', t), theme);
        await page.goto(path);
        await expect(page.locator('main')).toBeVisible();
        await page.evaluate(() => document.fonts.ready);
        const { violations } = await new AxeBuilder({ page }).withTags(TAGS).analyze();
        expect(
          violations.map((v) => ({
            id: v.id,
            impact: v.impact,
            nodes: v.nodes.slice(0, 4).map((n) => `${n.target.join(' ')} → ${n.failureSummary}`),
          })),
        ).toEqual([]);
      });
    }
  }
}
