import { expect, test } from './fixtures';
import type { Page } from '@playwright/test';
import { BIG_CP, FUEL_INDEX, prices, someStation } from './data';

/** Favoritos (F8): persisten tras recargar, muestran el precio actual y tratan los casos raros. */
const KEY = 'gasora:favorites:v1';
const search = (page: Page) => page.getByRole('combobox', { name: /Buscar por provincia/ }).first();
const stored = (page: Page) =>
  page.evaluate((k) => JSON.parse(localStorage.getItem(k) ?? 'null') as string[] | null, KEY);

async function searchCp(page: Page) {
  await page.goto('/');
  await search(page).fill(BIG_CP);
  await search(page).press('Enter');
  await expect(page.getByTestId('station-card').first()).toBeVisible();
}

test.use({ viewport: { width: 1440, height: 900 } });

test('el corazón de la tarjeta guarda y quita; el estado persiste tras recargar', async ({
  page,
}) => {
  await searchCp(page);
  const card = page.getByTestId('station-card').nth(1);
  const heart = card.getByRole('button', { name: /en favoritos$/ });
  await expect(heart).toHaveAttribute('aria-pressed', 'false');
  await heart.click();
  await expect(card.getByRole('button', { name: /^Quitar .* de favoritos$/ })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  const ids = await stored(page);
  expect(ids).toHaveLength(1);
  // Persiste tras recargar
  await page.reload();
  expect(await stored(page)).toEqual(ids);
  await page.goto('/favoritos');
  await expect(page.getByTestId('favorites-list').getByTestId('station-card')).toHaveCount(1);
  await expect(page.getByText('1 gasolinera guardada')).toBeVisible();
});

test('la ficha y la tarjeta comparten el estado del favorito', async ({ page }) => {
  await searchCp(page);
  const card = page.getByTestId('station-card').first();
  await card.locator('.station-card__link').click();
  const detail = page.getByTestId('station-detail');
  await detail.getByRole('button', { name: /^Guardar .* en favoritos$/ }).click();
  await expect(card.getByRole('button', { name: /^Quitar .* de favoritos$/ })).toBeVisible();
  expect(await stored(page)).toHaveLength(1);
});

test('la lista de favoritos muestra el precio actual, el tramo y quita con el corazón', async ({
  page,
}) => {
  await page.addInitScript(
    ([k, id]) => localStorage.setItem(k as string, JSON.stringify([id])),
    [KEY, someStation().id],
  );
  await page.goto('/favoritos');
  const card = page.getByTestId('favorites-list').getByTestId('station-card');
  await expect(card).toHaveCount(1);
  await expect(card.locator('.station-card__value')).toHaveText(/\d,\d{3}/);
  await expect(card.locator('.tier[role="img"]')).toBeVisible();
  // Enlaza a la ficha
  await card.locator('.station-card__link').click();
  await expect(page).toHaveURL(new RegExp(`/e/${someStation().id}$`));
  await page.goBack();
  await card.getByRole('button', { name: /^Quitar .* de favoritos$/ }).click();
  await expect(page.getByRole('heading', { name: 'Aún no tienes favoritos' })).toBeVisible();
  expect(await stored(page)).toEqual([]);
});

test('el último guardado va el primero', async ({ page }) => {
  const first = someStation().id;
  await page.addInitScript(
    ([k, ids]) => localStorage.setItem(k as string, JSON.stringify(ids)),
    [KEY, [first]],
  );
  await searchCp(page);
  // Una tarjeta que no sea la ya guardada
  const cards = page.getByTestId('station-card');
  const count = await cards.count();
  let chosen = '';
  for (let i = 0; i < count; i++) {
    const id = (await cards.nth(i).locator('xpath=..').getAttribute('data-station-id')) ?? '';
    if (id !== first) {
      chosen = id;
      await cards
        .nth(i)
        .getByRole('button', { name: /en favoritos$/ })
        .click();
      break;
    }
  }
  expect(chosen).not.toBe('');
  expect(await stored(page)).toEqual([chosen, first]);
});

test('una estación que ya no existe sale como «Ya no disponible» y se puede quitar', async ({
  page,
}) => {
  await page.addInitScript(
    ([k, ids]) => localStorage.setItem(k as string, JSON.stringify(ids)),
    [KEY, ['99999999', someStation().id]],
  );
  await page.goto('/favoritos');
  const gone = page.getByTestId('favorite-row');
  await expect(gone).toHaveCount(1);
  await expect(gone).toContainText('Ya no disponible');
  await gone.getByRole('button', { name: /Quitar/ }).click();
  await expect(page.getByTestId('favorite-row')).toHaveCount(0);
  expect(await stored(page)).toEqual([someStation().id]);
});

test('si la estación no vende el combustible elegido, lo dice y deja quitarla', async ({
  page,
}) => {
  await page.addInitScript(
    ([k, id]) => localStorage.setItem(k as string, JSON.stringify([id])),
    [KEY, someStation().id],
  );
  await page.goto('/favoritos');
  await expect(page.getByTestId('station-card')).toHaveCount(1);
  test.skip(prices[someStation().id]?.[FUEL_INDEX.gnc] != null, 'La estación vende GNC');
  await page.getByRole('button', { name: 'GNC', exact: true }).click();
  const row = page.getByTestId('favorite-row');
  await expect(row).toContainText('No vende GNC');
});

test('el almacenamiento corrupto o con datos raros no rompe la página', async ({ page }) => {
  await page.addInitScript((k) => localStorage.setItem(k, '{"no":"es un array"'), KEY);
  await page.goto('/favoritos');
  await expect(page.getByRole('heading', { name: 'Aún no tienes favoritos' })).toBeVisible();
  await page.evaluate((k) => localStorage.setItem(k, '["1","<img src=x>",42,null]'), KEY);
  await page.reload();
  await expect(page.getByRole('heading', { level: 1, name: 'Favoritos' })).toBeVisible();
});

test('cambiar de combustible en favoritos actualiza el precio', async ({ page }) => {
  await page.addInitScript(
    ([k, id]) => localStorage.setItem(k as string, JSON.stringify([id])),
    [KEY, someStation().id],
  );
  await page.goto('/favoritos');
  const price = page.locator('.station-card__value').first();
  const before = await price.textContent();
  await page.getByRole('button', { name: 'Gasolina 98', exact: true }).click();
  // Con otro combustible, o cambia el precio o la fila pasa a «No vende»
  await expect
    .poll(async () => (await price.count()) === 0 || (await price.textContent()) !== before)
    .toBe(true);
});
