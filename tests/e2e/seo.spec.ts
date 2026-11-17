import AxeBuilder from '@axe-core/playwright';
import { expect, test, type APIRequestContext } from '@playwright/test';
import { pagesLike } from './pages-like';

/**
 * Lo que ven los rastreadores y quien no ejecuta JavaScript: el HTML inicial de cada pantalla,
 * servido como GitHub Pages (`pages-like.ts`, build con base /). Iconos declarados y servibles,
 * texto, canónica, ausencia de noindex en las rutas con 200, datos estructurados, robots y sitemap.
 */
const SITE = 'https://gasora.es/';
const ROUTES = ['', 'favoritos', 'calculadora', 'instalar', 'acerca'] as const;

let host: Awaited<ReturnType<typeof pagesLike>>;
test.beforeEach(async () => {
  host = await pagesLike();
});
test.afterEach(async () => {
  await new Promise((done) => host.server.close(done));
});
test.use({ serviceWorkers: 'block' });

/** Texto visible del HTML inicial: sin scripts, estilos, comentarios ni etiquetas. */
function visibleText(html: string): string {
  return html
    .replace(/<(script|style|noscript)[\s\S]*?<\/\1>/g, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<head[\s\S]*?<\/head>/, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const attribute = (tag: string, name: string) =>
  new RegExp(`\\s${name}="([^"]*)"`).exec(tag)?.[1] ?? '';

async function html(request: APIRequestContext, path: string) {
  const response = await request.get(`${host.origin}/${path}`);
  expect(response.status(), `/${path}`).toBe(200);
  return response.text();
}

test.describe('HTML inicial de cada pantalla (sin ejecutar JavaScript)', () => {
  for (const route of ROUTES) {
    test(`/${route}: título, descripción, canónica, un h1, texto y enlaces`, async ({
      request,
    }) => {
      const page = await html(request, route);
      const title = /<title>([^<]+)<\/title>/.exec(page)?.[1] ?? '';
      expect(title).toMatch(/Gasora/);
      const description = /<meta\s+name="description"\s+content="([^"]+)"/.exec(page)?.[1] ?? '';
      expect(description.length).toBeGreaterThan(60);
      expect(description.length).toBeLessThanOrEqual(200);
      expect(/<link rel="canonical" href="([^"]+)"/.exec(page)?.[1]).toBe(`${SITE}${route}`);
      // Open Graph y Twitter coherentes con la página
      expect(/property="og:url" content="([^"]+)"/.exec(page)?.[1]).toBe(`${SITE}${route}`);
      expect(/property="og:title" content="([^"]+)"/.exec(page)?.[1]).toBe(title);
      expect(/name="twitter:title" content="([^"]+)"/.exec(page)?.[1]).toBe(title);
      expect(page).toContain(`name="twitter:image" content="${SITE}og-image.png"`);
      expect(page).toContain('name="twitter:card" content="summary_large_image"');
      expect(page).toContain(`property="og:image" content="${SITE}og-image.png"`);
      // Nunca noindex en una ruta con 200 (solo lo lleva 404.html)
      expect(page).not.toMatch(/name="robots"/i);
      expect(page).not.toMatch(/noindex/i);
      // Texto real en español, un solo h1 y los enlaces a las demás pantallas
      expect(page).toContain('<html lang="es">');
      expect((page.match(/<h1[ >]/g) ?? []).length).toBe(1);
      const text = visibleText(page);
      expect(text.split(' ').length).toBeGreaterThan(45);
      expect(text).toMatch(/Gasora/);
      const nav = /<nav aria-label="Páginas de Gasora">([\s\S]*?)<\/nav>/.exec(page)?.[1] ?? '';
      const links = [...nav.matchAll(/href="([^"]+)"/g)].map((m) => m[1]);
      const expected = ROUTES.filter((path) => path !== route).map((path) => `/${path}`);
      expect([...links].sort()).toEqual([...expected].sort());
      // Bloque noscript
      expect(page).toMatch(/<noscript>[\s\S]*Gasora necesita JavaScript[\s\S]*<\/noscript>/);
    });
  }

  test('los títulos, las descripciones y los h1 no se repiten entre pantallas', async ({
    request,
  }) => {
    const titles = new Set<string>();
    const descriptions = new Set<string>();
    const headings = new Set<string>();
    for (const route of ROUTES) {
      const page = await html(request, route);
      titles.add(/<title>([^<]+)<\/title>/.exec(page)?.[1] ?? '');
      descriptions.add(/<meta\s+name="description"\s+content="([^"]+)"/.exec(page)?.[1] ?? '');
      headings.add(/<h1>([^<]+)<\/h1>/.exec(page)?.[1] ?? '');
    }
    expect(titles.size).toBe(ROUTES.length);
    expect(descriptions.size).toBe(ROUTES.length);
    expect(headings.size).toBe(ROUTES.length);
  });

  test('los datos estructurados (WebSite y WebApplication) solo van en la portada y son válidos', async ({
    request,
  }) => {
    const home = await html(request, '');
    const blocks = [...home.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)];
    expect(blocks).toHaveLength(1);
    const data = JSON.parse(blocks[0]![1]!) as {
      '@context': string;
      '@graph': Record<string, unknown>[];
    };
    expect(data['@context']).toBe('https://schema.org');
    const byType = Object.fromEntries(data['@graph'].map((node) => [String(node['@type']), node]));
    expect(byType['WebSite']).toMatchObject({ name: 'Gasora', url: SITE, inLanguage: 'es' });
    expect(byType['WebApplication']).toMatchObject({
      name: 'Gasora',
      url: SITE,
      inLanguage: 'es',
      applicationCategory: 'UtilitiesApplication',
      isAccessibleForFree: true,
      offers: { '@type': 'Offer', price: '0', priceCurrency: 'EUR' },
      image: `${SITE}icons/icon-512.png`,
    });
    for (const route of ROUTES.slice(1)) {
      expect(await html(request, route)).not.toContain('application/ld+json');
    }
  });

  test('404.html lleva noindex y las rutas desconocidas dan 404 (no se indexan)', async ({
    request,
  }) => {
    const missing = await request.get(`${host.origin}/e/123`);
    expect(missing.status()).toBe(404);
    expect(await missing.text()).toContain('<meta name="robots" content="noindex" />');
  });
});

test.describe('iconos', () => {
  // Los iconos de la marca son los de siempre (decisión del usuario, ADR 020): SVG, ICO de 32 y 48 px
  // declarado como 48x48, e icono de iOS de 180 px. Nada de esto se cambia sin su aprobación.
  test('los tres iconos declarados existen, con su tipo y su tamaño', async ({ request }) => {
    const page = await html(request, '');
    const tags = [...page.matchAll(/<link\s+rel="(?:icon|apple-touch-icon)"[^>]*>/g)].map(
      (m) => m[0],
    );
    const declared: Record<string, string> = {};
    for (const tag of tags) declared[attribute(tag, 'href')] = attribute(tag, 'sizes');
    expect(declared).toEqual({
      '/favicon.svg': '',
      '/favicon.ico': '48x48',
      '/apple-touch-icon.png': '',
    });
    for (const href of Object.keys(declared)) {
      const response = await request.get(`${host.origin}${href}`);
      expect(response.status(), href).toBe(200);
      const type = response.headers()['content-type'] ?? '';
      const body = await response.body();
      expect(body.length, href).toBeGreaterThan(300);
      if (href.endsWith('.svg')) {
        expect(type).toContain('image/svg+xml');
        expect(body.toString()).toMatch(/viewBox="0 0 48 48"/);
      } else if (href.endsWith('.ico')) {
        expect(type).toMatch(/image\/(vnd\.microsoft\.icon|x-icon)/);
        const count = body.readUInt16LE(4);
        expect(Array.from({ length: count }, (_, i) => body[6 + 16 * i])).toEqual([32, 48]);
      } else {
        expect(type).toContain('image/png');
        expect([body.readUInt32BE(16), body.readUInt32BE(20)]).toEqual([180, 180]);
      }
    }
  });

  test('el manifiesto declara los iconos de 192, 512 y maskable y el color de tema coincide', async ({
    request,
  }) => {
    const manifest = (await (await request.get(`${host.origin}/manifest.webmanifest`)).json()) as {
      icons: { src: string; sizes: string; purpose: string }[];
      start_url: string;
      theme_color: string;
    };
    expect(manifest.start_url).toBe('/');
    expect(manifest.theme_color).toBe('#4F46E5');
    expect(manifest.icons.map((i) => `${i.sizes}:${i.purpose}`).sort()).toEqual([
      '192x192:any',
      '512x512:any',
      '512x512:maskable',
    ]);
    for (const icon of manifest.icons) {
      expect((await request.get(`${host.origin}/${icon.src}`)).status()).toBe(200);
    }
    expect(await html(request, '')).toContain('<meta name="theme-color" content="#4F46E5" />');
  });

  test('la imagen para compartir mide 1200 × 630', async ({ request }) => {
    const body = await (await request.get(`${host.origin}/og-image.png`)).body();
    expect([body.readUInt32BE(16), body.readUInt32BE(20)]).toEqual([1200, 630]);
  });
});

test.describe('robots.txt y sitemap.xml', () => {
  test('robots.txt permite todo, declara el sitemap y no bloquea iconos ni scripts', async ({
    request,
  }) => {
    const robots = await (await request.get(`${host.origin}/robots.txt`)).text();
    expect(robots).toMatch(/^User-agent: \*$/m);
    expect(robots).toMatch(/^Allow: \/$/m);
    expect(robots).toContain(`Sitemap: ${SITE}sitemap.xml`);
    expect(robots).not.toMatch(/^Disallow:\s*\S/m);
  });

  test('el sitemap lista solo rutas con 200, con lastmod y sin /e/', async ({ request }) => {
    const xml = await (await request.get(`${host.origin}/sitemap.xml`)).text();
    const entries = [
      ...xml.matchAll(/<url><loc>([^<]+)<\/loc><lastmod>([^<]+)<\/lastmod><\/url>/g),
    ];
    expect(entries.map((e) => e[1])).toEqual(ROUTES.map((route) => `${SITE}${route}`));
    for (const [, loc, lastmod] of entries) {
      expect(lastmod).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(Date.parse(lastmod!)).toBeLessThanOrEqual(Date.now() + 86_400_000);
      const path = new URL(loc!).pathname;
      const response = await request.get(`${host.origin}${path}`);
      expect(response.status(), path).toBe(200);
      expect(response.headers()['content-type']).toContain('text/html');
    }
    expect(xml).not.toContain('/e/');
  });
});

test.describe('con y sin JavaScript', () => {
  test('sin JavaScript se ve el texto, los enlaces y el aviso de noscript', async ({ browser }) => {
    const context = await browser.newContext({ javaScriptEnabled: false, serviceWorkers: 'block' });
    const page = await context.newPage();
    await page.goto(`${host.origin}/`);
    await expect(
      page.getByRole('heading', { level: 1, name: /las gasolineras más baratas de España/ }),
    ).toBeVisible();
    await expect(
      page.getByRole('navigation', { name: 'Páginas de Gasora' }).getByRole('link'),
    ).toHaveCount(4);
    // (Playwright no busca texto dentro de <noscript>: se localiza por la etiqueta)
    await expect(page.locator('noscript strong')).toHaveText('Gasora necesita JavaScript');
    await expect(page.locator('noscript strong')).toBeVisible();
    await context.close();
  });

  test('el texto inicial no tiene infracciones de axe ni desborda (se mide mostrándolo, sin la aplicación)', async ({
    page,
  }) => {
    // axe necesita JavaScript: se carga la página sin los scripts de la aplicación y se quita la
    // marca `js`, que es lo que oculta el texto inicial cuando hay JavaScript
    await page.route('**/assets/*.js', (route) => route.abort());
    await page.goto(`${host.origin}/acerca`, { waitUntil: 'domcontentloaded' });
    await page.evaluate(() => document.documentElement.classList.remove('js'));
    await expect(page.getByRole('heading', { level: 1, name: 'Acerca de Gasora' })).toBeVisible();
    const { violations } = await new AxeBuilder({ page }).analyze();
    expect(violations.map((v) => v.id)).toEqual([]);
    for (const width of [320, 390, 768, 1440]) {
      await page.setViewportSize({ width, height: 800 });
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
        `${width} px`,
      ).toBe(true);
    }
  });

  test('con JavaScript el texto inicial desaparece al arrancar la aplicación: un solo h1, sin duplicados', async ({
    page,
  }) => {
    await page.goto(`${host.origin}/`);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(
      /La gasolina más barata, más cerca/,
    );
    await expect(page.locator('.static-intro')).toHaveCount(0);
    await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
  });

  test('con JavaScript pero sin que cargue la aplicación el texto inicial sigue oculto (sin parpadeo ni lectura doble)', async ({
    page,
  }) => {
    await page.route('**/assets/*.js', (route) => route.abort());
    await page.goto(`${host.origin}/`, { waitUntil: 'domcontentloaded' });
    const intro = page.locator('.static-intro');
    await expect(intro).toHaveCount(1);
    await expect(intro).toBeHidden();
    expect(await intro.evaluate((el) => getComputedStyle(el).display)).toBe('none');
    // Fuera del árbol de accesibilidad: un lector de pantalla no lo lee
    await expect(page.getByRole('heading', { level: 1 })).toHaveCount(0);
  });
});
