import { readdir, readFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { HOME_META, PUBLIC_PATHS, STATIC_PAGES } from '../src/lib/page-meta.ts';
import { renderNotFoundPage, renderStaticPage } from './static-pages.ts';

/**
 * Comprueba el build de producción (dist/): la galería /ui-kit es solo para desarrollo y tests, así
 * que ni su chunk ni sus textos deben llegar al sitio publicado; y debe existir 404.html para que
 * GitHub Pages sirva los enlaces directos (/e/:id). También debe ser una PWA completa: manifiesto
 * enlazado, iconos, service worker que guarda la aplicación (y el mapa) pero no los datos, y los
 * ficheros para buscadores.
 */
const dist = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'dist');
const assets = join(dist, 'assets');
const problems: string[] = [];

for (const name of await readdir(assets)) {
  if (/uikit/i.test(name))
    problems.push(`dist/assets/${name}: el chunk de /ui-kit está en producción`);
  if (name.endsWith('.js')) {
    const code = await readFile(join(assets, name), 'utf8');
    if (code.includes('Tarjeta de resultado (sección 9.7)')) {
      problems.push(`dist/assets/${name}: contiene textos de la galería /ui-kit`);
    }
  }
}

const [index, notFound] = await Promise.all([
  readFile(join(dist, 'index.html'), 'utf8'),
  readFile(join(dist, '404.html'), 'utf8').catch(() => null),
]);
if (notFound === null) problems.push('Falta dist/404.html (fallback de GitHub Pages)');
else if (notFound !== renderNotFoundPage(index)) {
  problems.push('dist/404.html no es dist/index.html con noindex');
}

// PWA y SEO
const exists = async (file: string) =>
  readFile(join(dist, file)).then(
    () => true,
    () => false,
  );
for (const file of [
  'sw.js',
  'manifest.webmanifest',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/icon-maskable-512.png',
  'apple-touch-icon.png',
  'favicon.ico',
  'favicon-48x48.png',
  'og-image.png',
  'robots.txt',
  'sitemap.xml',
]) {
  if (!(await exists(file))) problems.push(`Falta dist/${file}`);
}
if (!/rel="manifest"/.test(index)) problems.push('index.html no enlaza el manifiesto');
if (index.includes('%SITE_URL%')) problems.push('index.html conserva el marcador %SITE_URL%');
const sw = await readFile(join(dist, 'sw.js'), 'utf8').catch(() => '');
if (/\/data\/[^"']*\.json/.test(sw))
  problems.push('dist/sw.js guarda los datos JSON en la caché de la aplicación');
if (!/MapCanvas-[\w-]+\.js/.test(sw)) problems.push('dist/sw.js no guarda el trozo del mapa');
if (!/maplibre-gl-worker-[\w-]+\.js/.test(sw))
  problems.push('dist/sw.js no guarda el worker del mapa');
if (/og-image|404\.html/.test(sw.split('precacheAndRoute')[1]?.split('])')[0] ?? '')) {
  problems.push('dist/sw.js guarda ficheros que no hacen falta sin conexión (og-image, 404.html)');
}

const precache = sw.split('precacheAndRoute')[1]?.split('])')[0] ?? '';
if (/brands\//.test(precache)) {
  problems.push('dist/sw.js guarda los logos de marca en la precarga (deben guardarse al usarse)');
}
if (!/gasora-brand-logos-v1/.test(sw)) {
  problems.push('dist/sw.js no tiene la caché de ejecución de los logos de marca');
}

const version = JSON.parse(
  await readFile(join(dist, 'version.json'), 'utf8').catch(() => '{}'),
) as {
  sha?: string;
  site?: string;
};
if (typeof version.sha !== 'string' || version.sha.length < 5) {
  problems.push(
    'Falta dist/version.json con el commit publicado (lo usa la ingesta para no omitir código nuevo)',
  );
}
// La dirección y la ruta base deben coincidir: si no, la web carga el HTML pero no sus ficheros
const siteBase = /^https?:\/\/[^/]+(\/.*)$/.exec(version.site ?? '')?.[1];
if (!siteBase || !siteBase.endsWith('/')) {
  problems.push('dist/version.json no lleva la dirección pública (site) con la barra final');
} else {
  const local = [...index.matchAll(/\s(?:src|href)="(\/[^"/][^"]*)"/g)].map((m) => m[1] ?? '');
  const outside = local.filter((url) => !url.startsWith(siteBase));
  if (!local.length || outside.length) {
    problems.push(
      `dist/index.html pide ficheros fuera de la ruta base ${siteBase}: ${outside.slice(0, 3).join(', ') || '(ninguno encontrado)'}`,
    );
  }
}
const licenses = await readFile(join(dist, 'licencias-de-terceros.txt'), 'utf8').catch(() => '');
if (!/maplibre-gl/.test(licenses) || licenses.length < 10_000) {
  problems.push('Falta dist/licencias-de-terceros.txt o está incompleto (npm run licenses)');
}
const homeHtml = await readFile(join(dist, 'index.html'), 'utf8');
const hint = /<meta name="gasora-stations" content="([^"]*)"/.exec(homeHtml)?.[1] ?? '';
if (!/^stations\.[0-9a-f]+\.json$/.test(hint) || !(await exists(`data/${hint}`))) {
  problems.push('dist/index.html no lleva el nombre del fichero de estaciones (gasora-stations)');
}

// Pantallas públicas: cada una con su HTML (estado 200 en GitHub Pages) y en el sitemap; nada más
const publishedSite = version.site ?? '';
for (const page of STATIC_PAGES) {
  const html = await readFile(join(dist, `${page.path}.html`), 'utf8').catch(() => null);
  if (html === null)
    problems.push(`Falta dist/${page.path}.html (la ruta /${page.path} daría 404)`);
  else if (html !== renderStaticPage(index, page, publishedSite)) {
    problems.push(
      `dist/${page.path}.html no coincide con index.html y los metadatos de la pantalla`,
    );
  }
  if (precache.includes(`${page.path}.html`)) {
    problems.push(
      `dist/sw.js guarda ${page.path}.html en la precarga (navigateFallback ya lo cubre)`,
    );
  }
}
const sitemap = await readFile(join(dist, 'sitemap.xml'), 'utf8').catch(() => '');
const sitemapUrls = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
const expectedUrls = PUBLIC_PATHS.map((path) => `${publishedSite}${path}`);
if (JSON.stringify(sitemapUrls) !== JSON.stringify(expectedUrls)) {
  problems.push(
    `dist/sitemap.xml no lista exactamente las pantallas públicas: ${sitemapUrls.join(', ')}`,
  );
}

// Iconos: declarados en el <head> de cada página, con el tamaño que dicen y servibles
const pngSize = (data: Buffer) => ({ w: data.readUInt32BE(16), h: data.readUInt32BE(20) });
const iconChecks: [string, number][] = [
  ['favicon-48x48.png', 48],
  ['icons/icon-192.png', 192],
  ['apple-touch-icon.png', 180],
];
for (const [file, size] of iconChecks) {
  const data = await readFile(join(dist, file)).catch(() => null);
  if (!data) continue;
  const got = pngSize(data);
  if (got.w !== size || got.h !== size)
    problems.push(`dist/${file} mide ${got.w}×${got.h}, no ${size}×${size}`);
}
const ico = await readFile(join(dist, 'favicon.ico')).catch(() => Buffer.alloc(0));
const icoSizes = Array.from(
  { length: ico.length >= 6 ? ico.readUInt16LE(4) : 0 },
  (_, i) => ico[6 + 16 * i] ?? 0,
);
if (icoSizes.join() !== '16,32,48')
  problems.push(`dist/favicon.ico lleva los tamaños ${icoSizes.join(', ') || '—'}, no 16, 32 y 48`);
const iconTags = [
  '<link rel="icon" href="/favicon.ico" sizes="16x16 32x32 48x48" />',
  '<link rel="icon" type="image/svg+xml" href="/favicon.svg" sizes="any" />',
  '<link rel="icon" type="image/png" href="/favicon-48x48.png" sizes="48x48" />',
  '<link rel="icon" type="image/png" href="/icons/icon-192.png" sizes="192x192" />',
  '<link rel="apple-touch-icon" href="/apple-touch-icon.png" sizes="180x180" />',
];

// Texto en el HTML inicial (sin JavaScript), datos estructurados solo en la portada y noindex solo en 404.html
const pages: [string, string, string][] = [
  ['index.html', index, HOME_META.heading],
  ...(await Promise.all(
    STATIC_PAGES.map(async (page): Promise<[string, string, string]> => [
      `${page.path}.html`,
      await readFile(join(dist, `${page.path}.html`), 'utf8').catch(() => ''),
      page.heading,
    ]),
  )),
];
for (const [file, html, heading] of pages) {
  for (const tag of iconTags)
    if (!html.includes(tag)) problems.push(`dist/${file} no declara: ${tag}`);
  if (!html.includes(`<main class="static-intro">`) || !html.includes(`<h1>${heading}</h1>`)) {
    problems.push(`dist/${file} no lleva el texto inicial con su h1 «${heading}»`);
  }
  if ((html.match(/<h1[ >]/g) ?? []).length !== 1)
    problems.push(`dist/${file} no tiene exactamente un h1 en el HTML inicial`);
  if (!/<noscript>[\s\S]*JavaScript[\s\S]*<\/noscript>/.test(html))
    problems.push(`dist/${file} no lleva el bloque noscript`);
  if (/name="robots"/.test(html))
    problems.push(`dist/${file} lleva una etiqueta robots (solo 404.html la lleva)`);
  const hasLd = html.includes('application/ld+json');
  if (hasLd !== (file === 'index.html'))
    problems.push(`dist/${file}: los datos estructurados solo van en la portada`);
}
if (notFound !== null && !/name="robots" content="noindex"/.test(notFound))
  problems.push('dist/404.html no lleva noindex');
const lastmods = [...sitemap.matchAll(/<lastmod>([^<]+)<\/lastmod>/g)].map((m) => m[1] ?? '');
if (
  lastmods.length !== PUBLIC_PATHS.length ||
  lastmods.some((d) => !/^\d{4}-\d{2}-\d{2}$/.test(d))
) {
  problems.push('dist/sitemap.xml: cada dirección debe llevar una lastmod AAAA-MM-DD');
}

if (problems.length) {
  console.error(problems.join('\n'));
  process.exitCode = 1;
} else {
  console.log(
    'Build de producción correcto: sin /ui-kit, con 404.html, una página por pantalla pública, PWA y ficheros para buscadores.',
  );
}
