import { formatPriceNumber } from '../../src/lib/format';
import { BIG_CP, someStation } from './data';
import { expect, test } from './fixtures';
import { RAISE, installPublisher, setVisibility } from './publisher';

/**
 * «Hay precios nuevos» (Bloque B). Con la pestaña visible, cada 10 minutos se pide solo meta.json; si
 * su huella cambió, los datos nuevos se descargan en segundo plano y se muestra el aviso, sin tocar
 * lo que se está viendo. Al pulsar «Actualizar» se aplican. Los relojes están simulados
 * (`page.clock`) y el servidor es una simulación (`publisher.ts`).
 */
const station = someStation();
const TEN_MIN = 10 * 60 * 1000;
// Sin variación aleatoria (Math.random fijo): una comprobación exacta cada 10 minutos
const RUN = TEN_MIN + 5_000;

async function openResults(page: import('@playwright/test').Page) {
  await page.addInitScript(() => {
    Math.random = () => 0.5;
  });
  await page.clock.install({ time: new Date('2026-11-06T10:00:00Z') });
  const publisher = await installPublisher(page, station.id);
  await page.goto('/');
  const box = page.getByRole('combobox', { name: /Buscar por provincia/ }).first();
  await box.fill(BIG_CP);
  await box.press('Enter');
  await expect(page.getByTestId('station-card').first()).toBeVisible();
  return publisher;
}

test.use({ viewport: { width: 1280, height: 800 } });

test('sin cambios en los datos: cada 10 minutos pide solo meta.json y no muestra nada', async ({
  page,
}) => {
  const publisher = await openResults(page);
  const { state } = publisher;
  await expect.poll(() => state.meta).toBeGreaterThanOrEqual(1);
  const metaBefore = state.meta;
  const pricesBefore = state.prices;
  const stationsBefore = state.stations;
  await page.clock.runFor(RUN);
  await expect.poll(() => state.meta).toBe(metaBefore + 1);
  await page.clock.runFor(RUN);
  await expect.poll(() => state.meta).toBe(metaBefore + 2);
  // Solo el meta pequeño: ni precios ni estaciones
  expect(state.prices).toBe(pricesBefore);
  expect(state.stations).toBe(stationsBefore);
  await expect(page.getByTestId('data-update')).toBeEmpty();
});

test('con datos nuevos: aviso accesible, nada cambia en pantalla hasta pulsar «Actualizar»', async ({
  page,
}) => {
  const publisher = await openResults(page);
  // Se cambia el precio de una estación de mitad de lista (sigue a la vista tras reordenarse)
  const changedId = (await page
    .getByTestId('station-card')
    .nth(20)
    .locator('xpath=..')
    .getAttribute('data-station-id'))!;
  publisher.state.changedId = changedId;
  const priceCell = page.locator(`[data-station-id="${changedId}"] .station-card__value`).first();
  const priceBefore = await priceCell.innerText();
  const before = await page.getByTestId('list-scroll').innerText();
  const titleBefore = await page.getByTestId('results-title').innerText();
  publisher.publish();
  await page.clock.runFor(RUN);

  // Aviso: región de estado educada con el texto y un botón de 44 px
  const region = page.getByTestId('data-update');
  await expect(region).toHaveAttribute('role', 'status');
  await expect(region).toHaveAttribute('aria-live', 'polite');
  await expect(region).toContainText('Hay precios nuevos');
  const apply = page.getByTestId('data-update-apply');
  await expect(apply).toHaveText('Actualizar');
  expect((await apply.boundingBox())!.height).toBeGreaterThanOrEqual(44);

  // La lista que se está viendo NO se ha recolocado ni recalculado
  expect(await page.getByTestId('list-scroll').innerText()).toBe(before);
  await expect(priceCell).toHaveText(priceBefore);
  // Se descargaron en segundo plano los precios nuevos (no las estaciones, que no cambiaron)
  expect(publisher.state.prices).toBeGreaterThanOrEqual(2);

  await apply.click();
  // Se anuncia y el aviso desaparece
  await expect(page.getByTestId('data-notice')).toHaveText('Precios actualizados');
  await expect(page.getByTestId('data-update')).toBeEmpty();
  // Los datos nuevos se ven; la búsqueda, el combustible y el orden se mantienen
  await expect(priceCell).toHaveText(formatPriceNumber(publisher.priceOf(changedId) + RAISE));
  await expect(page.getByTestId('results-title')).toHaveText(titleBefore);
  await expect(page.getByRole('button', { name: 'Gasolina 95', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  // El foco queda en el contenido, no se pierde
  await expect(page.locator('#contenido')).toBeFocused();
  // No vuelve a avisar por lo mismo
  await page.clock.runFor(RUN);
  await expect(page.getByTestId('data-update')).toBeEmpty();
});

test('mantiene la ficha abierta y los filtros al aplicar', async ({ page }) => {
  const publisher = await openResults(page);
  await page.locator(`[data-station-id="${station.id}"] .station-card__link`).first().click();
  const detail = page.getByTestId('station-detail');
  await expect(detail).toBeVisible();
  publisher.publish();
  await page.clock.runFor(RUN);
  await expect(page.getByTestId('data-update')).toContainText('Hay precios nuevos');
  await expect(detail).toBeVisible();
  await page.getByTestId('data-update-apply').click();
  await expect(detail).toBeVisible();
  await expect(detail).toContainText(formatPriceNumber(publisher.realPrice + RAISE));
});

test('la ficha directa y los favoritos usan los datos nuevos al aplicarse', async ({ page }) => {
  await page.addInitScript(() => {
    Math.random = () => 0.5;
  });
  await page.clock.install({ time: new Date('2026-11-06T10:00:00Z') });
  await page.addInitScript(
    (id) => localStorage.setItem('gasora:favorites:v1', JSON.stringify([id])),
    station.id,
  );
  const publisher = await installPublisher(page, station.id);
  await page.goto('/favoritos');
  const card = page.locator(`[data-station-id="${station.id}"]`).first();
  await expect(card).toContainText(formatPriceNumber(publisher.realPrice));
  publisher.publish();
  await page.clock.runFor(RUN);
  await expect(page.getByTestId('data-update')).toContainText('Hay precios nuevos');
  await expect(card).toContainText(formatPriceNumber(publisher.realPrice));
  await page.getByTestId('data-update-apply').click();
  await expect(card).toContainText(formatPriceNumber(publisher.realPrice + RAISE));
});

test('con la pestaña oculta o sin conexión no pide nada; al volver tras más de 10 minutos comprueba enseguida', async ({
  page,
  context,
}) => {
  const publisher = await openResults(page);
  const { state } = publisher;
  await expect.poll(() => state.meta).toBeGreaterThanOrEqual(1);
  await setVisibility(page, 'hidden');
  const hiddenAt = state.meta;
  await page.clock.runFor(60 * 60 * 1000);
  await page.waitForTimeout(500);
  expect(state.meta).toBe(hiddenAt);
  publisher.publish();
  await setVisibility(page, 'visible');
  await expect(page.getByTestId('data-update')).toContainText('Hay precios nuevos');
  await expect.poll(() => state.meta).toBe(hiddenAt + 1);

  // Sin conexión: pausa total
  await page.getByTestId('data-update-apply').click();
  await context.setOffline(true);
  const offlineAt = state.meta;
  await page.clock.runFor(30 * 60 * 1000);
  await page.waitForTimeout(500);
  expect(state.meta).toBe(offlineAt);
});

test('respeta el ahorro de datos del navegador', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'connection', {
      value: Object.assign(new EventTarget(), { saveData: true }),
      configurable: true,
    });
  });
  const publisher = await openResults(page);
  const { state } = publisher;
  const before = state.meta;
  publisher.publish();
  await page.clock.runFor(60 * 60 * 1000);
  await page.waitForTimeout(500);
  expect(state.meta).toBe(before);
  await expect(page.getByTestId('data-update')).toBeEmpty();
});

test('si falla, reintenta con espera creciente y sin avisar al usuario', async ({ page }) => {
  const publisher = await openResults(page);
  const { state } = publisher;
  await expect.poll(() => state.meta).toBeGreaterThanOrEqual(1);
  publisher.publish();
  state.failNext = 3;
  const start = state.meta;
  await page.clock.runFor(RUN); // 1.er intento: falla
  await expect.poll(() => state.meta).toBe(start + 1);
  await page.clock.runFor(30_000); // reintento a los 30 s: falla
  await expect.poll(() => state.meta).toBe(start + 2);
  await page.clock.runFor(60_000); // a los 60 s: falla
  await expect.poll(() => state.meta).toBe(start + 3);
  // Ningún aviso ni mensaje de error por los fallos
  await expect(page.getByTestId('data-update')).toBeEmpty();
  await expect(page.getByRole('alert')).toHaveCount(0);
  await page.clock.runFor(120_000); // a los 120 s: acierta y hay datos nuevos
  await expect(page.getByTestId('data-update')).toContainText('Hay precios nuevos');
});

test('mientras el aviso está a la vista, la hoja, el mapa y la atribución caben en la pantalla', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const publisher = await openResults(page);
  publisher.publish();
  await page.clock.runFor(RUN);
  await expect(page.getByTestId('data-update')).toContainText('Hay precios nuevos');
  await page.waitForTimeout(300);
  const fit = await page.evaluate(() => ({
    scroll: document.documentElement.scrollHeight - window.innerHeight,
    sheetBottom: document.querySelector('section.bottom-sheet')!.getBoundingClientRect().bottom,
    nav: document.querySelectorAll('nav')[1]?.getBoundingClientRect().top ?? 0,
    stripBottom: document.querySelector('[data-testid="data-update"]')!.getBoundingClientRect()
      .bottom,
    mapTop: document.querySelector('[data-testid="map"]')!.getBoundingClientRect().top,
  }));
  expect(fit.scroll).toBeLessThanOrEqual(1);
  expect(fit.sheetBottom).toBeLessThanOrEqual(844);
  // La franja queda encima del mapa, sin taparlo
  expect(fit.mapTop).toBeGreaterThanOrEqual(fit.stripBottom - 1);
});
