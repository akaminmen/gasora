/** Rótulos conocidos → brandKey. Orden de frecuencia real (Fase 0). Lo demás es «otras». */
const KNOWN_BRANDS = [
  'REPSOL',
  'MOEVE',
  'CEPSA',
  'GALP',
  'BALLENOIL',
  'PLENERGY',
  'SHELL',
  'PETROPRIX',
  'PETRONOR',
  'CARREFOUR',
  'BP',
  'AVIA',
  'Q8',
  'ESCLATOIL',
  'BONAREA',
  'CAMPSA',
  'VALCARCE',
  'AGLA',
  'ALCAMPO',
  'HAM',
  'ENI',
  'EROSKI',
  'GASEXPRESS',
  'BEROIL',
  'MEROIL',
  'TAMOIL',
  'MOLGAS',
  'IDS',
  'DISA',
  'NATURGY',
  'AUTONETOIL',
  'EASYGAS',
  'PETROCAT',
  'PCAN',
];

export const OTHER_BRAND = 'otras';

const matchers = KNOWN_BRANDS.map((brand) => ({
  key: brand.toLowerCase(),
  // «BP» no debe casar con «BPXYZ»: se exige que no siga una letra o un dígito.
  re: new RegExp(`^${brand}(?![A-Z0-9])`),
}));

function fold(label: string): string {
  return label
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toUpperCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/** Devuelve el brandKey de un rótulo sucio (espacios, acentos, prefijos «E.S.»). */
export function brandKeyOf(label: string): string {
  const folded = fold(label).replace(/^(E\.?\s?S\.?|ESTACION DE SERVICIO)\s+/, '');
  for (const { key, re } of matchers) {
    if (re.test(folded)) return key;
  }
  return OTHER_BRAND;
}
