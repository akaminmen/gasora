import { describe, expect, it } from 'vitest';
import {
  clean,
  displayName,
  normalizeStations,
  parseDecimal,
  parseMineturDate,
  type RawStation,
} from '../../scripts/normalize';

function raw(overrides: RawStation = {}): RawStation {
  return {
    IDEESS: '1',
    Rótulo: 'REPSOL',
    Dirección: 'CALLE MAYOR, 1',
    'C.P.': '29002',
    Municipio: 'Málaga',
    Provincia: 'MÁLAGA',
    IDMunicipio: '4800',
    IDProvincia: '29',
    Latitud: '36,716667',
    'Longitud (WGS84)': '-4,433333',
    Horario: 'L-D: 24H',
    'Tipo Venta': 'P',
    'Precio Gasolina 95 E5': '1,459',
    'Precio Gasolina 98 E5': '',
    'Precio Gasoleo A': '1,399',
    ...overrides,
  };
}

describe('parseDecimal', () => {
  it('convierte la coma decimal', () => {
    expect(parseDecimal('1,459')).toBe(1.459);
    expect(parseDecimal('-4,433333')).toBe(-4.433333);
  });
  it('trata vacíos y basura como null', () => {
    expect(parseDecimal('')).toBeNull();
    expect(parseDecimal('   ')).toBeNull();
    expect(parseDecimal('abc')).toBeNull();
    expect(parseDecimal(undefined)).toBeNull();
  });
});

describe('displayName', () => {
  it('reordena el artículo final y pasa a título', () => {
    expect(displayName('PALMAS (LAS)')).toBe('Las Palmas');
    expect(displayName('CORUÑA (A)')).toBe('A Coruña');
    expect(displayName('RIOJA (LA)')).toBe('La Rioja');
    expect(displayName('BALEARS (ILLES)')).toBe('Illes Balears');
  });
  it('mantiene las preposiciones en minúscula y las tildes', () => {
    expect(displayName('SANTA CRUZ DE TENERIFE')).toBe('Santa Cruz de Tenerife');
    expect(displayName('MÁLAGA')).toBe('Málaga');
  });
  it('no toca los nombres que ya vienen en mayúsculas y minúsculas', () => {
    expect(displayName('Abengibre')).toBe('Abengibre');
    expect(displayName("Castell-Platja d'Aro")).toBe("Castell-Platja d'Aro");
  });
});

describe('parseMineturDate', () => {
  it('convierte la hora de Madrid a UTC (invierno, UTC+1)', () => {
    expect(parseMineturDate('28/10/2026 16:39:26')).toBe('2026-10-28T15:39:26.000Z');
  });
  it('convierte la hora de Madrid a UTC (verano, UTC+2)', () => {
    expect(parseMineturDate('15/07/2026 12:00:00')).toBe('2026-07-15T10:00:00.000Z');
  });
  it('acepta la hora sin cero inicial del histórico', () => {
    expect(parseMineturDate('27/10/2026 0:00:00')).toBe('2026-10-26T23:00:00.000Z');
  });
  it('rechaza formatos inesperados', () => {
    expect(() => parseMineturDate('2026-10-28')).toThrow();
  });
});

describe('normalizeStations', () => {
  it('normaliza una estación normal a milésimas de euro', () => {
    const { stations, prices, dropped } = normalizeStations([raw()]);
    expect(dropped).toEqual([]);
    expect(stations[0]).toMatchObject({
      id: '1',
      b: 'repsol',
      m: 'Málaga',
      p: 'Málaga',
      pid: 29,
      mid: 4800,
      lat: 36.716667,
      lng: -4.433333,
      s: 'P',
    });
    expect(prices['1']).toEqual([1459, null, 1399, null, null, null]);
  });

  it('limpia espacios del rótulo y rellena el CP de 4 dígitos', () => {
    const { stations } = normalizeStations([raw({ Rótulo: '  REPSOL   ', 'C.P.': '2250' })]);
    expect(stations[0]?.n).toBe('REPSOL');
    expect(stations[0]?.z).toBe('02250');
  });

  it('descarta y registra las coordenadas a 0 (ADR 004)', () => {
    const { stations, dropped } = normalizeStations([
      raw({ Latitud: '0,000000', 'Longitud (WGS84)': '0,000000' }),
    ]);
    expect(stations).toEqual([]);
    expect(dropped[0]?.reason).toBe('coordenadasACero');
  });

  it('descarta y registra las coordenadas intercambiadas sin corregirlas (ADR 004)', () => {
    const { stations, dropped } = normalizeStations([
      raw({ Latitud: '-8,659472', 'Longitud (WGS84)': '42,037472' }),
    ]);
    expect(stations).toEqual([]);
    expect(dropped[0]).toMatchObject({ reason: 'coordenadasIntercambiadas' });
  });

  it('descarta las coordenadas fuera de España que no están intercambiadas', () => {
    const { dropped } = normalizeStations([raw({ Latitud: '48,85', 'Longitud (WGS84)': '2,35' })]);
    expect(dropped[0]?.reason).toBe('fueraDeEspana');
  });

  it('acepta Canarias, Ceuta y Melilla', () => {
    const { stations } = normalizeStations([
      raw({ IDEESS: '10', Latitud: '28,1', 'Longitud (WGS84)': '-15,4' }),
      raw({ IDEESS: '11', Latitud: '35,89', 'Longitud (WGS84)': '-5,32' }),
      raw({ IDEESS: '12', Latitud: '35,29', 'Longitud (WGS84)': '-2,94' }),
    ]);
    expect(stations).toHaveLength(3);
  });

  it('excluye las ventas restringidas (caso sintético: la API real solo trae «P»)', () => {
    const { stations, dropped } = normalizeStations([raw({ 'Tipo Venta': 'R' })]);
    expect(stations).toEqual([]);
    expect(dropped[0]?.reason).toBe('ventaRestringida');
  });

  it('pone a null los precios fuera de rango y los cuenta', () => {
    const { prices, outOfRangePrices } = normalizeStations([
      raw({
        'Precio Gasolina 95 E5': '9,999',
        'Precio Gasoleo A': '0,100',
        'Precio Gasolina 98 E5': '1,600',
      }),
    ]);
    expect(prices['1']).toEqual([null, 1600, null, null, null, null]);
    expect(outOfRangePrices.map((p) => p.value)).toEqual([9999, 100]);
  });

  it('descarta las estaciones que no venden ninguno de los 6 combustibles del MVP', () => {
    const { dropped } = normalizeStations([
      raw({
        'Precio Gasolina 95 E5': '',
        'Precio Gasoleo A': '',
        'Precio Gasolina 95 E10': '1,599',
      }),
    ]);
    expect(dropped[0]?.reason).toBe('sinCombustibleMvp');
  });

  it('descarta los IDs repetidos y los vacíos', () => {
    const { stations, dropped } = normalizeStations([raw(), raw(), raw({ IDEESS: '' })]);
    expect(stations).toHaveLength(1);
    expect(dropped.map((d) => d.reason)).toEqual(['idDuplicado', 'sinId']);
  });

  it('no inventa precios de Gasolina 95 E10 (ADR 002)', () => {
    const { prices } = normalizeStations([raw({ 'Precio Gasolina 95 E10': '1,599' })]);
    expect(prices['1']).toHaveLength(6);
  });
});

describe('clean', () => {
  it('colapsa espacios', () => {
    expect(clean('  A   B ')).toBe('A B');
  });
});
