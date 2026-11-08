import { type Page } from '@playwright/test';
import { someStation, sellers } from './data';
import { expect, test } from './fixtures';
import { waitForMap } from './map-support';

/**
 * Tests de layout (sección 12 del plan). El aspecto no se revisa a ojo: se verifica
 * midiendo cajas: sin solapes, sin desbordes, precios sin recortar y zonas táctiles de
 * 44×44 px. Se ejecutan sobre /ui-kit con datos extremos (sección 9.7, regla 6): rótulo de 86
 * caracteres, dirección de 104, precio 1,999, ahorro de 3 cifras, sin ahorro y sin badge.
 */
const WIDTHS = [320, 360, 390, 414, 768, 1024, 1440];
const THEMES = ['light', 'dark'] as const;
/** Tolerancia de redondeo subpíxel; los solapes reales son de píxeles enteros. */
const EPS = 0.01;

async function openKit(page: Page, width: number, theme: 'light' | 'dark', fontScale = 100) {
  await page.setViewportSize({ width, height: 900 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.addInitScript((t) => localStorage.setItem('gasora:theme:v1', t), theme);
  await page.goto('/ui-kit');
  await expect(
    page.getByRole('heading', { name: 'Tarjeta de resultado (sección 9.7)' }),
  ).toBeVisible();
  if (fontScale !== 100) {
    // Equivale a poner la fuente del sistema al 200 %: todo el texto está en rem.
    await page.evaluate((scale) => {
      document.documentElement.style.fontSize = `${scale}%`;
    }, fontScale);
  }
  await page.evaluate(() => document.fonts.ready);
}

interface Box {
  name: string;
  left: number;
  top: number;
  right: number;
  bottom: number;
}

const overlaps = (a: Box, b: Box) =>
  a.left < b.right - EPS &&
  b.left < a.right - EPS &&
  a.top < b.bottom - EPS &&
  b.top < a.bottom - EPS;

/** Mide, para cada tarjeta, las cajas de cada pieza y devuelve los defectos encontrados. */
async function inspectCards(page: Page): Promise<string[]> {
  return page.evaluate((eps) => {
    const problems: string[] = [];
    const cards = [...document.querySelectorAll<HTMLElement>('[data-testid="station-card"]')];
    const parts: [string, string][] = [
      ['avatar', '.station-card__avatar'],
      ['nombre', '.station-card__name'],
      ['badge', '.badge-best'],
      ['distancia', '.station-card__dist'],
      ['dirección', '.station-card__addr'],
      ['ahorro', '.station-card__saving'],
      ['precio', '.station-card__price'],
      ['favorito', '.station-card__fav button'],
    ];
    cards.forEach((card, index) => {
      const label = `tarjeta ${index + 1} («${card.querySelector('.station-card__link')?.textContent?.slice(0, 20)}…»)`;
      const cardRect = card.getBoundingClientRect();
      const boxes = parts.flatMap(([name, selector]) => {
        const el = card.querySelector<HTMLElement>(selector);
        if (!el) return [];
        const r = el.getBoundingClientRect();
        return [{ name, left: r.left, top: r.top, right: r.right, bottom: r.bottom }];
      });
      for (let i = 0; i < boxes.length; i++) {
        const a = boxes[i];
        if (!a) continue;
        if (
          a.left < cardRect.left - eps ||
          a.right > cardRect.right + eps ||
          a.top < cardRect.top - eps ||
          a.bottom > cardRect.bottom + eps
        ) {
          problems.push(`${label}: «${a.name}» se sale de la tarjeta`);
        }
        for (let j = i + 1; j < boxes.length; j++) {
          const b = boxes[j];
          if (!b) continue;
          const hit =
            a.left < b.right - eps &&
            b.left < a.right - eps &&
            a.top < b.bottom - eps &&
            b.top < a.bottom - eps;
          if (hit) problems.push(`${label}: «${a.name}» se solapa con «${b.name}»`);
        }
      }
      // La distancia nunca se trunca (prioridad de la sección 9.7).
      const dist = card.querySelector<HTMLElement>('.station-card__dist');
      if (dist && dist.scrollWidth > dist.clientWidth + eps) {
        problems.push(`${label}: la distancia está truncada`);
      }
      // El precio nunca se trunca, parte ni tapa.
      const amount = card.querySelector<HTMLElement>('.station-card__amount');
      const value = card.querySelector<HTMLElement>('.station-card__value');
      const unit = card.querySelector<HTMLElement>('.station-card__unit');
      if (!amount || !value || !unit) {
        problems.push(`${label}: falta el precio`);
      } else {
        if (amount.scrollWidth > amount.clientWidth + eps)
          problems.push(`${label}: el precio desborda`);
        const v = value.getBoundingClientRect();
        const u = unit.getBoundingClientRect();
        // Misma línea: la unidad solapa en vertical con el número y empieza a su derecha
        if (u.top >= v.bottom - 1 || u.bottom <= v.top + 1 || u.left < v.right - 1)
          problems.push(`${label}: la unidad €/L se parte del número`);
        // Ningún ancestro con overflow distinto de visible recorta el precio.
        for (let node = amount.parentElement; node; node = node.parentElement) {
          const overflow = getComputedStyle(node).overflowX;
          if (overflow !== 'visible') {
            const n = node.getBoundingClientRect();
            const a = amount.getBoundingClientRect();
            if (a.left < n.left - eps || a.right > n.right + eps) {
              problems.push(`${label}: «${node.className}» recorta el precio`);
            }
          }
          if (node === document.body) break;
        }
        const a = amount.getBoundingClientRect();
        if (a.right > window.innerWidth + eps || a.left < -eps) {
          problems.push(`${label}: el precio queda fuera de la pantalla`);
        }
      }
      if (card.scrollWidth > card.clientWidth + eps)
        problems.push(`${label}: desbordamiento horizontal`);
      // El badge va en su propia línea, nunca junto al nombre.
      const badge = card.querySelector<HTMLElement>('.badge-best');
      const name = card.querySelector<HTMLElement>('.station-card__name');
      if (
        badge &&
        name &&
        badge.getBoundingClientRect().top < name.getBoundingClientRect().bottom - eps
      ) {
        problems.push(`${label}: el badge «Más barata» comparte línea con el nombre`);
      }
    });
    return problems;
  }, EPS);
}

for (const theme of THEMES) {
  for (const width of WIDTHS) {
    test.describe(`/ui-kit a ${width} px, tema ${theme}`, () => {
      test('tarjetas: sin solapes, sin desbordes y con el precio entero', async ({ page }) => {
        await openKit(page, width, theme);
        const cards = await page.locator('[data-testid="station-card"]').count();
        expect(cards).toBeGreaterThanOrEqual(8);
        expect(await inspectCards(page)).toEqual([]);
      });

      test('la página no tiene desbordamiento horizontal', async ({ page }) => {
        await openKit(page, width, theme);
        const overflow = await page.evaluate(
          () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
        );
        expect(overflow).toBeLessThanOrEqual(0);
      });

      test('pines: el precio no se recorta y los pines no se tapan entre sí', async ({ page }) => {
        await openKit(page, width, theme);
        const result = await page.evaluate((eps) => {
          const problems: string[] = [];
          const pins = [...document.querySelectorAll<HTMLElement>('[data-testid="price-pin"]')];
          const rects = pins.map((pin) => pin.getBoundingClientRect());
          pins.forEach((pin, i) => {
            // La corona y la punta son decoración fuera de la caja: se mide el texto del precio.
            const body = pin.querySelector<HTMLElement>('.price-pin__body');
            const text = pin.querySelector<HTMLElement>('[data-testid="price-pin-text"]');
            if (body && text) {
              const b = body.getBoundingClientRect();
              const x = text.getBoundingClientRect();
              if (
                text.scrollWidth > text.clientWidth + eps ||
                x.left < b.left - eps ||
                x.right > b.right + eps
              ) {
                problems.push(`pin ${i + 1}: texto recortado`);
              }
            }
            const crown = pin.querySelector<HTMLElement>('.price-pin__crown');
            const targets = [pin.getBoundingClientRect(), crown?.getBoundingClientRect()];
            for (let node = pin.parentElement; node; node = node.parentElement) {
              if (getComputedStyle(node).overflowX !== 'visible') {
                const n = node.getBoundingClientRect();
                for (const t of targets) {
                  if (
                    t &&
                    (t.left < n.left - eps || t.right > n.right + eps || t.top < n.top - eps)
                  ) {
                    problems.push(`pin ${i + 1}: lo recorta «${node.className}»`);
                  }
                }
              }
              if (node === document.body) break;
            }
          });
          for (let i = 0; i < rects.length; i++) {
            for (let j = i + 1; j < rects.length; j++) {
              const a = rects[i];
              const b = rects[j];
              if (
                a &&
                b &&
                a.left < b.right - eps &&
                b.left < a.right - eps &&
                a.top < b.bottom - eps &&
                b.top < a.bottom - eps
              ) {
                problems.push(`pines ${i + 1} y ${j + 1} se solapan`);
              }
            }
          }
          return { count: pins.length, problems };
        }, EPS);
        expect(result.count).toBeGreaterThanOrEqual(5);
        expect(result.problems).toEqual([]);
      });

      test('fichas: sin desbordes y con el precio entero', async ({ page }) => {
        await openKit(page, width, theme);
        const problems = await page.evaluate((eps) => {
          const out: string[] = [];
          const panels = [
            ...document.querySelectorAll<HTMLElement>('[data-testid="station-detail"]'),
          ];
          panels.forEach((panel, i) => {
            const p = panel.getBoundingClientRect();
            if (panel.scrollWidth > panel.clientWidth + eps)
              out.push(`ficha ${i + 1}: desbordamiento horizontal`);
            const price = panel.querySelector<HTMLElement>('[data-testid="detail-price"]');
            if (price) {
              const r = price.getBoundingClientRect();
              if (
                price.scrollWidth > price.clientWidth + eps ||
                r.right > p.right + eps ||
                r.left < p.left - eps
              ) {
                out.push(`ficha ${i + 1}: el precio se recorta o se sale`);
              }
            }
            for (const el of panel.querySelectorAll<HTMLElement>('*')) {
              const r = el.getBoundingClientRect();
              if (r.width > 0 && (r.right > p.right + eps || r.left < p.left - eps)) {
                out.push(
                  `ficha ${i + 1}: «${el.tagName.toLowerCase()}.${String(el.className).slice(0, 30)}» se sale de la ficha`,
                );
                break;
              }
            }
          });
          return { count: panels.length, out };
        }, EPS);
        expect(problems.count).toBe(2);
        expect(problems.out).toEqual([]);
      });

      test('zonas táctiles de al menos 44×44 px', async ({ page }) => {
        await openKit(page, width, theme);
        const small = await page.evaluate(() => {
          const out: string[] = [];
          const selector = 'a[href], button, input:not([type="hidden"]), select, textarea, summary';
          for (const el of document.querySelectorAll<HTMLElement>(selector)) {
            // Enlaces ocultos solo para lectores (saltar al contenido) y controles no visibles.
            const own = el.getBoundingClientRect();
            if (own.width <= 1 || own.height <= 1) continue;
            const style = getComputedStyle(el);
            if (style.visibility === 'hidden' || style.display === 'none') continue;
            // El título de la tarjeta es un enlace extendido: su zona táctil es toda la tarjeta.
            const target = el.classList.contains('station-card__link')
              ? (el.closest('.station-card') as HTMLElement)
              : (el.closest('label') ?? el);
            const r = target.getBoundingClientRect();
            if (r.width < 43.99 || r.height < 43.99) {
              out.push(
                `${el.tagName.toLowerCase()} «${(el.getAttribute('aria-label') ?? el.textContent ?? '').trim().slice(0, 30)}» mide ${r.width.toFixed(0)}×${r.height.toFixed(0)}`,
              );
            }
          }
          return out;
        });
        expect(small).toEqual([]);
      });
    });
  }
}

// Fuente del sistema al 200 % (sección 9.7, regla 6): se comprueban las tarjetas en todos los anchos.
for (const theme of THEMES) {
  for (const width of WIDTHS) {
    test(`tarjetas con la fuente al 200 % a ${width} px, tema ${theme}`, async ({ page }) => {
      await openKit(page, width, theme, 200);
      expect(await inspectCards(page)).toEqual([]);
    });
  }
}

// Las pantallas del shell no desbordan en ningún ancho ni tema.
const ROUTES = ['/', '/favoritos', '/calculadora', '/acerca', '/e/4375', '/ruta-que-no-existe'];
for (const theme of THEMES) {
  for (const width of WIDTHS) {
    test(`las pantallas no desbordan a ${width} px, tema ${theme}`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await page.addInitScript((t) => localStorage.setItem('gasora:theme:v1', t), theme);
      for (const route of ROUTES) {
        await page.goto(route);
        await expect(page.locator('main')).toBeVisible();
        await page.evaluate(() => document.fonts.ready);
        const overflow = await page.evaluate(
          () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
        );
        expect(overflow, `desbordamiento horizontal en ${route}`).toBeLessThanOrEqual(0);
      }
    });
  }
}

test('el helper de solape detecta un solape (prueba del propio test)', () => {
  const a: Box = { name: 'a', left: 0, top: 0, right: 10, bottom: 10 };
  const touching: Box = { name: 'b', left: 10, top: 0, right: 20, bottom: 10 };
  const overlapping: Box = { name: 'c', left: 9, top: 0, right: 20, bottom: 10 };
  expect(overlaps(a, touching)).toBe(false);
  expect(overlaps(a, overlapping)).toBe(true);
});

/**
 * Regresión del defecto del diseño aprobado (sección 9.7): el badge «Más barata» y el precio no
 * deben solaparse en ningún ancho de tarjeta. Se barre el ancho cada 4 px, para que los umbrales
 * de los container queries (356, 312 y 52 px + rem) queden cubiertos y no solo los anchos de
 * pantalla habituales.
 */
for (const fontScale of [100, 200]) {
  test(`barrido del ancho de tarjeta (200–480 px, de 4 en 4) con la fuente al ${fontScale} %`, async ({
    page,
  }) => {
    await openKit(page, 1024, 'light', fontScale);
    const failures: string[] = [];
    for (let width = 200; width <= 480; width += 4) {
      await page.evaluate((w) => {
        const list = [...document.querySelectorAll<HTMLElement>('ul')].find((ul) =>
          ul.className.includes('w-[288px]'),
        );
        if (!list) throw new Error('No se encuentra la lista de ancho fijo de la galería');
        list.style.width = `${w}px`;
        list.style.maxWidth = 'none';
      }, width);
      for (const problem of await inspectCards(page)) failures.push(`${width} px: ${problem}`);
    }
    expect(failures).toEqual([]);
  });
}

// Pantalla de resultados con datos reales (la provincia de Málaga: rótulos y direcciones reales).
for (const theme of THEMES) {
  for (const width of WIDTHS) {
    test(`resultados reales sin solapes ni desbordes a ${width} px, tema ${theme}`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await page.addInitScript((t) => localStorage.setItem('gasora:theme:v1', t), theme);
      await page.goto('/');
      const box = page.getByRole('combobox', { name: /Buscar por provincia/ }).first();
      await box.fill('malag');
      await box.press('Enter');
      await expect(page.getByTestId('results-list')).toBeVisible();
      await page.getByRole('button', { name: 'Ver más' }).click();
      await page.evaluate(() => document.fonts.ready);

      expect(await inspectCards(page)).toEqual([]);
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow, 'desbordamiento horizontal').toBeLessThanOrEqual(0);
      // El mapa tiene tamaño real (el lienzo no se queda en el 300 px por defecto)
      await waitForMap(page);
      const mapBox = await page.getByTestId('map').boundingBox();
      expect(mapBox?.width, 'ancho del mapa').toBeGreaterThan(250);
      expect(mapBox?.height, 'alto del mapa').toBeGreaterThan(200);
      const canvasHeight = await page
        .locator('canvas.maplibregl-canvas')
        .evaluate((c) => c.clientHeight);
      expect(canvasHeight).toBeGreaterThan(200);
      // Controles de la cabecera de resultados: zonas táctiles de 44 px y sin salirse
      const small = await page.evaluate(() =>
        [
          ...document.querySelectorAll<HTMLElement>(
            'main button:not(.station-card__link), main input[type="range"]',
          ),
        ]
          .filter((el) => el.getBoundingClientRect().width > 0)
          .map((el) => ({ el, r: el.getBoundingClientRect() }))
          .filter(({ r }) => r.height < 43.5 || r.width < 43.5)
          .map(({ el }) => `${el.tagName} «${el.textContent?.slice(0, 20) ?? ''}»`),
      );
      expect(small, 'zonas táctiles menores de 44 px').toEqual([]);
    });
  }
}

// Texto del sistema al 200 % en la pantalla de resultados con mapa
for (const width of [390, 768, 1440]) {
  test(`resultados con mapa a ${width} px y texto al 200 %: sin solapes ni desbordes`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/');
    const box = page.getByRole('combobox', { name: /Buscar por provincia/ }).first();
    await box.fill('malag');
    await box.press('Enter');
    await waitForMap(page);
    await page.evaluate(() => {
      document.documentElement.style.fontSize = '200%';
    });
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(400);

    expect(await inspectCards(page)).toEqual([]);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow, 'desbordamiento horizontal').toBeLessThanOrEqual(0);

    if (width < 640) {
      // La hoja expandida no tapa el buscador ni los chips, aunque crezcan con el texto
      await page.getByTestId('sheet-toggle').click();
      await page.waitForTimeout(500);
      const sheetTop = (await page.locator('section.bottom-sheet').boundingBox())?.y ?? 0;
      const chips = await page.getByRole('group', { name: 'Tipo de combustible' }).boundingBox();
      expect(sheetTop).toBeGreaterThanOrEqual((chips?.y ?? 0) + (chips?.height ?? 0) - 0.5);
      const navTop =
        (await page.getByRole('navigation', { name: 'Principal' }).last().boundingBox())?.y ?? 0;
      const sheet = await page.locator('section.bottom-sheet').boundingBox();
      expect((sheet?.y ?? 0) + (sheet?.height ?? 0)).toBeLessThanOrEqual(navTop + 0.5);
    } else {
      const mapBox = await page.getByTestId('map').boundingBox();
      expect(mapBox?.height).toBeGreaterThan(150);
    }
  });
}

// Pantallas de la Fase 5 con contenido real: favoritos, calculadora y ficha (columna de ≈ 720 px).
const FAV_IDS = () => [
  someStation().id,
  ...sellers('g95e5')
    .slice(1, 3)
    .map((s) => s.id),
  '99999999',
];

async function openPhase5(
  page: Page,
  screen: 'favoritos' | 'ficha',
  width: number,
  theme: 'light' | 'dark',
  fontScale = 100,
) {
  await page.setViewportSize({ width, height: 900 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.addInitScript(
    ([t, ids]) => {
      localStorage.setItem('gasora:theme:v1', t as string);
      localStorage.setItem('gasora:favorites:v1', JSON.stringify(ids));
    },
    [theme, FAV_IDS()],
  );
  await page.goto(screen === 'favoritos' ? '/favoritos' : `/e/${someStation().id}`);
  await expect(page.locator('main')).toBeVisible();
  if (fontScale !== 100) {
    await page.evaluate((scale) => {
      document.documentElement.style.fontSize = `${scale}%`;
    }, fontScale);
  }
  await page.evaluate(() => document.fonts.ready);
}

for (const theme of THEMES) {
  for (const width of WIDTHS) {
    for (const screen of ['favoritos', 'ficha'] as const) {
      test(`${screen} sin solapes ni desbordes a ${width} px, tema ${theme}`, async ({ page }) => {
        await openPhase5(page, screen, width, theme);
        if (screen === 'favoritos') {
          await expect(page.getByTestId('favorites-list')).toBeVisible();
          expect(await inspectCards(page)).toEqual([]);
        } else {
          await expect(page.getByTestId('station-detail')).toBeVisible();
        }
        const overflow = await page.evaluate(
          () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
        );
        expect(overflow, 'desbordamiento horizontal').toBeLessThanOrEqual(0);
        // En escritorio es una columna centrada de ≈ 720 px
        if (width >= 1024) {
          const box = await page.locator('main > div').first().boundingBox();
          expect(box?.width).toBeLessThanOrEqual(720.5);
          expect(Math.abs((box?.x ?? 0) + (box?.width ?? 0) / 2 - width / 2)).toBeLessThan(2);
        }
        const small = await page.evaluate(() =>
          [
            ...document.querySelectorAll<HTMLElement>(
              'main button:not(.station-card__link), main summary',
            ),
          ]
            .filter((el) => el.getBoundingClientRect().width > 0)
            .filter((el) => el.getBoundingClientRect().height < 43.5)
            .map(
              (el) =>
                `${el.tagName} ${el.getAttribute('aria-label') ?? el.textContent?.slice(0, 20)}`,
            ),
        );
        expect(small, 'zonas táctiles menores de 44 px').toEqual([]);
      });
    }
  }
}

// 1440 px no se prueba al 200 %: emulado con font-size los puntos de corte (en rem) no se mueven como
// en un navegador real, y la cabecera de escritorio no cabría. 390 y 768 sí.
for (const width of [390, 768]) {
  for (const screen of ['favoritos', 'ficha'] as const) {
    test(`${screen} a ${width} px con el texto al 200 %: sin solapes ni desbordes`, async ({
      page,
    }) => {
      await openPhase5(page, screen, width, 'light', 200);
      if (screen === 'favoritos') {
        await expect(page.getByTestId('favorites-list')).toBeVisible();
        expect(await inspectCards(page)).toEqual([]);
      } else {
        await expect(page.getByTestId('station-detail')).toBeVisible();
        const price = await page.getByTestId('detail-price').evaluate((el) => ({
          over: el.scrollWidth > el.clientWidth + 0.5,
        }));
        expect(price.over, 'el precio de la ficha desborda').toBe(false);
      }
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow, 'desbordamiento horizontal').toBeLessThanOrEqual(0);
    });
  }
}
