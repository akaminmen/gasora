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
  for (const path of ['/', '/favoritos', '/calculadora', '/acerca', `/e/${station.id}`]) {
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
