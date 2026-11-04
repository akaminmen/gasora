import { describe, expect, it } from 'vitest';
import { KNOWN_BRANDS } from '../../scripts/brands';
import { MAX_SVG_BYTES, svgProblems } from '../../scripts/brand-validate';
import { BRANDS_URL } from '../../scripts/pwa-caching';
import { BRAND_LOGO_FILES, logoFileFor } from '../../src/lib/brand-logos';

describe('tabla de logos', () => {
  it('tiene una entrada por cada marca conocida de la ingesta, y ninguna más', () => {
    expect(Object.keys(BRAND_LOGO_FILES).sort()).toEqual(
      KNOWN_BRANDS.map((brand) => brand.toLowerCase()).sort(),
    );
  });

  it('los nombres de archivo son seguros (minúsculas, cifras y guiones)', () => {
    for (const name of Object.values(BRAND_LOGO_FILES)) expect(name).toMatch(/^[a-z0-9-]+$/);
  });

  it('elige svg antes que webp y webp antes que png', () => {
    const all = new Set(['repsol.png', 'repsol.webp', 'repsol.svg']);
    expect(logoFileFor('repsol', all)).toBe('repsol.svg');
    expect(logoFileFor('repsol', new Set(['repsol.png', 'repsol.webp']))).toBe('repsol.webp');
    expect(logoFileFor('repsol', new Set(['repsol.png']))).toBe('repsol.png');
  });

  it('sin archivo, o con una marca desconocida, no hay logo (se usa el avatar)', () => {
    expect(logoFileFor('repsol', new Set())).toBeUndefined();
    expect(logoFileFor('repsol', new Set(['shell.svg']))).toBeUndefined();
    expect(logoFileFor('otras', new Set(['otras.svg']))).toBeUndefined();
    expect(logoFileFor('ejemplo', new Set(['ejemplo.svg']))).toBeUndefined();
  });

  it('dos marcas pueden compartir archivo', () => {
    const table = { moeve: 'moeve', cepsa: 'moeve' };
    expect(logoFileFor('cepsa', new Set(['moeve.svg']), table)).toBe('moeve.svg');
  });
});

describe('validación de SVG', () => {
  const ok =
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><path d="M0 0h10v10z"/></svg>';

  it('acepta un SVG simple', () => {
    expect(svgProblems(ok, ok.length)).toEqual([]);
  });
  it('acepta referencias internas (#id)', () => {
    const svg =
      '<svg xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="g"/></defs><rect fill="url(#g)"/><use href="#g"/></svg>';
    expect(svgProblems(svg, svg.length)).toEqual([]);
  });
  it('rechaza más de 8 KB', () => {
    expect(svgProblems(ok, MAX_SVG_BYTES + 1).join()).toMatch(/máximo 8 KB/);
  });
  it('rechaza scripts, manejadores y javascript:', () => {
    expect(svgProblems('<svg><script>alert(1)</script></svg>', 40).join()).toMatch(/<script>/);
    expect(svgProblems('<svg onload="x()"></svg>', 30).join()).toMatch(/manejadores/);
    expect(svgProblems('<svg><a href="javascript:x()"/></svg>', 40).join()).toMatch(/javascript/);
  });
  it('rechaza referencias externas', () => {
    expect(svgProblems('<svg><image href="https://x.test/a.png"/></svg>', 50).join()).toMatch(
      /href/,
    );
    expect(svgProblems('<svg><image xlink:href="a.png"/></svg>', 50).join()).toMatch(/href/);
    expect(svgProblems('<svg><rect style="fill:url(https://x.test/g)"/></svg>', 60).join()).toMatch(
      /url\(\)/,
    );
    expect(svgProblems('<svg><style>@import "x.css";</style></svg>', 50).join()).toMatch(/@import/);
    expect(svgProblems('<svg><foreignObject/></svg>', 30).join()).toMatch(/foreignObject/);
  });
  it('rechaza lo que no es un SVG', () => {
    expect(svgProblems('<html></html>', 13).join()).toMatch(/no es un SVG/);
  });
});

describe('caché de los logos', () => {
  it('guarda los de la propia web (con subruta o sin ella) y nada más', () => {
    expect(BRANDS_URL.test('https://akaminmen.github.io/gasora/brands/repsol.svg')).toBe(true);
    expect(BRANDS_URL.test('http://127.0.0.1:4173/brands/shell.webp')).toBe(true);
    expect(BRANDS_URL.test('https://akaminmen.github.io/gasora/brands/README.md')).toBe(false);
    expect(BRANDS_URL.test('https://akaminmen.github.io/gasora/brands/repsol.svg?x=1')).toBe(false);
    expect(BRANDS_URL.test('https://akaminmen.github.io/gasora/assets/logo.svg')).toBe(false);
  });
});
