import { SCHEMA_VERSION, type SearchIndex, type Station } from '../src/lib/data-schema';

interface Acc {
  name: string;
  pid: number;
  count: number;
  latSum: number;
  lngSum: number;
  latMin: number;
  lngMin: number;
  latMax: number;
  lngMax: number;
}

const round = (n: number) => Math.round(n * 1e5) / 1e5;

function add(map: Map<string | number, Acc>, key: string | number, s: Station, name: string) {
  const acc = map.get(key) ?? {
    name,
    pid: s.pid,
    count: 0,
    latSum: 0,
    lngSum: 0,
    latMin: Infinity,
    lngMin: Infinity,
    latMax: -Infinity,
    lngMax: -Infinity,
  };
  acc.count += 1;
  acc.latSum += s.lat;
  acc.lngSum += s.lng;
  acc.latMin = Math.min(acc.latMin, s.lat);
  acc.lngMin = Math.min(acc.lngMin, s.lng);
  acc.latMax = Math.max(acc.latMax, s.lat);
  acc.lngMax = Math.max(acc.lngMax, s.lng);
  map.set(key, acc);
}

const centroid = (a: Acc) => ({ lat: round(a.latSum / a.count), lng: round(a.lngSum / a.count) });
const bbox = (a: Acc): [number, number, number, number] => [
  round(a.latMin),
  round(a.lngMin),
  round(a.latMax),
  round(a.lngMax),
];

/** Índice de búsqueda: provincias, municipios y códigos postales con centroide y nº de estaciones. */
export function buildSearchIndex(stations: Station[]): SearchIndex {
  const provinces = new Map<string | number, Acc>();
  const municipalities = new Map<string | number, Acc>();
  const postalCodes = new Map<string | number, Acc>();

  for (const s of stations) {
    add(provinces, s.pid, s, s.p);
    add(municipalities, s.mid, s, s.m);
    if (s.z) add(postalCodes, s.z, s, s.z);
  }

  return {
    schema: SCHEMA_VERSION,
    provinces: [...provinces]
      .map(([id, a]) => ({
        id: Number(id),
        name: a.name,
        ...centroid(a),
        bbox: bbox(a),
        count: a.count,
      }))
      .sort((x, y) => x.id - y.id),
    municipalities: [...municipalities]
      .map(([id, a]) => ({
        id: Number(id),
        name: a.name,
        pid: a.pid,
        ...centroid(a),
        bbox: bbox(a),
        count: a.count,
      }))
      .sort((x, y) => x.id - y.id),
    postalCodes: [...postalCodes]
      .map(([code, a]) => ({ code: String(code), ...centroid(a), count: a.count }))
      .sort((x, y) => x.code.localeCompare(y.code)),
  };
}
