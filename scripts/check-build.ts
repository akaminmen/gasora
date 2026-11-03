import { readdir, readFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Comprueba el build de producción (dist/): la galería /ui-kit es solo para desarrollo y tests, así
 * que ni su chunk ni sus textos deben llegar al sitio publicado; y debe existir 404.html para que
 * GitHub Pages sirva los enlaces directos (/e/:id).
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

if (problems.length) {
  console.error(problems.join('\n'));
  process.exitCode = 1;
} else {
  console.log('Build de producción correcto: sin /ui-kit y con 404.html.');
}
