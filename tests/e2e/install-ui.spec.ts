import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';

/**
 * Layout, accesibilidad y teclado de /instalar y de la cabecera móvil con el icono de instalar
 * (Chromium, Firefox y WebKit): sin desbordes ni solapes, zonas táctiles de 44 px, claro y oscuro,
 * texto al 200 %, axe y recorrido con teclado.
 */
const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];
const HEADER_WIDTHS = [320, 360, 375, 390, 414];
const PAGE_WIDTHS = [320, 360, 375, 390, 414, 768, 1024, 1440];

async function open(
  page: Page,
  path: string,
  width: number,
  theme: 'light' | 'dark',
  scale = 100,
  height = 900,
) {
  await page.setViewportSize({ width, height });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.addInitScript((t) => localStorage.setItem('gasora:theme:v1', t), theme);
  await page.goto(path);
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  if (scale !== 100) {
    await page.evaluate((s) => {
      document.documentElement.style.fontSize = `${s}%`;
    }, scale);
  }
  await page.evaluate(() => document.fonts.ready);
}

interface Box {
  name: string;
  l: number;
  t: number;
  r: number;
  b: number;
}

async function headerBoxes(page: Page): Promise<Box[]> {
  return page.evaluate(() => {
    const header = document.querySelector('header')!;
    const items: [string, Element | null][] = [
      ['logo', header.querySelector('a[aria-label^="Gasora"]')],
      ['instalar', header.querySelector('[data-testid="header-install"]')],
      ['acerca', header.querySelector('a[aria-label="Acerca de Gasora"]')],
      ['tema', header.querySelector('button')],
    ];
    return items.flatMap(([name, el]) => {
      if (!el) return [];
      const b = el.getBoundingClientRect();
      return [{ name, l: b.left, t: b.top, r: b.right, b: b.bottom }];
    });
  });
}

for (const width of HEADER_WIDTHS) {
  for (const theme of ['light', 'dark'] as const) {
    for (const scale of [100, 200]) {
      test(`cabecera móvil a ${width} px, ${theme}, texto al ${scale} %: cabe, sin solapes y con 44 px`, async ({
        page,
        browserName,
      }) => {
        await open(page, '/', width, theme, scale);
        const boxes = await headerBoxes(page);
        expect(boxes.map((b) => b.name)).toEqual(['logo', 'instalar', 'acerca', 'tema']);
        for (const b of boxes) {
          expect(b.l, `${b.name} izquierda`).toBeGreaterThanOrEqual(-0.01);
          expect(b.r, `${b.name} derecha`).toBeLessThanOrEqual(width + 0.01);
          if (b.name !== 'logo') {
            expect(b.r - b.l, `${b.name} ancho`).toBeGreaterThanOrEqual(43.5);
            expect(b.b - b.t, `${b.name} alto`).toBeGreaterThanOrEqual(43.5);
          }
        }
        for (let i = 0; i < boxes.length; i++) {
          for (let j = i + 1; j < boxes.length; j++) {
            const a = boxes[i]!;
            const c = boxes[j]!;
            const overlaps =
              a.l < c.r - 0.01 && c.l < a.r - 0.01 && a.t < c.b - 0.01 && c.t < a.b - 0.01;
            expect(overlaps, `${a.name} y ${c.name} se solapan`).toBe(false);
          }
        }
        // La propia cabecera no desborda (el resto de la portada con texto al 200 % lo cubren otras pruebas)
        const overflow = await page.evaluate((w) => {
          const h = document.querySelector('header')!;
          const wide = [...h.querySelectorAll('*')]
            .map((el) => ({ el, r: el.getBoundingClientRect() }))
            .filter(({ r }) => r.width > 0 && r.right > w + 0.5)
            .map(
              ({ el, r }) =>
                `${el.tagName} ${el.className.toString().slice(0, 30)} r=${Math.round(r.right)}`,
            );
          return { extra: h.scrollWidth - h.clientWidth, wide };
        }, width);
        expect(overflow.wide).toEqual([]);
        // Firefox cuenta 20 px de desplazamiento sin que ningún elemento se salga (no hay nada visible
        // fuera): solo se exige el 0 en los otros motores
        if (browserName !== 'firefox') expect(overflow.extra).toBe(0);
      });
    }
  }
}

for (const width of PAGE_WIDTHS) {
  for (const theme of ['light', 'dark'] as const) {
    for (const scale of [100, 200]) {
      test(`/instalar a ${width} px, ${theme}, texto al ${scale} %: sin desbordes`, async ({
        page,
      }) => {
        // Emulado con font-size, los puntos de corte no se mueven: la cabecera de escritorio no cabe al
        // 200 % (mismo criterio que layout.spec.ts)
        test.skip(scale === 200 && width >= 1024, 'texto al 200 % emulado en escritorio');
        await open(page, '/instalar', width, theme, scale);
        expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
          width,
        );
        // Ningún elemento del contenido se sale de la columna ni de la pantalla
        const bad = await page.evaluate((w) => {
          const out: string[] = [];
          for (const el of document.querySelectorAll('main *')) {
            const b = el.getBoundingClientRect();
            if (b.width === 0 || b.height === 0) continue;
            if (b.right > w + 0.5 || b.left < -0.5)
              out.push(`${el.tagName} ${el.textContent?.slice(0, 30)}`);
            if (el.scrollWidth > el.clientWidth + 1 && getComputedStyle(el).display !== 'inline') {
              if (getComputedStyle(el).overflowX === 'visible')
                out.push(`desborde ${el.tagName} ${el.textContent?.slice(0, 30)}`);
            }
          }
          return out.slice(0, 5);
        }, width);
        expect(bad).toEqual([]);
        // Encabezados en orden: un h1 y h2 antes de h3
        const levels = await page.evaluate(() =>
          [...document.querySelectorAll('main h1, main h2, main h3')].map((h) =>
            Number(h.tagName[1]),
          ),
        );
        expect(levels.filter((l) => l === 1)).toHaveLength(1);
        for (let i = 1; i < levels.length; i++)
          expect(levels[i]! - levels[i - 1]!).toBeLessThanOrEqual(1);
      });
    }
  }
}

for (const theme of ['light', 'dark'] as const) {
  for (const width of [375, 1280]) {
    test(`axe en /instalar (${theme}, ${width} px)`, async ({ page }) => {
      await open(page, '/instalar', width, theme);
      const { violations } = await new AxeBuilder({ page }).withTags(TAGS).analyze();
      expect(
        violations.map((v) => ({
          id: v.id,
          nodes: v.nodes.map((n) => n.target.join(' ')).slice(0, 4),
        })),
      ).toEqual([]);
    });
  }
  test(`axe en la cabecera móvil con el icono (${theme})`, async ({ page }) => {
    await open(page, '/', 375, theme);
    const { violations } = await new AxeBuilder({ page }).withTags(TAGS).analyze();
    expect(violations.map((v) => v.id)).toEqual([]);
  });
}

test('teclado en /instalar: el foco recorre los enlaces con un indicador visible y no se pierde', async ({
  page,
  browserName,
}) => {
  test.skip(browserName === 'webkit', 'Safari no enfoca enlaces con Tab por defecto (Opción+Tab)');
  await open(page, '/instalar', 1280, 'light');
  const seen: string[] = [];
  for (let i = 0; i < 12; i++) {
    await page.keyboard.press('Tab');
    const info = await page.evaluate(() => {
      const el = document.activeElement as HTMLElement | null;
      if (!el || el === document.body) return null;
      const s = getComputedStyle(el);
      const visible = s.outlineStyle !== 'none' && parseFloat(s.outlineWidth) > 0;
      const wrap = el.closest('label');
      const ring =
        s.boxShadow !== 'none' || (!!wrap && getComputedStyle(wrap).boxShadow !== 'none');
      return {
        tag: el.tagName,
        label: el.getAttribute('aria-label') ?? el.textContent?.trim().slice(0, 30) ?? '',
        visible: visible || ring,
      };
    });
    if (info) {
      seen.push(info.label);
      expect(info.visible, `foco visible en «${info.label}»`).toBe(true);
    }
  }
  expect(seen.length).toBeGreaterThan(5);
});

test('teclado en móvil: el icono de instalar se alcanza con Tab y se activa con Intro', async ({
  page,
  browserName,
}) => {
  test.skip(browserName === 'webkit', 'Safari no enfoca enlaces con Tab por defecto (Opción+Tab)');
  await open(page, '/', 375, 'light');
  for (let i = 0; i < 8; i++) {
    await page.keyboard.press('Tab');
    const label = await page.evaluate(() => document.activeElement?.getAttribute('aria-label'));
    if (label === 'Instalar la aplicación') break;
  }
  await expect(page.getByRole('link', { name: 'Instalar la aplicación' })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/instalar$/);
});
