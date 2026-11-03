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
        await page.emulateMedia({ reducedMotion: 'reduce' });
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

/** Estados nuevos de la Fase 3: resultados, sugerencias abiertas y pasos del flujo de ubicación. */
const fakePermission = (s: string) => {
  navigator.permissions.query = () =>
    Promise.resolve({ state: s, onchange: null } as PermissionStatus);
};

async function expectNoViolations(page: import('@playwright/test').Page) {
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

for (const theme of ['light', 'dark'] as const) {
  for (const width of [390, 1440]) {
    test.describe(`axe, estados de búsqueda a ${width} px, tema ${theme}`, () => {
      test.use({ geolocation: { latitude: 36.7213, longitude: -4.4214 } });
      test.beforeEach(async ({ page }) => {
        await page.setViewportSize({ width, height: 900 });
        await page.emulateMedia({ reducedMotion: 'reduce' });
        await page.addInitScript((t) => localStorage.setItem('gasora:theme:v1', t), theme);
      });

      test('sugerencias abiertas', async ({ page }) => {
        await page.goto('/');
        await page.getByRole('combobox').first().fill('malag');
        await expect(page.getByRole('option').first()).toBeVisible();
        await expectNoViolations(page);
      });

      test('resultados con el filtro de marcas abierto', async ({ page }) => {
        await page.goto('/');
        const box = page.getByRole('combobox').first();
        await box.fill('malag');
        await box.press('Enter');
        await page.getByRole('button', { name: /^Marcas/ }).click();
        await expect(page.getByRole('group', { name: 'Marcas' })).toBeVisible();
        await expectNoViolations(page);
      });

      for (const [name, state, heading] of [
        ['explicación previa', 'prompt', 'Encuentra la gasolina más barata a tu alrededor'],
        ['permiso denegado', 'denied', 'Sin problema, busca por zona'],
      ] as const) {
        test(name, async ({ page }) => {
          await page.addInitScript(fakePermission, state);
          await page.goto('/');
          await page.getByRole('button', { name: 'Usar mi ubicación' }).click();
          await expect(page.getByRole('heading', { name: heading })).toBeVisible();
          await expectNoViolations(page);
        });
      }

      test('sin resultados', async ({ page, context }) => {
        await context.grantPermissions(['geolocation']);
        await context.setGeolocation({ latitude: 37.5, longitude: -9.5 });
        await page.goto('/');
        await page.getByRole('button', { name: 'Usar mi ubicación' }).click();
        await expect(
          page.getByRole('heading', { name: 'No encontramos gasolineras aquí' }),
        ).toBeVisible();
        await expectNoViolations(page);
      });
    });
  }
}
