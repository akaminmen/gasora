import AxeBuilder from '@axe-core/playwright';
import { BIG_CP, someStation } from './data';
import { expect, test } from './fixtures';

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
        // En móvil, el radio y las marcas solo aparecen con la hoja expandida
        if (width < 640) await page.getByTestId('sheet-toggle').click();
        await page.getByRole('button', { name: /^Marcas/ }).click();
        // En móvil es un diálogo modal; en tablet y escritorio, un desplegable
        await expect(
          width < 640
            ? page.getByRole('dialog', { name: 'Marcas' })
            : page.getByRole('group', { name: 'Marcas' }),
        ).toBeVisible();
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

/** Fase 5: favoritos con contenido, calculadora con resultado y ficha de una estación. */
for (const theme of ['light', 'dark'] as const) {
  for (const width of [390, 1440]) {
    test.describe(`axe, pantallas de la Fase 5 a ${width} px, tema ${theme}`, () => {
      test.beforeEach(async ({ page }) => {
        await page.setViewportSize({ width, height: 900 });
        await page.emulateMedia({ reducedMotion: 'reduce' });
        await page.addInitScript(
          ([t, id]) => {
            localStorage.setItem('gasora:theme:v1', t as string);
            localStorage.setItem('gasora:favorites:v1', JSON.stringify([id, '99999999']));
          },
          [theme, someStation().id],
        );
      });

      test('favoritos con una estación y una que ya no existe', async ({ page }) => {
        await page.goto('/favoritos');
        await expect(page.getByTestId('favorites-list')).toBeVisible();
        await expectNoViolations(page);
      });

      test('calculadora con resultado', async ({ page }) => {
        await page.goto('/');
        const box = page.getByRole('combobox', { name: /Buscar por provincia/ }).first();
        await box.fill(BIG_CP);
        await box.press('Enter');
        await expect(page.getByTestId('station-card').first()).toBeVisible();
        await page
          .getByRole('navigation', { name: 'Principal' })
          .filter({ visible: true })
          .getByRole('link', { name: 'Calculadora' })
          .click();
        await expect(page.getByTestId('calc-result')).toBeVisible();
        await expectNoViolations(page);
      });

      test('ficha de una estación', async ({ page }) => {
        await page.goto(`/e/${someStation().id}`);
        await expect(page.getByTestId('station-detail')).toBeVisible();
        await expectNoViolations(page);
      });

      test('ficha de una estación que no existe', async ({ page }) => {
        await page.goto('/e/99999999');
        await expect(page.getByRole('heading', { name: /ya no está disponible/ })).toBeVisible();
        await expectNoViolations(page);
      });
    });
  }
}
