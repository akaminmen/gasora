import { execSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * `npm run licenses`: recoge los paquetes de producción (los que acaban en la web publicada,
 * directos y transitivos, más el código de Workbox que lleva el service worker), escribe
 * `public/licencias-de-terceros.txt` con el aviso y el texto de la licencia de cada uno (se publica
 * con la web y se enlaza desde «Acerca de») e imprime la tabla en Markdown para
 * `docs/licencias-y-atribuciones.md`. Las herramientas de desarrollo no se distribuyen y no salen.
 */
const root = resolve(import.meta.dirname, '..');

/** Módulos de Workbox (y su dependencia `idb`) que se copian al service worker o a la app. */
const RUNTIME_EXTRAS = [
  'workbox-core',
  'workbox-routing',
  'workbox-strategies',
  'workbox-precaching',
  'workbox-expiration',
  'workbox-cacheable-response',
  'workbox-window',
  'idb',
];

export interface Pkg {
  name: string;
  version: string;
  license: string;
  direct: boolean;
  /** Texto del archivo de licencia del paquete (vacío si no lo incluye) */
  text: string;
  homepage: string;
}

const LICENSE_FILE = /^(licen[cs]e|copying|unlicense)(\.(md|txt))?$/i;

function readPackage(dir: string, direct: boolean): Pkg | null {
  const file = resolve(dir, 'package.json');
  if (!existsSync(file)) return null;
  const pkg = JSON.parse(readFileSync(file, 'utf8')) as {
    name?: string;
    version?: string;
    license?: string | { type?: string };
    homepage?: string;
    repository?: string | { url?: string };
  };
  if (!pkg.name || pkg.name === 'gasora') return null;
  const license = typeof pkg.license === 'string' ? pkg.license : (pkg.license?.type ?? '¿?');
  const licenseFile = readdirSync(dir).find((name) => LICENSE_FILE.test(name));
  const repository = typeof pkg.repository === 'string' ? pkg.repository : pkg.repository?.url;
  return {
    name: pkg.name,
    version: pkg.version ?? '',
    license,
    direct,
    text: licenseFile
      ? readFileSync(resolve(dir, licenseFile), 'utf8').replaceAll('\r\n', '\n').trim()
      : '',
    homepage: (pkg.homepage ?? repository ?? '').replace(/^git\+/, ''),
  };
}

/** Paquetes de producción ordenados por nombre. */
export function collectPackages(): Pkg[] {
  const dirs = execSync('npm ls --omit=dev --all --parseable', { cwd: root, maxBuffer: 1e8 })
    .toString()
    .split(/\r?\n/)
    .filter(Boolean);
  const direct = new Set(
    Object.keys(
      (JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8')) as { dependencies: object })
        .dependencies,
    ),
  );
  const found = new Map<string, Pkg>();
  for (const dir of dirs) {
    const pkg = readPackage(dir, false);
    if (pkg) found.set(pkg.name, { ...pkg, direct: direct.has(pkg.name) });
  }
  for (const name of RUNTIME_EXTRAS) {
    const pkg = readPackage(resolve(root, 'node_modules', name), false);
    if (pkg && !found.has(pkg.name)) found.set(pkg.name, pkg);
  }
  return [...found.values()].sort((a, b) => a.name.localeCompare(b.name));
}

const RULE = '='.repeat(78);

/** Contenido de `licencias-de-terceros.txt`. */
export function renderText(packages: Pkg[]): string {
  const out: string[] = [
    'LICENCIAS DE TERCEROS — Gasora',
    '',
    'Gasora se distribuye con el código de los paquetes que se enumeran a continuación, cada uno',
    'con su propia licencia. Se reproducen los avisos de copyright y los textos de licencia que',
    'esas licencias piden conservar. El código propio de Gasora está bajo licencia MIT (ver el',
    'archivo LICENSE del repositorio). Los logos de marcas son de sus respectivos propietarios y',
    'no están cubiertos por ninguna de estas licencias.',
    '',
    `Paquetes incluidos: ${packages.length}.`,
    '',
    'Índice',
    ...packages.map((p) => `  - ${p.name} ${p.version} — ${p.license}`),
    '',
  ];
  for (const pkg of packages) {
    out.push(RULE, `${pkg.name} ${pkg.version} — licencia: ${pkg.license}`);
    if (pkg.homepage) out.push(pkg.homepage);
    out.push(
      '',
      pkg.text ||
        `(El paquete no incluye un archivo de licencia; licencia declarada: ${pkg.license}.)`,
      '',
    );
  }
  out.push(
    RULE,
    'DATOS Y SERVICIOS',
    '',
    'Precios de carburantes: Ministerio para la Transición Ecológica y el Reto Demográfico,',
    '«Precio de carburantes en las gasolineras españolas» (datos.gob.es), reutilizados al amparo de',
    'la Ley 37/2007 sobre reutilización de la información del sector público.',
    '',
    'Mapa: © OpenMapTiles, Data from OpenStreetMap, servido por OpenFreeMap (openfreemap.org).',
    'Datos © colaboradores de OpenStreetMap, disponibles bajo la Open Database License (ODbL);',
    'esquema y diseño de OpenMapTiles bajo licencia CC-BY 4.0.',
    '',
  );
  return out.join('\n');
}

/** Tabla en Markdown de los paquetes. */
export function renderTable(packages: Pkg[]): string {
  return [
    '| Paquete | Versión | Licencia | Dependencia |',
    '| ------- | ------- | -------- | ----------- |',
    ...packages.map(
      (p) => `| ${p.name} | ${p.version} | ${p.license} | ${p.direct ? 'directa' : 'transitiva'} |`,
    ),
  ].join('\n');
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const packages = collectPackages();
  const target = resolve(root, 'public/licencias-de-terceros.txt');
  await writeFile(target, renderText(packages), 'utf8');
  console.error(`Escrito ${target} (${packages.length} paquetes)`);
  console.log(renderTable(packages));
}
