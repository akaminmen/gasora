import { createServer, type Server } from 'node:http';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { extname, join, resolve } from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import { stations } from './data';

/**
 * Enlaces profundos con la web en la raíz (gasora.es). Este servidor imita lo que se midió en GitHub
 * Pages (ADR 019): una dirección sin extensión se sirve con el fichero `.html` del mismo nombre y
 * estado 200 (`/favoritos` → `favoritos.html`, y `/404` → `404.html`); un directorio sin barra final
 * redirige (301) a la dirección con barra; todo lo que no es un fichero recibe `404.html` con estado
 * 404. Se prueba el mismo camino que una visita directa o una recarga sobre `dist-base` (base /).
 */
const DIR = resolve(import.meta.dirname, '../../dist-base');
const TYPES: Record<string, string> = {
  '.js': 'text/javascript',
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css',
  '.json': 'application/json',
  '.webmanifest': 'application/manifest+json',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
};

const isFile = (file: string) => existsSync(file) && statSync(file).isFile();

function pagesLike(): Promise<{ server: Server; origin: string }> {
  const server = createServer((request, response) => {
    const path = decodeURIComponent(new URL(request.url ?? '/', 'http://x').pathname);
    let file = join(DIR, path);
    let status = 200;
    if (!file.startsWith(DIR)) {
      file = join(DIR, '404.html');
      status = 404;
    } else if (existsSync(file) && statSync(file).isDirectory()) {
      if (!path.endsWith('/')) {
        response.writeHead(301, { location: `${path}/` }).end();
        return;
      }
      file = join(file, 'index.html');
    } else if (!isFile(file) && isFile(`${file}.html`)) {
      file = `${file}.html`;
    }
    if (!isFile(file)) {
      file = join(DIR, '404.html');
      status = 404;
    }
    response.writeHead(status, {
      'content-type': TYPES[extname(file)] ?? 'application/octet-stream',
    });
    response.end(readFileSync(file));
  });
  return new Promise((done) => {
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      done({
        server,
        origin: `http://127.0.0.1:${typeof address === 'object' && address ? address.port : 0}`,
      });
    });
  });
}

test.use({ serviceWorkers: 'block' });

let host: Awaited<ReturnType<typeof pagesLike>>;
test.beforeEach(async () => {
  host = await pagesLike();
});
test.afterEach(async () => {
  await new Promise((done) => host.server.close(done));
});

/** Pantallas con su propio HTML: estado 200, título y canónica propios. */
const STATIC_ROUTES = [
  ['/', { level: 1, name: /La gasolina más barata/ }, 'Gasora · La gasolina más barata, más cerca'],
  ['/favoritos', { level: 1, name: 'Favoritos' }, 'Gasora · Favoritos'],
  ['/calculadora', { level: 1, name: 'Calculadora de ahorro' }, 'Gasora · Calculadora de ahorro'],
  ['/instalar', { level: 1, name: 'Instalar Gasora' }, 'Instalar Gasora'],
  ['/acerca', { level: 1, name: 'Acerca de' }, 'Gasora · Acerca de'],
] as const;

/** Rutas que GitHub Pages sirve con 404.html (estado 404): la aplicación las resuelve igual. */
const FALLBACK_ROUTES = [
  ['/favoritos/', { level: 1, name: 'Favoritos' }],
  ['/ruta/que/no/existe', { name: 'Esta página no existe' }],
  ['/e/99999999', { name: /ya no está disponible/ }],
] as const;

async function visit(
  page: Page,
  url: string,
  heading: Parameters<Page['getByRole']>[1],
  expectedStatus: number,
) {
  const failed: string[] = [];
  page.on('response', (response) => {
    // El único estado de error permitido es el del propio documento
    if (response.status() >= 400 && response.request().resourceType() !== 'document') {
      failed.push(`${response.status()} ${response.url()}`);
    }
  });
  const response = await page.goto(url);
  expect(response?.status()).toBe(expectedStatus);
  await expect(page.getByRole('heading', heading)).toBeVisible();
  const reloaded = await page.reload();
  expect(reloaded?.status()).toBe(expectedStatus);
  await expect(page.getByRole('heading', heading)).toBeVisible();
  expect(failed).toEqual([]);
}

test.describe('enlaces profundos con la base /', () => {
  for (const [path, heading, title] of STATIC_ROUTES) {
    test(`${path}: estado 200 con su título y canónica, visita directa y recarga`, async ({
      page,
    }) => {
      await visit(page, `${host.origin}${path}`, heading, 200);
      await expect(page).toHaveTitle(title);
      const canonical = await page.locator('link[rel="canonical"]').getAttribute('href');
      expect(canonical).toBe(`https://gasora.es${path === '/' ? '/' : path}`);
      await expect(page.locator('meta[name="robots"]')).toHaveCount(0);
    });
  }

  for (const [path, heading] of FALLBACK_ROUTES) {
    test(`${path}: estado 404 con la aplicación (404.html con noindex), visita directa y recarga`, async ({
      page,
    }) => {
      await visit(page, `${host.origin}${path}`, heading, 404);
      await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex');
    });
  }

  test('/404 se sirve con estado 200 en GitHub Pages: lleva noindex para que no se indexe', async ({
    request,
  }) => {
    const response = await request.get(`${host.origin}/404`);
    expect(response.status()).toBe(200);
    expect(await response.text()).toContain('<meta name="robots" content="noindex" />');
  });

  test('un directorio sin barra final redirige a la dirección con barra', async ({ request }) => {
    const response = await request.get(`${host.origin}/assets`, { maxRedirects: 0 });
    expect(response.status()).toBe(301);
    expect(response.headers()['location']).toBe('/assets/');
  });

  test('la ficha de una estación existente se abre desde su enlace', async ({ page }) => {
    const station = stations[0]!;
    await page.goto(`${host.origin}/e/${station.id}`);
    await expect(page.getByText(station.n, { exact: false }).first()).toBeVisible();
    await expect(page.getByRole('heading', { name: /ya no está disponible/ })).toHaveCount(0);
  });

  test('desde la portada, los enlaces internos mantienen la raíz', async ({ page }) => {
    await page.goto(`${host.origin}/`);
    await page
      .getByRole('link', { name: /Favoritos/ })
      .first()
      .click();
    await expect(page).toHaveURL(`${host.origin}/favoritos`);
    await page.reload();
    await expect(page.getByRole('heading', { level: 1, name: 'Favoritos' })).toBeVisible();
  });
});
