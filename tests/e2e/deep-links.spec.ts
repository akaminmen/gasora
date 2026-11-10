import { createServer, type Server } from 'node:http';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { extname, join, resolve } from 'node:path';
import { expect, test } from '@playwright/test';
import { stations } from './data';

/**
 * Enlaces profundos con la web en la raíz (gasora.es). GitHub Pages no tiene reescritura de rutas:
 * ante una ruta que no es un fichero devuelve 404.html con estado 404. Este servidor hace lo mismo
 * sobre `dist-base` (base /), así que se prueba el mismo camino que seguirá una visita directa o una
 * recarga: el navegador recibe 404.html (copia de index.html) y la aplicación resuelve la ruta.
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

function pagesLike(): Promise<{ server: Server; origin: string }> {
  const server = createServer((request, response) => {
    const path = decodeURIComponent(new URL(request.url ?? '/', 'http://x').pathname);
    let file = join(DIR, path === '/' ? 'index.html' : path);
    let status = 200;
    if (!file.startsWith(DIR) || !existsSync(file) || statSync(file).isDirectory()) {
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

const ROUTES = [
  ['/favoritos', { level: 1, name: 'Favoritos' }],
  ['/calculadora', { level: 1, name: 'Calculadora de ahorro' }],
  ['/acerca', { level: 1, name: 'Acerca de' }],
  ['/ruta/que/no/existe', { name: 'Esta página no existe' }],
  ['/e/99999999', { name: /ya no está disponible/ }],
] as const;

test.describe('enlaces profundos con la base /', () => {
  for (const [path, heading] of ROUTES) {
    test(`${path}: visita directa y recarga, sin ficheros que den 404`, async ({ page }) => {
      const failed: string[] = [];
      page.on('response', (response) => {
        // El único 404 permitido es el del propio documento (así funciona GitHub Pages)
        if (response.status() >= 400 && response.request().resourceType() !== 'document') {
          failed.push(`${response.status()} ${response.url()}`);
        }
      });
      await page.goto(`${host.origin}${path}`);
      await expect(page.getByRole('heading', heading)).toBeVisible();
      await page.reload();
      await expect(page.getByRole('heading', heading)).toBeVisible();
      expect(failed).toEqual([]);
    });
  }

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
