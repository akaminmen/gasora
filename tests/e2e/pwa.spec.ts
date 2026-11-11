import { createServer, type Server } from 'node:http';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { extname, join, resolve } from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import { BIG_CP } from './data';

/**
 * PWA (Fase 6): manifiesto, iconos, service worker, modo sin conexión y actualizaciones.
 * Se prueba sobre un build con la base / (como en gasora.es), en el puerto 4174.
 * No usa el estilo de sustitución del mapa: con el service worker activo las peticiones de teselas
 * las hace él y Playwright no las intercepta. Sin conexión el mapa muestra su aviso y la lista sigue.
 */
const BASE_DIR = resolve(import.meta.dirname, '../../dist-base');
const search = (page: Page) => page.getByRole('combobox', { name: /Buscar por provincia/ }).first();

/** Dimensiones de un PNG (cabecera IHDR) descargado de la web. */
async function pngSize(page: Page, url: string): Promise<{ w: number; h: number; type: string }> {
  const response = await page.request.get(url);
  expect(response.ok(), url).toBe(true);
  const body = await response.body();
  expect(body.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
  return {
    w: body.readUInt32BE(16),
    h: body.readUInt32BE(20),
    type: response.headers()['content-type'] ?? '',
  };
}

/** Instante en que empezó la página actual; durante una recarga devuelve `fallback`. */
async function timeOrigin(page: Page, fallback: number): Promise<number> {
  try {
    return await page.evaluate(() => performance.timeOrigin);
  } catch {
    return fallback; // la página se está recargando
  }
}

async function ready(page: Page) {
  await page.goto('./');
  await page.evaluate(() => navigator.serviceWorker.ready);
  // Con clientsClaim el primer service worker pasa a controlar la página al activarse
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
}

test.describe('manifiesto, iconos y metadatos', () => {
  test('el manifiesto es válido y está enlazado desde la raíz', async ({ page }) => {
    await page.goto('./');
    const href = await page.locator('link[rel="manifest"]').getAttribute('href');
    expect(href).toBe('/manifest.webmanifest');
    const manifest = (await (await page.request.get(href ?? '')).json()) as Record<string, unknown>;
    expect(manifest).toMatchObject({
      name: 'Gasora',
      short_name: 'Gasora',
      lang: 'es',
      start_url: '/',
      scope: '/',
      id: '/',
      display: 'standalone',
      theme_color: '#4F46E5',
      background_color: '#F7FAFC',
    });
    const shortcuts = manifest['shortcuts'] as { url: string }[];
    expect(shortcuts.map((s) => s.url)).toEqual(['/favoritos', '/calculadora']);
  });

  test('los iconos existen, son PNG y miden lo que declara el manifiesto', async ({ page }) => {
    await page.goto('./');
    const manifest = (await (await page.request.get('manifest.webmanifest')).json()) as {
      icons: { src: string; sizes: string; type: string; purpose: string }[];
    };
    const purposes = manifest.icons.map((i) => i.purpose);
    expect(purposes).toContain('any');
    expect(purposes).toContain('maskable');
    expect(manifest.icons.some((i) => i.sizes === '192x192')).toBe(true);
    expect(manifest.icons.some((i) => i.sizes === '512x512')).toBe(true);
    for (const icon of manifest.icons) {
      const [w, h] = icon.sizes.split('x').map(Number);
      const size = await pngSize(page, `/${icon.src}`);
      expect(size, icon.src).toMatchObject({ w, h, type: 'image/png' });
    }
  });

  test('iconos de iOS y favicon, y etiquetas para compartir con gasora.es', async ({ page }) => {
    await page.goto('./');
    expect(await pngSize(page, '/apple-touch-icon.png')).toMatchObject({ w: 180, h: 180 });
    const ico = await (await page.request.get('/favicon.ico')).body();
    expect(ico.readUInt16LE(2)).toBe(1); // tipo icono
    expect(ico.readUInt16LE(4)).toBeGreaterThanOrEqual(2); // 32 y 48 px
    expect((await page.request.get('/favicon.svg')).ok()).toBe(true);
    await expect(page.locator('link[rel="apple-touch-icon"]')).toHaveAttribute(
      'href',
      '/apple-touch-icon.png',
    );
    const og = await page.locator('meta[property="og:image"]').getAttribute('content');
    expect(og).toMatch(/^https:\/\/gasora\.es\/og-image\.png$/);
    expect(await pngSize(page, '/og-image.png')).toMatchObject({ w: 1200, h: 630 });
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
      'href',
      'https://gasora.es/',
    );
    await expect(page.locator('meta[name="twitter:card"]')).toHaveAttribute(
      'content',
      'summary_large_image',
    );
    await expect(page).toHaveTitle(/^Gasora/);
  });

  test('robots.txt y sitemap.xml con la dirección real', async ({ page }) => {
    const robots = await (await page.request.get('/robots.txt')).text();
    expect(robots).toContain('Allow: /');
    expect(robots).toMatch(/Sitemap: https:\/\/gasora\.es\/sitemap\.xml/);
    const sitemap = await (await page.request.get('/sitemap.xml')).text();
    for (const page of ['', 'favoritos', 'calculadora', 'instalar', 'acerca']) {
      expect(sitemap).toContain(`<loc>https://gasora.es/${page}</loc>`);
    }
    // Las fichas /e/:id no se listan (son miles y cambian)
    expect(sitemap).not.toContain('/e/');
  });
});

test.describe('service worker y sin conexión', () => {
  test('se registra con el ámbito / y guarda la aplicación (también el mapa)', async ({ page }) => {
    await ready(page);
    const info = await page.evaluate(async () => {
      const registration = await navigator.serviceWorker.ready;
      const names = await caches.keys();
      const precache = names.find((n) => n.includes('precache'));
      const urls = precache
        ? (await (await caches.open(precache)).keys()).map((r) => new URL(r.url).pathname)
        : [];
      return {
        scope: new URL(registration.scope).pathname,
        script: new URL(registration.active?.scriptURL ?? '').pathname,
        urls,
      };
    });
    expect(info.scope).toBe('/');
    expect(info.script).toBe('/sw.js');
    expect(info.urls).toContain('/index.html');
    expect(info.urls.some((u) => /\/assets\/MapCanvas-.*\.js$/.test(u))).toBe(true);
    expect(info.urls.some((u) => /\/assets\/maplibre-gl-worker-.*\.js$/.test(u))).toBe(true);
    expect(info.urls.some((u) => u.endsWith('/manifest.webmanifest'))).toBe(true);
    // Los datos no se guardan en la caché de la aplicación: tienen la suya, con fecha
    expect(info.urls.some((u) => u.includes('/data/'))).toBe(false);
  });

  test('la caché de teselas respeta los límites de OpenFreeMap', async ({ page }) => {
    const sw = await (await page.request.get('/sw.js')).text();
    expect(sw).toContain('gasora-map-tiles-v1');
    const tiles = /maxEntries:\s*(\d+)[^}]*maxAgeSeconds:\s*(\d+)[^}]*purgeOnQuotaError:\s*!0/.exec(
      sw.slice(sw.indexOf('gasora-map-tiles-v1') - 100, sw.indexOf('gasora-map-tiles-v1') + 400),
    );
    expect(tiles).not.toBeNull();
    // Menos de 3.000 teselas, y de 7 días como máximo
    expect(Number(tiles?.[1])).toBeLessThanOrEqual(600);
    expect(Number(tiles?.[2])).toBeLessThanOrEqual(7 * 24 * 3600);
    // No hay descargas en bloque: nada de precarga de teselas en el service worker
    expect(sw).not.toMatch(/precacheAndRoute\(\[[^\]]*pbf/);
  });

  test('recargar sin conexión abre la aplicación con los últimos datos y avisa', async ({
    page,
    context,
  }) => {
    await ready(page);
    await expect(page.getByTestId('status-line')).toContainText('estaciones');
    await search(page).focus(); // carga el índice de búsqueda, que queda guardado con los datos
    await expect
      .poll(() =>
        page.evaluate(async () => (await (await caches.open('gasora-data-v1')).keys()).length),
      )
      .toBe(4);

    await context.setOffline(true);
    await page.reload();
    await expect(page.getByRole('heading', { level: 1 })).toContainText('La gasolina más barata');
    await expect(page.getByTestId('offline-strip')).toBeVisible();
    await expect(page.getByTestId('status-line')).toContainText('estaciones');

    await search(page).fill(BIG_CP);
    await search(page).press('Enter');
    await expect(page.getByText('Sin conexión:')).toBeVisible();
    await expect(page.getByTestId('station-card').first()).toBeVisible();
    // Sin red el mapa no puede pedir su estilo: avisa, y la lista y la ficha siguen funcionando
    await page.getByTestId('station-card').first().locator('.station-card__link').click();
    await expect(page.getByTestId('station-detail')).toBeVisible();
  });

  test('las rutas de la aplicación abren sin conexión también por enlace directo', async ({
    page,
    context,
  }) => {
    await ready(page);
    await expect(page.getByTestId('status-line')).toContainText('estaciones');
    await context.setOffline(true);
    for (const [path, heading] of [
      ['favoritos', 'Favoritos'],
      ['calculadora', 'Calculadora de ahorro'],
      ['acerca', 'Acerca de'],
    ] as const) {
      await page.goto(path);
      await expect(page.getByRole('heading', { level: 1, name: heading })).toBeVisible();
    }
    await page.goto('e/99999999');
    await expect(page.getByRole('heading', { name: /ya no está disponible/ })).toBeVisible();
    await page.goto('ruta/que/no/existe');
    await expect(page.getByRole('heading', { name: 'Esta página no existe' })).toBeVisible();
  });

  test('al volver la conexión se actualizan los datos y desaparece el aviso', async ({
    page,
    context,
  }) => {
    await ready(page);
    await expect(page.getByTestId('status-line')).toContainText('estaciones');
    await search(page).focus();
    await expect
      .poll(() =>
        page.evaluate(async () => (await (await caches.open('gasora-data-v1')).keys()).length),
      )
      .toBe(4);
    await context.setOffline(true);
    await page.reload();
    await search(page).fill(BIG_CP);
    await search(page).press('Enter');
    await expect(page.getByText('Sin conexión:')).toBeVisible();

    await context.setOffline(false);
    await expect(page.getByTestId('offline-strip')).toHaveCount(0);
    await expect(page.getByText('Sin conexión:')).toHaveCount(0, { timeout: 15_000 });
    await expect(page.getByTestId('station-card').first()).toBeVisible();
  });

  test('sin red y sin copia de los datos: error con «Reintentar», y se recupera al volver la conexión', async ({
    page,
    context,
  }) => {
    await ready(page);
    await page.evaluate(async () => {
      for (const name of await caches.keys()) {
        if (name.startsWith('gasora-data')) await caches.delete(name);
      }
    });
    await context.setOffline(true);
    await page.reload();
    await expect(page.getByTestId('status-error')).toBeVisible();
    // Reintentar sin red sigue dando el error
    await page.getByRole('button', { name: 'Reintentar' }).click();
    await expect(page.getByTestId('status-error')).toBeVisible();
    // Al volver la conexión se recupera sola, sin pulsar nada
    await context.setOffline(false);
    await expect(page.getByTestId('status-line')).toContainText('estaciones');
  });
});

/** Servidor estático de dist-base con una «versión» que se puede cambiar, para probar las actualizaciones. */
function serve(): Promise<{ server: Server; origin: string; bump: () => void }> {
  let version = 1;
  const server = createServer((request, response) => {
    const url = new URL(request.url ?? '/', 'http://x');
    let path = decodeURIComponent(url.pathname);
    path = path.slice(1) || 'index.html';
    let file = join(BASE_DIR, path);
    if (!existsSync(file) || statSync(file).isDirectory()) file = join(BASE_DIR, 'index.html');
    let body: Buffer | string = readFileSync(file);
    if (path === 'sw.js' && version > 1) body = `${body.toString()}\n// versión ${version}\n`;
    const types: Record<string, string> = {
      '.js': 'text/javascript',
      '.html': 'text/html',
      '.css': 'text/css',
      '.json': 'application/json',
      '.webmanifest': 'application/manifest+json',
      '.png': 'image/png',
      '.svg': 'image/svg+xml',
      '.woff2': 'font/woff2',
    };
    response.writeHead(200, {
      'content-type': types[extname(file)] ?? 'application/octet-stream',
      'cache-control': 'no-cache',
    });
    response.end(body);
  });
  return new Promise((done) => {
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      const port = typeof address === 'object' && address ? address.port : 0;
      done({
        server,
        origin: `http://127.0.0.1:${port}`,
        bump: () => {
          version += 1;
        },
      });
    });
  });
}

test.describe('actualizaciones', () => {
  let host: Awaited<ReturnType<typeof serve>>;
  test.beforeEach(async () => {
    host = await serve();
  });
  test.afterEach(async () => {
    await new Promise((done) => host.server.close(done));
  });

  async function open(page: Page) {
    await page.goto(`${host.origin}/`);
    await page.evaluate(() => navigator.serviceWorker.ready);
    await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
    await expect(page.getByRole('heading', { level: 1 })).toContainText('La gasolina más barata');
  }
  const checkForUpdate = (page: Page) =>
    page.evaluate(async () => {
      const registration = await navigator.serviceWorker.ready;
      await registration.update();
    });

  test('una versión nueva avisa, no se impone, y «Actualizar» la activa', async ({ page }) => {
    await open(page);
    await expect(page.getByTestId('update-banner')).toHaveCount(0);
    host.bump();
    await checkForUpdate(page);
    const banner = page.getByTestId('update-banner');
    await expect(banner).toBeVisible();
    await expect(banner).toContainText('Hay una versión nueva');
    // Mientras no se acepta, la versión nueva espera (no se activa sola con la app a la vista)
    expect(await page.evaluate(async () => !!(await navigator.serviceWorker.ready).waiting)).toBe(
      true,
    );
    await page.getByRole('button', { name: 'Actualizar' }).click();
    // La página se recarga con la versión nueva ya activa y sin nada esperando
    await expect(page.getByTestId('update-banner')).toHaveCount(0);
    await page.waitForFunction(() => document.readyState === 'complete');
    await expect
      .poll(async () =>
        page.evaluate(async () => {
          const registration = await navigator.serviceWorker.ready;
          return { waiting: !!registration.waiting, active: !!registration.active };
        }),
      )
      .toEqual({ waiting: false, active: true });
    await expect(page.getByRole('heading', { level: 1 })).toContainText('La gasolina más barata');
  });

  test('una versión que llega horas después (pasados 10 s) también avisa y se activa', async ({
    page,
  }) => {
    await open(page);
    await page.waitForTimeout(11_000); // la biblioteca trata las actualizaciones tardías como «externas»
    host.bump();
    await checkForUpdate(page);
    await expect(page.getByTestId('update-banner')).toBeVisible();
    const before = await page.evaluate(() => performance.timeOrigin);
    await page.getByRole('button', { name: 'Actualizar' }).click();
    await expect.poll(() => timeOrigin(page, before)).not.toBe(before);
    await expect(page.getByTestId('update-banner')).toHaveCount(0);
  });

  test('con la app en segundo plano la versión nueva se activa sola', async ({ page }) => {
    await open(page);
    host.bump();
    await checkForUpdate(page);
    await expect(page.getByTestId('update-banner')).toBeVisible();
    const before = await page.evaluate(() => performance.timeOrigin);
    // Se simula que la persona cambia de aplicación: la pestaña pasa a estar oculta
    await page.evaluate(() => {
      Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await expect.poll(() => timeOrigin(page, before)).not.toBe(before);
    await expect(page.getByRole('heading', { level: 1 })).toContainText('La gasolina más barata');
    expect(await page.evaluate(async () => !!(await navigator.serviceWorker.ready).waiting)).toBe(
      false,
    );
  });
});

test.describe('logos de marca', () => {
  test('no van en la precarga; se guardan al verlos y se ven sin conexión', async ({
    page,
    context,
  }) => {
    await ready(page);
    const precached = await page.evaluate(async () => {
      const names = (await caches.keys()).filter((name) => name.includes('precache'));
      const urls: string[] = [];
      for (const name of names) {
        for (const request of await (await caches.open(name)).keys()) urls.push(request.url);
      }
      return urls;
    });
    expect(precached.length).toBeGreaterThan(10);
    expect(precached.filter((url) => url.includes('/brands/'))).toEqual([]);

    // La galería (solo en el build de pruebas) muestra los logos de prueba de Ballenoil y Shell
    await page.goto('ui-kit');
    await expect(page.locator('.brand-logo img').first()).toBeVisible();
    await expect
      .poll(() =>
        page.evaluate(async () => {
          if (!(await caches.keys()).includes('gasora-brand-logos-v1')) return [];
          const cache = await caches.open('gasora-brand-logos-v1');
          return (await cache.keys()).map((request) => new URL(request.url).pathname);
        }),
      )
      .toContain('/brands/ballenoil.svg');

    await context.setOffline(true);
    await page.reload();
    const img = page.locator('.brand-logo img').first();
    await expect(img).toBeVisible();
    await expect
      .poll(() => img.evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth > 0))
      .toBe(true);
  });
});
