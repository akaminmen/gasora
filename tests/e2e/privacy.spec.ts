import { someStation } from './data';
import { expect, test } from './fixtures';

/**
 * Apéndice B del plan: sin cookies y sin peticiones a terceros distintos de OpenFreeMap.
 * Se recorren las pantallas principales y se comprueba a quién se pide cada cosa.
 */
const ALLOWED_HOSTS = new Set(['127.0.0.1', 'localhost', 'tiles.openfreemap.org']);

test('sin cookies y sin peticiones a servidores ajenos (salvo OpenFreeMap)', async ({
  page,
  context,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  const hosts = new Set<string>();
  page.on('request', (request) => {
    const url = new URL(request.url());
    if (url.protocol === 'http:' || url.protocol === 'https:') hosts.add(url.hostname);
  });

  const station = someStation();
  for (const path of [
    '/',
    '/favoritos',
    '/calculadora',
    '/instalar',
    '/acerca',
    `/e/${station.id}`,
  ]) {
    await page.goto(path);
    await expect(page.locator('main')).toBeVisible();
  }

  expect([...hosts].filter((host) => !ALLOWED_HOSTS.has(host))).toEqual([]);
  expect(await context.cookies()).toEqual([]);
  expect(await page.evaluate(() => document.cookie)).toBe('');
  // Lo único que se guarda en el dispositivo lleva el prefijo de la app
  const keys = await page.evaluate(() => Object.keys(localStorage));
  expect(keys.filter((key) => !key.startsWith('gasora:'))).toEqual([]);
});

test('lo que se guarda en el dispositivo es exactamente lo que explica «Acerca de»', async ({
  page,
}) => {
  const station = someStation();
  await page.goto('/');
  await page.getByTestId('theme-toggle').click();
  await page.goto('/calculadora');
  await page.getByRole('group', { name: 'Tipo de combustible' }).getByRole('button').nth(2).click();
  await page.getByRole('button', { name: 'Añadir 5 litros' }).click();
  await page.goto(`/e/${station.id}`);
  await page
    .getByRole('button', { name: /en favoritos$/ })
    .first()
    .click();
  const keys = (await page.evaluate(() => Object.keys(localStorage))).sort();
  // Favoritos, combustible, tema y litros: los cuatro de la lista de «Acerca de»
  expect(keys).toEqual([
    'gasora:favorites:v1',
    'gasora:fuel:v1',
    'gasora:liters:v1',
    'gasora:theme:v1',
  ]);
  await page.goto('/acerca');
  const text = await page.getByTestId('about-privacy').innerText();
  for (const word of [
    /favoritos/,
    /combustible/,
    /tema/,
    /litros/,
    /OpenFreeMap/,
    /dirección IP/,
    /GitHub Pages/,
    /ubicación/,
  ]) {
    expect(text).toMatch(word);
  }
});
