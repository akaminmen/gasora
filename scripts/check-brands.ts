import { existsSync } from 'node:fs';
import { readdir, readFile, stat } from 'node:fs/promises';
import { dirname, extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { BRAND_LOGO_FILES, LOGO_EXTENSIONS, logoFileFor } from '../src/lib/brand-logos';
import { KNOWN_BRANDS } from './brands';
import { svgProblems, WARN_RASTER_BYTES } from './brand-validate';

/**
 * `npm run brands:check`: valida los logos de `public/brands/` (ADR 015).
 *  - Error: archivo que no corresponde a ninguna marca de la tabla (nombre mal escrito), extensión
 *    no admitida, SVG de más de 8 KB, con scripts o con referencias externas, y marcas de la tabla
 *    que no existen en la ingesta.
 *  - Aviso: marcas sin logo (usarán el avatar), logos duplicados con otra extensión, WebP/PNG
 *    pesados.
 * Termina con código 1 solo si hay errores; que falten logos no es un error.
 */
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dir = resolve(root, 'public/brands');
const errors: string[] = [];
const warnings: string[] = [];

const files = existsSync(dir)
  ? (await readdir(dir)).filter((name) => name.toLowerCase() !== 'readme.md')
  : [];

// La tabla debe cubrir exactamente las marcas conocidas de la ingesta
const known = new Set(KNOWN_BRANDS.map((brand) => brand.toLowerCase()));
for (const key of known) {
  if (!(key in BRAND_LOGO_FILES)) errors.push(`La tabla de logos no tiene la marca «${key}»`);
}
for (const key of Object.keys(BRAND_LOGO_FILES)) {
  if (!known.has(key)) errors.push(`La tabla de logos tiene «${key}», que la ingesta no conoce`);
}

const expected = new Map<string, string[]>(); // nombre de archivo sin extensión → marcas
for (const [key, name] of Object.entries(BRAND_LOGO_FILES)) {
  expected.set(name, [...(expected.get(name) ?? []), key]);
}

for (const file of files) {
  const ext = extname(file).slice(1).toLowerCase();
  const name = file.slice(0, file.length - ext.length - 1);
  if (!(LOGO_EXTENSIONS as readonly string[]).includes(ext) || file !== `${name}.${ext}`) {
    errors.push(`${file}: extensión no admitida (${LOGO_EXTENSIONS.join(', ')}, en minúsculas)`);
    continue;
  }
  if (!expected.has(name)) {
    errors.push(
      `${file}: no corresponde a ninguna marca de la tabla (src/lib/brand-logos.ts); ¿está bien escrito el nombre?`,
    );
    continue;
  }
  const path = join(dir, file);
  const bytes = (await stat(path)).size;
  if (bytes === 0) errors.push(`${file}: está vacío`);
  else if (ext === 'svg') {
    for (const problem of svgProblems(await readFile(path, 'utf8'), bytes)) {
      errors.push(`${file}: ${problem}`);
    }
  } else if (bytes > WARN_RASTER_BYTES) {
    warnings.push(`${file}: pesa ${(bytes / 1024).toFixed(1)} KB (recomendado ≤ 30 KB)`);
  }
}

const present = new Set(files);
for (const name of expected.keys()) {
  const found = LOGO_EXTENSIONS.filter((ext) => present.has(`${name}.${ext}`));
  if (found.length > 1) {
    warnings.push(`${name}: hay ${found.map((e) => `.${e}`).join(' y ')}; se usa .${found[0]}`);
  }
}

const withLogo = Object.keys(BRAND_LOGO_FILES).filter((key) => logoFileFor(key, present));
const without = Object.keys(BRAND_LOGO_FILES).filter((key) => !logoFileFor(key, present));
console.log(
  `Logos en public/brands/: ${files.length} · marcas con logo: ${withLogo.length}/${Object.keys(BRAND_LOGO_FILES).length}`,
);
if (without.length) {
  console.log(`\nMarcas sin logo (usan el avatar con la inicial): ${without.length}`);
  for (const key of without)
    console.log(`  ${key.padEnd(12)} → ${BRAND_LOGO_FILES[key]}.svg (o .webp / .png)`);
}
if (warnings.length) console.log(`\nAvisos:\n${warnings.map((w) => `  - ${w}`).join('\n')}`);
if (errors.length) {
  console.error(`\nErrores:\n${errors.map((e) => `  - ${e}`).join('\n')}`);
  process.exitCode = 1;
} else {
  console.log('\nLogos válidos.');
}
