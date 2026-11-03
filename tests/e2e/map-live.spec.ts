import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect, test } from '@playwright/test';

/**
 * Prueba contra los servidores reales de OpenFreeMap (sin estilo de sustitución): comprueba que el
 * estilo claro y el oscuro existen y que MapLibre muestra la atribución obligatoria
 * «© OpenMapTiles, Data from OpenStreetMap». Si no hay red, se omite (no cuenta como fallo).
 *
 * AISLADA del `npm run test:e2e` normal (depende de un servicio externo): se lanza con
 * `npm run test:e2e:live` y, en la CI, en un trabajo aparte que no bloquea la integración.
 */
const index = JSON.parse(
  readFileSync(resolve(import.meta.dirname, '../../dist/data/search-index.json'), 'utf8'),
) as { postalCodes: { code: string; count: number }[] };
const CP = [...index.postalCodes].sort((a, b) => b.count - a.count)[0]?.code ?? '29002';
const STYLE = (name: string) => `https://tiles.openfreemap.org/styles/${name}`;

test.describe('OpenFreeMap real', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test.beforeAll(async ({ request }) => {
    const reachable = await request
      .get(STYLE('positron'), { timeout: 8000 })
      .then((r) => r.ok())
      .catch(() => false);
    test.skip(!reachable, 'Sin acceso a tiles.openfreemap.org: prueba omitida');
  });

  for (const name of ['positron', 'dark']) {
    test(`el estilo «${name}» existe y es un estilo válido`, async ({ request }) => {
      const response = await request.get(STYLE(name));
      expect(response.ok()).toBe(true);
      const style = (await response.json()) as {
        version: number;
        sources: Record<string, unknown>;
        layers: unknown[];
        glyphs: string;
      };
      expect(style.version).toBe(8);
      expect(Object.keys(style.sources)).toContain('openmaptiles');
      expect(style.layers.length).toBeGreaterThan(20);
    });
  }

  test('la atribución se ve en el mapa, en claro y en oscuro', async ({ page }) => {
    for (const theme of ['light', 'dark']) {
      await page.addInitScript((t) => localStorage.setItem('gasora:theme:v1', t), theme);
      await page.goto('/');
      const box = page.getByRole('combobox', { name: /Buscar por provincia/ }).first();
      await box.fill(CP);
      await box.press('Enter');
      await expect(page.getByTestId('map')).toHaveAttribute('data-ready', 'true');
      const attribution = page.locator('.maplibregl-ctrl-attrib');
      await expect(attribution).toContainText('OpenMapTiles', { timeout: 20_000 });
      await expect(attribution).toContainText('OpenStreetMap');
      await expect(attribution).toContainText('OpenFreeMap');
      await expect(attribution).toBeInViewport();
      await page.evaluate(() => localStorage.clear());
    }
  });
});
