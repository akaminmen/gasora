import { expect, test } from './fixtures';

const THEME_KEY = 'gasora:theme:v1';

test.describe('fondo de mapa de la ilustración del inicio', () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  for (const theme of ['light', 'dark'] as const) {
    test(`tema ${theme}: imagen propia, con tamaño, detrás de pines y tarjeta, sin MapLibre`, async ({
      page,
    }) => {
      await page.addInitScript(
        ([key, value]) => localStorage.setItem(key!, value!),
        [THEME_KEY, theme],
      );
      const requests: string[] = [];
      page.on('request', (r) => requests.push(r.url()));
      await page.goto('/');

      const hero = page.getByTestId('hero-preview');
      const img = hero.getByTestId('hero-map');
      await expect(img).toBeVisible();
      await expect(img).toHaveAttribute('width', '600');
      await expect(img).toHaveAttribute('height', '560');
      await expect(img).toHaveAttribute('src', new RegExp(`hero-map-${theme}-.*[.]webp$`));
      // Cargada de verdad (no solo el elemento)
      await expect
        .poll(() => img.evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth))
        .toBe(600);

      // El fondo ocupa toda la caja y queda por detrás de pines, tarjetas y rótulos
      const box = await hero.locator('.map-sample').boundingBox();
      const imgBox = await img.boundingBox();
      // Dentro del borde de 1 px de la caja
      expect(imgBox!.x).toBeCloseTo(box!.x + 1, 0);
      expect(imgBox!.y).toBeCloseTo(box!.y + 1, 0);
      expect(imgBox!.width).toBeCloseTo(box!.width - 2, 0);
      expect(imgBox!.height).toBeCloseTo(box!.height - 2, 0);
      const zIndexOk = await hero.evaluate((root) => {
        const image = root.querySelector('[data-testid="hero-map"]')!;
        return [...image.parentElement!.children].indexOf(image) === 0;
      });
      expect(zIndexOk).toBe(true);

      await expect(hero.getByText('Ejemplo ilustrativo')).toBeVisible();
      await expect(hero.getByText('Ahorras en un depósito de 50 L')).toBeVisible();
      const attribution = hero.getByText('OpenFreeMap © OpenMapTiles Data from OpenStreetMap');
      await expect(attribution).toBeVisible();
      const a = await attribution.boundingBox();
      expect(a!.x).toBeGreaterThanOrEqual(box!.x);
      expect(a!.x + a!.width).toBeLessThanOrEqual(box!.x + box!.width);
      expect(a!.y + a!.height).toBeLessThanOrEqual(box!.y + box!.height);

      // Solo se descarga la imagen del tema activo y la portada no pide teselas ni MapLibre
      const other = theme === 'light' ? 'dark' : 'light';
      expect(requests.some((u) => u.includes(`hero-map-${other}`))).toBe(false);
      expect(requests.some((u) => /openfreemap|maplibre/i.test(u))).toBe(false);
    });
  }

  test('al cambiar de tema cambia el fondo', async ({ page }) => {
    await page.goto('/');
    const img = page.getByTestId('hero-map');
    await expect(img).toHaveAttribute('src', /hero-map-light/);
    await page
      .getByRole('button', { name: /tema oscuro|oscuro/i })
      .first()
      .click();
    await expect(img).toHaveAttribute('src', /hero-map-dark/);
  });
});

test('por debajo de lg la ilustración no descarga el fondo', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 800 });
  const requests: string[] = [];
  page.on('request', (r) => requests.push(r.url()));
  await page.goto('/');
  await expect(page.getByTestId('hero-preview')).toBeHidden();
  expect(requests.some((u) => u.includes('hero-map'))).toBe(false);
});

test('la atribución no se solapa con la tarjeta ni con el rótulo a ningún ancho de escritorio', async ({
  page,
}) => {
  for (const width of [1024, 1100, 1280, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/');
    const hero = page.getByTestId('hero-preview');
    const attribution = (await hero
      .getByText('OpenFreeMap © OpenMapTiles Data from OpenStreetMap')
      .boundingBox())!;
    const box = (await hero.locator('.map-sample').boundingBox())!;
    expect(attribution.x, `${width}px`).toBeGreaterThanOrEqual(box.x);
    expect(attribution.x + attribution.width, `${width}px`).toBeLessThanOrEqual(box.x + box.width);
    for (const other of [
      hero.getByText('Ahorras en un depósito de 50 L'),
      hero.getByText('Ejemplo ilustrativo'),
    ]) {
      const o = (await other.boundingBox())!;
      const apart =
        attribution.y + attribution.height <= o.y ||
        o.y + o.height <= attribution.y ||
        attribution.x + attribution.width <= o.x ||
        o.x + o.width <= attribution.x;
      expect(apart, `${width}px`).toBe(true);
    }
  }
});
