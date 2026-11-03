import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readDataset } from './dataset-io';

/** Test de datos del pipeline: lee public/data, valida el contrato y falla si algo no cuadra. */
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const MIN_STATIONS = 5000;

const { meta, stations, searchIndex } = await readDataset(resolve(root, 'public', 'data'));

if (!meta.demo && meta.stationCount < MIN_STATIONS) {
  throw new Error(`Solo ${meta.stationCount} estaciones: se esperaban al menos ${MIN_STATIONS}`);
}
console.log(
  `Datos válidos: ${stations.stations.length} estaciones, ${searchIndex.provinces.length} provincias, ` +
    `${searchIndex.municipalities.length} municipios, ${searchIndex.postalCodes.length} códigos postales, ` +
    `fuente ${meta.sourceDate}${meta.demo ? ' (demostración)' : ''}`,
);
