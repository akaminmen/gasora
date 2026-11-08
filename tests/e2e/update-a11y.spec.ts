import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';
import { BIG_CP, someStation } from './data';
import { expect, test } from './fixtures';
import { waitForMap } from './map-support';
import { installPublisher } from './publisher';

/**
 * Layout y accesibilidad del aviso «Hay precios nuevos · Actualizar» en Chromium, Firefox y WebKit:
 * claro y oscuro, de 320 a 1440 px, con el texto al 200 % y con axe. El aviso es una franja en el
 * flujo, bajo la cabecera: no tapa la hoja, la cabecera, los controles del mapa ni la atribución, y
 * las pantallas de alto fijo descuentan su altura (no hay desplazamiento vertical de la página).
 */
const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];
const station = someStation();
const RUN = 10 * 60 * 1000 + 5_000;

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

/** Abre la pantalla, publica datos nuevos y deja el aviso a la vista. */
async function withStrip(
  page: Page,
  path: 'results' | 'home',
  width: number,
  theme: 'light' | 'dark',
) {
  await page.setViewportSize({ width, height: 900 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.addInitScript((t) => {
    localStorage.setItem('gasora:theme:v1', t);
    Math.random = () => 0.5;
  }, theme);
  await page.clock.install({ time: new Date('2026-11-06T10:00:00Z') });
  const publisher = await installPublisher(page, station.id);
  await page.goto('/');
  if (path === 'results') {
    const box = page.getByRole('combobox', { name: /Buscar por provincia/ }).first();
    await box.fill(BIG_CP);
    await box.press('Enter');
    await expect(page.getByTestId('station-card').first()).toBeVisible();
    await waitForMap(page);
  } else {
    // En el inicio los datos se piden pasados unos segundos
    await page.clock.runFor(5_000);
    await expect(page.getByTestId('status-line')).toContainText('estaciones');
  }
  publisher.publish();
  await page.clock.runFor(RUN);
  await expect(page.getByTestId('data-update')).toContainText('Hay precios nuevos');
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(300);
}

const measure = (page: Page) =>
  page.evaluate(() => {
    const strip = document.querySelector('[data-testid="data-update"] > div')!;
    const button = document
      .querySelector('[data-testid="data-update-apply"]')!
      .getBoundingClientRect();
    const stripBox = strip.getBoundingClientRect();
    const header = document.querySelector('header')!.getBoundingClientRect();
    const rect = (selector: string) => {
      const r = document.querySelector(selector)?.getBoundingClientRect();
      return r ? { top: r.top, bottom: r.bottom, left: r.left, right: r.right } : null;
    };
    return {
      button: { w: button.width, h: button.height, left: button.left, right: button.right },
      strip: { top: stripBox.top, bottom: stripBox.bottom },
      headerBottom: header.bottom,
      overflowX: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      overflowY: document.documentElement.scrollHeight - window.innerHeight,
      map: rect('[data-testid="map"]'),
      sheet: rect('section.bottom-sheet'),
      controls: rect('.map-controls'),
      attribution: rect('.maplibregl-ctrl-attrib'),
      viewport: { w: window.innerWidth, h: window.innerHeight },
    };
  });

for (const theme of ['light', 'dark'] as const) {
  for (const width of [320, 390, 768, 1440]) {
    test(`resultados con el aviso a ${width} px, tema ${theme}: botón de 44 px y sin tapar nada`, async ({
      page,
    }) => {
      await withStrip(page, 'results', width, theme);
      const m = await measure(page);
      expect(m.button.h).toBeGreaterThanOrEqual(44);
      expect(m.button.w).toBeGreaterThanOrEqual(44);
      expect(m.button.left).toBeGreaterThanOrEqual(0);
      expect(m.button.right).toBeLessThanOrEqual(m.viewport.w);
      // En el flujo, justo bajo la cabecera
      expect(m.strip.top).toBeGreaterThanOrEqual(m.headerBottom - 1);
      expect(m.overflowX).toBeLessThanOrEqual(0);
      // La pantalla móvil de alto fijo descuenta la franja: la página no se desplaza
      // (en escritorio y tableta el pie sigue a continuación y la página se desplaza como siempre)
      if (width < 768) expect(m.overflowY).toBeLessThanOrEqual(1);
      // El mapa empieza debajo de la franja (no la tapa ni es tapado por ella)
      expect(m.map!.top).toBeGreaterThanOrEqual(m.strip.bottom - 1);
      if (m.sheet) expect(m.sheet.bottom).toBeLessThanOrEqual(m.viewport.h);
      // La atribución sigue dentro del mapa y a la vista
      expect(m.attribution).not.toBeNull();
      expect(m.attribution!.bottom).toBeLessThanOrEqual(m.viewport.h);
      if (m.controls) expect(m.controls.top).toBeGreaterThanOrEqual(m.strip.bottom - 1);
    });
  }

  test(`inicio con el aviso a 390 px, tema ${theme}, texto al 200 %: cabe y el botón es de 44 px`, async ({
    page,
  }) => {
    await withStrip(page, 'home', 390, theme);
    await page.evaluate(() => {
      document.documentElement.style.fontSize = '200%';
    });
    await page.waitForTimeout(300);
    const m = await measure(page);
    expect(m.button.h).toBeGreaterThanOrEqual(44);
    expect(m.button.left).toBeGreaterThanOrEqual(0);
    expect(m.button.right).toBeLessThanOrEqual(m.viewport.w);
  });

  test(`axe con el aviso a la vista (inicio y resultados), tema ${theme}`, async ({ page }) => {
    await withStrip(page, 'home', 390, theme);
    await expectNoViolations(page);
  });

  test(`axe con el aviso a la vista en resultados de escritorio, tema ${theme}`, async ({
    page,
  }) => {
    await withStrip(page, 'results', 1440, theme);
    await expectNoViolations(page);
  });
}
