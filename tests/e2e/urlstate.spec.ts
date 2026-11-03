import { expect, test } from './fixtures';
import type { Page } from '@playwright/test';
import { BIG_CP, searchIndex } from './data';

/** URL compartible (F14): `/?q=…&fuel=…&r=…&sort=…` restaura la búsqueda y se mantiene al día. */
test.use({
  viewport: { width: 1440, height: 900 },
  geolocation: { latitude: 36.7213, longitude: -4.4214 },
});

const search = (page: Page) => page.getByRole('combobox', { name: /Buscar por provincia/ }).first();
const params = (page: Page) => new URL(page.url()).searchParams;
const MALAGA_CITY = searchIndex.municipalities.find((m) => m.name === 'Málaga');
const MALAGA_PROVINCE = searchIndex.provinces.find((p) => p.name === 'Málaga');

test('buscar por código postal escribe q, fuel y r en la URL', async ({ page }) => {
  await page.goto('/');
  expect(page.url()).toMatch(/\/$/);
  await search(page).fill(BIG_CP);
  await search(page).press('Enter');
  await expect(page.getByTestId('station-card').first()).toBeVisible();
  await expect.poll(() => page.url()).toContain(`q=${BIG_CP}`);
  expect(params(page).get('fuel')).toBe('g95e5');
  expect(params(page).get('r')).toBe('5');
  expect(params(page).has('sort')).toBe(false);
});

test('combustible, radio y orden se reflejan en la URL, sin añadir entradas al historial', async ({
  page,
}) => {
  await page.goto('/');
  await search(page).fill(BIG_CP);
  await search(page).press('Enter');
  await expect(page.getByTestId('station-card').first()).toBeVisible();
  const entries = await page.evaluate(() => window.history.length);
  await page.getByRole('button', { name: 'Diésel', exact: true }).first().click();
  await expect.poll(() => params(page).get('fuel')).toBe('goa');
  await page.getByRole('slider', { name: /Radio/ }).fill('12');
  await expect.poll(() => params(page).get('r')).toBe('12');
  await page.getByRole('button', { name: 'Distancia' }).click();
  await expect.poll(() => params(page).get('sort')).toBe('distance');
  await page.getByRole('button', { name: 'Precio', exact: true }).click();
  await expect.poll(() => params(page).has('sort')).toBe(false);
  expect(await page.evaluate(() => window.history.length)).toBe(entries);
});

test('abrir un enlace restaura combustible, radio, orden y zona', async ({ page }) => {
  await page.goto(`/?q=${BIG_CP}&fuel=goa&r=12&sort=distance`);
  await expect(page.getByTestId('results-title')).toHaveText(`Gasolineras en CP ${BIG_CP}`);
  await expect(page.getByRole('button', { name: 'Diésel', exact: true }).first()).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect(page.getByRole('slider', { name: /Radio/ })).toHaveValue('12');
  await expect(page.getByRole('button', { name: 'Distancia' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect(page.getByTestId('station-card').first()).toBeVisible();
  // La URL se conserva (no se reescribe a otra cosa)
  expect(params(page).get('q')).toBe(BIG_CP);
  expect(params(page).get('r')).toBe('12');
});

test('un municipio, ampliado, y una provincia se restauran por su identificador', async ({
  page,
}) => {
  test.skip(!MALAGA_CITY || !MALAGA_PROVINCE, 'Sin Málaga en los datos');
  await page.goto(`/?q=m${MALAGA_CITY?.id}&x=1&r=10`);
  await expect(page.getByTestId('results-title')).toHaveText('Gasolineras en Málaga');
  await expect(page.getByRole('slider', { name: /Radio/ })).toHaveValue('10');
  await page.goto(`/?q=p${MALAGA_PROVINCE?.id}`);
  await expect(page.getByTestId('results-title')).toHaveText('Gasolineras en Málaga');
  await expect(page.getByRole('slider', { name: /Radio/ })).toHaveCount(0);
});

test('el municipio sin ampliar no lleva radio en la URL; al ampliar, sí', async ({ page }) => {
  test.skip(!MALAGA_CITY, 'Sin Málaga en los datos');
  await page.goto(`/?q=m${MALAGA_CITY?.id}`);
  await expect(page.getByRole('button', { name: 'Ampliar a 10 km' })).toBeVisible();
  expect(params(page).has('r')).toBe(false);
  await page.getByRole('button', { name: 'Ampliar a 10 km' }).click();
  await expect.poll(() => params(page).get('x')).toBe('1');
  expect(params(page).get('r')).toBe('10');
});

test('un enlace con una zona que no existe avisa y deja el inicio limpio', async ({ page }) => {
  await page.goto('/?q=99999&fuel=goa');
  await expect(page.getByText('Ese enlace ya no es válido')).toBeVisible();
  await expect(page.getByRole('heading', { level: 1 })).toContainText('La gasolina más barata');
  await expect.poll(() => page.url()).not.toContain('q=');
});

test('los parámetros inválidos se ignoran sin romper nada', async ({ page }) => {
  await page.goto('/?fuel=xx&r=999&sort=raro&q=%3Cscript%3E');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('La gasolina más barata');
  await expect(page.getByRole('button', { name: 'Gasolina 95' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
});

test('«Borrar búsqueda» limpia la URL', async ({ page }) => {
  await page.goto(`/?q=${BIG_CP}`);
  await expect(page.getByTestId('station-card').first()).toBeVisible();
  await page.getByTestId('clear-search').click();
  await expect.poll(() => page.url()).not.toContain('q=');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('La gasolina más barata');
});

test('la ubicación del usuario nunca aparece en la URL', async ({ page, context }) => {
  await context.grantPermissions(['geolocation']);
  await page.goto('/');
  await page.getByRole('button', { name: 'Usar mi ubicación' }).click();
  await expect(page.getByTestId('results-title')).toHaveText('Gasolineras cerca de ti');
  await page.getByRole('button', { name: 'Distancia' }).click();
  await page.waitForTimeout(300);
  const url = page.url();
  expect(url).not.toMatch(/q=|36\.7|-4\.4|lat|lng/);
  expect(new URL(url).search).toBe('');
});
