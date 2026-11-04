import { execSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * `npm run licenses`: lista en Markdown los paquetes de producción (los que acaban en la web
 * publicada, directos y transitivos) con su versión y su licencia. Sirve para actualizar la tabla de
 * `docs/licencias-y-atribuciones.md`. Las herramientas de desarrollo no se distribuyen y no salen.
 */
const root = resolve(import.meta.dirname, '..');
const dirs = execSync('npm ls --omit=dev --all --parseable', { cwd: root, maxBuffer: 1e8 })
  .toString()
  .split(/\r?\n/)
  .filter(Boolean);

const rows = new Map<string, { version: string; license: string; direct: boolean }>();
const direct = new Set(
  Object.keys(
    (JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8')) as { dependencies: object })
      .dependencies,
  ),
);
for (const dir of dirs) {
  const file = resolve(dir, 'package.json');
  if (!existsSync(file)) continue;
  const pkg = JSON.parse(readFileSync(file, 'utf8')) as {
    name?: string;
    version?: string;
    license?: string | { type?: string };
  };
  if (!pkg.name || pkg.name === 'gasora') continue;
  const license = typeof pkg.license === 'string' ? pkg.license : (pkg.license?.type ?? '¿?');
  rows.set(pkg.name, { version: pkg.version ?? '', license, direct: direct.has(pkg.name) });
}

console.log('| Paquete | Versión | Licencia | Dependencia |');
console.log('| ------- | ------- | -------- | ----------- |');
for (const [name, row] of [...rows].sort(([a], [b]) => a.localeCompare(b))) {
  console.log(
    `| ${name} | ${row.version} | ${row.license} | ${row.direct ? 'directa' : 'transitiva'} |`,
  );
}
