import { describe, expect, it } from 'vitest';
import { brandKeyOf } from '../../scripts/brands';

describe('brandKeyOf', () => {
  it('reconoce las marcas con rótulo sucio', () => {
    expect(brandKeyOf('REPSOL ')).toBe('repsol');
    expect(brandKeyOf('  repsol')).toBe('repsol');
    expect(brandKeyOf('E.S. REPSOL')).toBe('repsol');
    expect(brandKeyOf('ESTACIÓN DE SERVICIO CEPSA')).toBe('cepsa');
    expect(brandKeyOf('BP OIL')).toBe('bp');
    expect(brandKeyOf('Q8')).toBe('q8');
  });
  it('trata Cepsa y Moeve como marcas distintas (el rebautizado convive en los datos)', () => {
    expect(brandKeyOf('MOEVE')).toBe('moeve');
    expect(brandKeyOf('CEPSA')).toBe('cepsa');
  });
  it('no confunde prefijos de otras palabras', () => {
    expect(brandKeyOf('BPXTRA')).toBe('otras');
    expect(brandKeyOf('HAMBURGO OIL')).toBe('otras');
  });
  it('manda lo desconocido a «otras»', () => {
    expect(brandKeyOf('Nº 10.935')).toBe('otras');
    expect(brandKeyOf('SIN RÓTULO')).toBe('otras');
    expect(brandKeyOf('')).toBe('otras');
  });
});
