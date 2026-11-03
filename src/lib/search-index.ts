import type { SearchIndex } from './data-schema';
import type { Place } from './place';

/** Minúsculas y sin acentos (NFD), para buscar sin fijarse en tildes ni mayúsculas. */
export function fold(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

export interface PlaceSuggestion {
  /** id estable del <option> */
  id: string;
  group: 'Provincia' | 'Municipio' | 'CP';
  text: string;
  /** Provincia del municipio */
  detail?: string;
  count: number;
  place: Place;
}

export interface Searcher {
  municipalityName(id: number): string | undefined;
  provinceName(id: number): string | undefined;
  suggest(
    query: string,
    limit?: { province: number; municipality: number; postal: number },
  ): PlaceSuggestion[];
}

interface Entry {
  folded: string;
  /** Posiciones donde empieza cada palabra del nombre */
  words: string[];
  suggestion: PlaceSuggestion;
}

const DEFAULT_LIMITS = { province: 3, municipality: 6, postal: 4 };

/** Puntuación: 0 empieza por la consulta, 1 una palabra empieza por ella, 2 la contiene. */
function rank(entry: Entry, q: string): number {
  if (entry.folded.startsWith(q)) return 0;
  if (entry.words.some((word) => word.startsWith(q))) return 1;
  return entry.folded.includes(q) ? 2 : -1;
}

function pick(entries: Entry[], q: string, max: number): PlaceSuggestion[] {
  const scored: { entry: Entry; rank: number }[] = [];
  for (const entry of entries) {
    const r = rank(entry, q);
    if (r >= 0) scored.push({ entry, rank: r });
  }
  scored.sort(
    (a, b) =>
      a.rank - b.rank ||
      b.entry.suggestion.count - a.entry.suggestion.count ||
      a.entry.folded.localeCompare(b.entry.folded),
  );
  return scored.slice(0, max).map((s) => s.entry.suggestion);
}

/**
 * Buscador en memoria sobre provincias, municipios y códigos postales. Insensible a acentos y
 * mayúsculas. Si la consulta son solo dígitos, busca códigos postales que empiecen por ellos.
 */
export function createSearcher(index: SearchIndex): Searcher {
  const provinceName = new Map(index.provinces.map((p) => [p.id, p.name]));

  const provinces: Entry[] = index.provinces.map((p) => ({
    folded: fold(p.name),
    words: fold(p.name).split(' '),
    suggestion: {
      id: `sug-prov-${p.id}`,
      group: 'Provincia',
      text: p.name,
      count: p.count,
      place: { kind: 'province', label: p.name, id: p.id, lat: p.lat, lng: p.lng },
    },
  }));
  const municipalities: Entry[] = index.municipalities.map((m) => ({
    folded: fold(m.name),
    words: fold(m.name).split(' '),
    suggestion: {
      id: `sug-mun-${m.id}`,
      group: 'Municipio',
      text: m.name,
      detail: provinceName.get(m.pid),
      count: m.count,
      place: {
        kind: 'municipality',
        label: m.name,
        id: m.id,
        pid: m.pid,
        lat: m.lat,
        lng: m.lng,
      },
    },
  }));
  const postalCodes = index.postalCodes.map((c) => ({
    code: c.code,
    suggestion: {
      id: `sug-cp-${c.code}`,
      group: 'CP' as const,
      text: c.code,
      count: c.count,
      place: {
        kind: 'postal' as const,
        label: `CP ${c.code}`,
        code: c.code,
        lat: c.lat,
        lng: c.lng,
      },
    },
  }));

  const municipalityNames = new Map(index.municipalities.map((m) => [m.id, m.name]));

  return {
    municipalityName: (id) => municipalityNames.get(id),
    provinceName: (id) => provinceName.get(id),
    suggest(query, limit = DEFAULT_LIMITS) {
      const q = fold(query);
      if (q.length === 0) return [];
      if (/^\d+$/.test(q)) {
        return postalCodes
          .filter((c) => c.code.startsWith(q))
          .sort((a, b) => b.suggestion.count - a.suggestion.count || a.code.localeCompare(b.code))
          .slice(0, limit.postal + limit.municipality)
          .map((c) => c.suggestion);
      }
      if (q.length < 2) return [];
      return [
        ...pick(provinces, q, limit.province),
        ...pick(municipalities, q, limit.municipality),
      ];
    },
  };
}
