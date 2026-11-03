import { readdir, readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { brotliCompressSync, constants, gzipSync } from 'node:zlib';

/** Tamaño de los ficheros de datos: en bruto, gzip (nivel 9) y brotli (calidad 11). */
const dir = resolve(process.argv[2] ?? 'public/data');
const kb = (bytes: number) => `${(bytes / 1024).toFixed(1)} KB`;

const names = (await readdir(dir)).filter((n) => n.endsWith('.json')).sort();
interface Row {
  name: string;
  raw: number;
  gzip: number;
  brotli: number;
}
const rows: Row[] = [];
for (const name of names) {
  const buffer = await readFile(join(dir, name));
  rows.push({
    name,
    raw: buffer.length,
    gzip: gzipSync(buffer, { level: 9 }).length,
    brotli: brotliCompressSync(buffer, {
      params: { [constants.BROTLI_PARAM_QUALITY]: 11 },
    }).length,
  });
}

const initial = rows.filter((r) => r.name !== 'search-index.json');
const sum = (list: typeof rows, key: 'raw' | 'gzip' | 'brotli') =>
  list.reduce((total, r) => total + r[key], 0);

for (const r of rows) {
  console.log(
    `${r.name.padEnd(28)} bruto ${kb(r.raw).padStart(10)}  gzip ${kb(r.gzip).padStart(9)}  brotli ${kb(r.brotli).padStart(9)}`,
  );
}
for (const [label, list] of [
  ['Carga inicial (meta + estaciones + precios)', initial],
  ['Todo (con el índice de búsqueda)', rows],
] as const) {
  console.log(
    `${label}: bruto ${kb(sum(list, 'raw'))}, gzip ${kb(sum(list, 'gzip'))}, brotli ${kb(sum(list, 'brotli'))}`,
  );
}
