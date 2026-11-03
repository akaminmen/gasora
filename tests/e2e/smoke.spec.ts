import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { type Page } from '@playwright/test';
import { expect, test } from './fixtures';

// La app lee los JSON reales generados por la ingesta (criterio de la Fase 1).
const meta = JSON.parse(
  readFileSync(resolve(import.meta.dirname, '../../public/data/meta.json'), 'utf8'),
) as { stationCount: number; sourceDate: string; demo: boolean };

test('el inicio muestra las estaciones y la fecha de consulta de los datos reales', async ({
  page,
}) => {
  const failed: string[] = [];
  page.on('requestfailed', (request) => failed.push(request.url()));
  page.on('response', (response) => {
    if (response.status() >= 400) failed.push(`${response.status()} ${response.url()}`);
  });

  await page.goto('/');
  await expect(page).toHaveTitle('Gasora');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    'La gasolina más barata, más cerca',
  );
  await expect(page.getByRole('link', { name: 'Gasora, ir al inicio' })).toBeVisible();

  const status = page.getByTestId('status-line');
  const stations = meta.stationCount.toLocaleString('es-ES');
  await expect(status).toContainText(`${stations} estaciones`);
  await expect(status).toContainText('consultados el');
  await expect(status).not.toContainText('actualizados');
  await expect(status).toContainText(/\d{2}\/\d{2}\/\d{4}, \d{2}:\d{2}/);

  if (meta.demo) await expect(page.getByTestId('demo-label')).toBeVisible();
  else await expect(page.getByTestId('demo-label')).toHaveCount(0);

  expect(failed).toEqual([]);
});

test('«Acerca de» lista los 6 combustibles con precios reales', async ({ page }) => {
  await page.goto('/acerca');
  await expect(page.getByTestId('about-date')).toContainText('consultados el');
  const rows = page.getByTestId('fuel-table').locator('tbody tr');
  await expect(rows).toHaveCount(6);
  await expect(rows.first()).toContainText('Gasolina 95');
  await expect(rows.first()).toContainText(/\d,\d{3} €\/L/);
});

test('las rutas del plan responden y el 404 es amable', async ({ page }) => {
  for (const [path, heading] of [
    ['/favoritos', 'Favoritos'],
    ['/calculadora', 'Calculadora de ahorro'],
    ['/acerca', 'Acerca de'],
  ] as const) {
    await page.goto(path);
    await expect(page.getByRole('heading', { level: 1, name: heading })).toBeVisible();
  }
  await page.goto('/e/4375');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('4375');
  await page.goto('/ruta-que-no-existe');
  await expect(page.getByRole('heading', { name: 'Esta página no existe' })).toBeVisible();
  await page.getByRole('link', { name: 'Volver al inicio' }).click();
  await expect(page).toHaveURL('/');
});

test('el tema se puede cambiar, se recuerda y no parpadea al recargar', async ({ page }) => {
  await page.goto('/');
  const html = page.locator('html');
  await expect(html).not.toHaveAttribute('data-theme', 'dark');
  await page.getByTestId('theme-toggle').click();
  await expect(html).toHaveAttribute('data-theme', 'dark');
  await page.reload();
  await expect(html).toHaveAttribute('data-theme', 'dark');
  const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  expect(bg).toBe('rgb(10, 18, 32)'); // --bg oscuro #0A1220
});

const BG_LIGHT = 'rgb(247, 250, 252)';
const BG_DARK = 'rgb(10, 18, 32)';
const bodyBg = (page: Page) => page.evaluate(() => getComputedStyle(document.body).backgroundColor);

test('sin elección guardada la página carga clara aunque el sistema esté en oscuro', async ({
  page,
}) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.goto('/');
  expect(await page.evaluate(() => localStorage.getItem('gasora:theme:v1'))).toBeNull();
  expect(await bodyBg(page)).toBe(BG_LIGHT);
  await expect(page.getByTestId('theme-toggle')).toHaveAccessibleName('Cambiar a tema oscuro');
});

test('con «dark» guardado la página carga oscura aunque el sistema esté en claro', async ({
  page,
}) => {
  await page.emulateMedia({ colorScheme: 'light' });
  await page.addInitScript(() => localStorage.setItem('gasora:theme:v1', 'dark'));
  await page.goto('/');
  expect(await bodyBg(page)).toBe(BG_DARK);
  await expect(page.getByTestId('theme-toggle')).toHaveAccessibleName('Cambiar a tema claro');
});

test('el combustible elegido se recuerda', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Diésel', exact: true }).click();
  await page.reload();
  await expect(page.getByRole('button', { name: 'Diésel', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect(page.getByRole('button', { name: 'Gasolina 95' })).toHaveAttribute(
    'aria-pressed',
    'false',
  );
});

test('la galería /ui-kit existe en el build de tests, no en producción', async ({ page }) => {
  await page.goto('/ui-kit');
  await expect(
    page.getByRole('heading', { name: 'Tarjeta de resultado (sección 9.7)' }),
  ).toBeVisible();
});

test('muestra un error claro si faltan los datos', async ({ page }) => {
  await page.route('**/data/meta.json', (route) => route.fulfill({ status: 404, body: '' }));
  await page.goto('/');
  await expect(page.getByTestId('status-error')).toContainText('meta.json');
});
