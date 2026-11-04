import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDataset, type RawResponse } from './build-dataset';
import { writeDataset } from './dataset-io';

/**
 * Datos de prueba para los e2e: la muestra real de `fixtures/` con las estaciones de Málaga
 * multiplicadas por 6 y las de Albacete por 4, con coordenadas y precios algo distintos. Así los
 * tests tienen una zona con más de 200 estaciones (para «Ver más» y la agrupación) sin depender de
 * lo que publique el Ministerio ese día. Es determinista: la misma muestra da siempre los mismos
 * ficheros.
 */
const COPIES: Record<string, number> = { MÁLAGA: 6, ALBACETE: 4 };
const FIRST_NEW_ID = 9_000_000;

const parse = (text: unknown) => Number(String(text ?? '').replace(',', '.'));
const format = (value: number, digits: number) => value.toFixed(digits).replace('.', ',');

export function amplifyFixture(raw: RawResponse): RawResponse {
  const extra: Record<string, unknown>[] = [];
  let nextId = FIRST_NEW_ID;
  for (const station of raw.ListaEESSPrecio as Record<string, unknown>[]) {
    const copies = COPIES[String(station['Provincia']).toUpperCase()] ?? 1;
    for (let j = 1; j < copies; j++) {
      const clone: Record<string, unknown> = { ...station, IDEESS: String(nextId++) };
      // Desplazamientos fijos (de unos 0,2 a 1 km) según el número de copia
      clone['Latitud'] = format(parse(station['Latitud']) + (((j * 7) % 11) - 5) * 0.003, 6);
      clone['Longitud (WGS84)'] = format(
        parse(station['Longitud (WGS84)']) + (((j * 5) % 9) - 4) * 0.003,
        6,
      );
      for (const key of Object.keys(clone)) {
        if (!key.startsWith('Precio ') || clone[key] === '') continue;
        const price = parse(clone[key]) + (((j * 13) % 9) - 4) * 0.004;
        if (Number.isFinite(price)) clone[key] = format(price, 3);
      }
      extra.push(clone);
    }
  }
  return {
    ...raw,
    ListaEESSPrecio: [...raw.ListaEESSPrecio, ...extra] as RawResponse['ListaEESSPrecio'],
  };
}

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const isMain =
  process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMain) {
  const args = process.argv.slice(2);
  const outIndex = args.indexOf('--out');
  const out = resolve(root, outIndex >= 0 ? (args[outIndex + 1] ?? 'dist/data') : 'dist/data');
  const raw = JSON.parse(
    await readFile(resolve(root, 'fixtures/estaciones-terrestres.sample.json'), 'utf8'),
  ) as RawResponse;
  const { dataset } = buildDataset(amplifyFixture(raw), {
    demo: true,
    now: new Date('2026-10-28T16:00:00Z'),
  });
  await writeDataset(out, dataset);
  // Dos logos de prueba (rectangulares, para comprobar object-fit): el resto de marcas usa el avatar.
  // Solo existen en el build de los tests e2e (ver `brandFiles` en vite.config.ts).
  const brandsDir = resolve(out, '..', 'brands');
  await mkdir(brandsDir, { recursive: true });
  for (const [file, color] of [
    ['ballenoil.svg', '#0f766e'],
    ['shell.svg', '#b45309'],
  ] as const) {
    await writeFile(
      resolve(brandsDir, file),
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 60"><rect width="120" height="60" fill="${color}"/><circle cx="60" cy="30" r="22" fill="#fff"/></svg>`,
    );
  }
  console.log(`Datos de prueba: ${dataset.meta.stationCount} estaciones en ${out}`);
}
