import { describe, expect, it } from 'vitest';
import { FONTS_URL, MAX_CACHED_TILES, STYLE_URL, TILES_URL } from '../../scripts/pwa-caching';
import { shouldApplyInBackground, UPDATE_CHECK_MS } from '../../src/pwa/policy';

describe('qué peticiones del mapa se guardan sin conexión', () => {
  const tile = 'https://tiles.openfreemap.org/planet/20261101_080013_pt/12/2013/1585.pbf';

  it('las teselas vectoriales y las de relieve', () => {
    expect(TILES_URL.test(tile)).toBe(true);
    expect(TILES_URL.test('https://tiles.openfreemap.org/natural_earth/ne2sr/3/4/2.png')).toBe(
      true,
    );
  });
  it('no las de otros servidores ni otras rutas', () => {
    expect(TILES_URL.test('https://evil.example/planet/v/1/2/3.pbf')).toBe(false);
    expect(TILES_URL.test('https://tiles.openfreemap.org.evil.example/planet/v/1/2/3.pbf')).toBe(
      false,
    );
    expect(TILES_URL.test('https://tiles.openfreemap.org/planet/v/1/2/3.pbf?x=1')).toBe(false);
    expect(TILES_URL.test('https://tiles.openfreemap.org/styles/positron')).toBe(false);
  });
  it('estilo, sprites y TileJSON van a su caché; las tipografías, a la suya', () => {
    expect(STYLE_URL.test('https://tiles.openfreemap.org/styles/dark')).toBe(true);
    expect(STYLE_URL.test('https://tiles.openfreemap.org/sprites/ofm_f384/ofm.json')).toBe(true);
    expect(STYLE_URL.test('https://tiles.openfreemap.org/planet')).toBe(true);
    expect(STYLE_URL.test(tile)).toBe(false);
    expect(FONTS_URL.test('https://tiles.openfreemap.org/fonts/Noto%20Sans%20Bold/0-255.pbf')).toBe(
      true,
    );
  });
  it('el tope de teselas guardadas queda muy por debajo del límite de OpenFreeMap', () => {
    const OPENFREEMAP_MAX_TILES = 3000;
    const OPENFREEMAP_MAX_MB = 50;
    const WORST_TILE_KB = 80; // holgado: las teselas vectoriales suelen medir 20–60 KB
    expect(MAX_CACHED_TILES).toBeLessThan(OPENFREEMAP_MAX_TILES / 2);
    expect((MAX_CACHED_TILES * WORST_TILE_KB) / 1024).toBeLessThan(OPENFREEMAP_MAX_MB);
  });
});

describe('cuándo se activa una versión nueva', () => {
  it('con la app a la vista no se activa sola: se avisa', () => {
    expect(shouldApplyInBackground({ needRefresh: true, visibility: 'visible' })).toBe(false);
  });
  it('en segundo plano se activa sola, para no dejar versiones viejas', () => {
    expect(shouldApplyInBackground({ needRefresh: true, visibility: 'hidden' })).toBe(true);
  });
  it('sin versión nueva esperando no hace nada', () => {
    expect(shouldApplyInBackground({ needRefresh: false, visibility: 'hidden' })).toBe(false);
  });
  it('se busca una versión nueva cada hora como máximo', () => {
    expect(UPDATE_CHECK_MS).toBeGreaterThanOrEqual(30 * 60 * 1000);
    expect(UPDATE_CHECK_MS).toBeLessThanOrEqual(24 * 60 * 60 * 1000);
  });
});
