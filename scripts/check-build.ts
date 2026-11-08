import { readdir, readFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

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
else if (notFound !== index) problems.push('dist/404.html no es copia de dist/index.html');

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
};
if (typeof version.sha !== 'string' || version.sha.length < 5) {
  problems.push(
    'Falta dist/version.json con el commit publicado (lo usa la ingesta para no omitir código nuevo)',
  );
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

if (problems.length) {
  console.error(problems.join('\n'));
  process.exitCode = 1;
} else {
  console.log(
    'Build de producción correcto: sin /ui-kit, con 404.html, PWA y ficheros para buscadores.',
  );
}
