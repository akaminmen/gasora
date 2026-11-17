import AxeBuilder from '@axe-core/playwright';
import { expect, test } from './fixtures';

/**
 * Texto del HTML inicial de la portada (el que ven los rastreadores y quien no ejecuta JavaScript),
 * en Chromium, Firefox y WebKit: sin infracciones de axe, sin desbordes en 320–1440 px, en claro y
 * oscuro, y con teclado. Con JavaScript este texto está oculto (`.js .static-intro`) y la aplicación
 * lo sustituye; aquí se bloquean los scripts de la aplicación y se quita la marca `js` para medirlo.
 */
const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

async function showStaticText(page: import('@playwright/test').Page, theme?: 'light' | 'dark') {
  if (theme) await page.addInitScript((t) => localStorage.setItem('gasora:theme:v1', t), theme);
  await page.route('**/assets/*.js', (route) => route.abort());
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => document.documentElement.classList.remove('js'));
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
}

for (const theme of ['light', 'dark'] as const) {
  test(`texto inicial, tema ${theme}: axe sin infracciones`, async ({ page }) => {
    await showStaticText(page, theme);
    const { violations } = await new AxeBuilder({ page }).withTags(TAGS).analyze();
    expect(
      violations.map((v) => ({
        id: v.id,
        nodes: v.nodes.slice(0, 3).map((n) => `${n.target.join(' ')} → ${n.failureSummary}`),
      })),
    ).toEqual([]);
  });

  for (const width of [320, 390, 768, 1440]) {
    test(`texto inicial, tema ${theme} a ${width} px: cabe sin desbordes`, async ({ page }) => {
      await page.setViewportSize({ width, height: 800 });
      await showStaticText(page, theme);
      const { scroll, inner, right } = await page.evaluate(() => ({
        scroll: document.documentElement.scrollWidth,
        inner: innerWidth,
        right: Math.max(
          ...[...document.querySelectorAll('.static-intro *')].map(
            (el) => el.getBoundingClientRect().right,
          ),
        ),
      }));
      expect(scroll).toBeLessThanOrEqual(inner);
      expect(right).toBeLessThanOrEqual(inner);
    });
  }
}

test('con JavaScript el texto inicial no se ve ni está en el árbol de accesibilidad mientras llega la aplicación', async ({
  page,
}) => {
  await page.route('**/assets/*.js', (route) => route.abort());
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('.static-intro')).toBeHidden();
  await expect(page.getByRole('heading', { level: 1 })).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Instalar' })).toHaveCount(0);
});

test('con el teclado se llega a los enlaces del texto inicial, con foco visible', async ({
  page,
  browserName,
}) => {
  // Safari no tabula enlaces por defecto (hay que usar Opción+Tab): lo mismo que en keyboard.spec.ts
  test.skip(browserName === 'webkit', 'Safari no enfoca enlaces con Tab por defecto');
  await showStaticText(page);
  const names: string[] = [];
  for (let i = 0; i < 4; i++) {
    await page.keyboard.press('Tab');
    const info = await page.evaluate(() => {
      const el = document.activeElement as HTMLElement | null;
      const style = el ? getComputedStyle(el) : null;
      return {
        text: el?.textContent?.trim() ?? '',
        inside: !!el?.closest('.static-intro'),
        outline: style
          ? style.outlineStyle !== 'none' && parseFloat(style.outlineWidth) > 0
          : false,
      };
    });
    if (info.inside) {
      names.push(info.text);
      expect(info.outline, info.text).toBe(true);
    }
  }
  expect(names).toEqual(['Favoritos', 'Calculadora de ahorro', 'Instalar', 'Acerca de']);
});
