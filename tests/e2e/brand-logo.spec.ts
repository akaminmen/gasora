import { sellers, stations } from './data';
import { expect, test } from './fixtures';

/**
 * Logos de marca (ADR 015). En el build de los tests solo existen los de Ballenoil y Shell
 * (archivos de prueba que escribe scripts/e2e-data.ts); el resto de marcas usa el avatar.
 */
const ballenoil = stations.find((s) => s.b === 'ballenoil');
// Una estación sin logo propio (marca desconocida), para ver el avatar de respaldo aunque el
// propietario vaya añadiendo logos reales a public/brands/
const plain = sellers('g95e5').find((s) => s.b === 'otras') ?? sellers('g95e5')[0];

test.describe('BrandLogo', () => {
  test('en la galería: logo cuadrado del tamaño del avatar, con alt vacío y fondo claro en el tema oscuro', async ({
    page,
  }) => {
    await page.addInitScript(() => localStorage.setItem('gasora:theme:v1', 'dark'));
    await page.setViewportSize({ width: 1024, height: 900 });
    await page.goto('/ui-kit');
    const logo = page.locator('.station-card .brand-logo').first();
    await expect(logo).toBeVisible();
    const img = logo.locator('img');
    await expect(img).toHaveAttribute('alt', '');
    await expect(img).toHaveAttribute('src', /brands\/(ballenoil|shell)\.svg$/);
    await expect
      .poll(() => img.evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth > 0))
      .toBe(true);
    const box = await logo.boundingBox();
    expect(box!.width).toBe(44);
    expect(box!.height).toBe(44);
    const style = await logo.evaluate((el) => {
      const s = getComputedStyle(el);
      return { bg: s.backgroundColor, fit: getComputedStyle(el.querySelector('img')!).objectFit };
    });
    expect(style.bg).toBe('rgb(248, 250, 252)'); // claro también en el tema oscuro
    expect(style.fit).toBe('contain');
    // El avatar con inicial sigue existiendo para las marcas sin logo, con el mismo tamaño
    const avatar = page.locator('.station-card .brand-avatar').first();
    await expect(avatar).toBeVisible();
    const a = await avatar.boundingBox();
    expect(a!.width).toBe(44);
    expect(a!.height).toBe(44);
  });

  test('a 320 px (avatar de 36 px) el logo mide lo mismo que el avatar', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 900 });
    await page.goto('/ui-kit');
    const logo = page.locator('.station-card__avatar .brand-logo').first();
    const avatar = page.locator('.station-card__avatar .brand-avatar').first();
    const [l, a] = [await logo.boundingBox(), await avatar.boundingBox()];
    expect(l!.width).toBe(a!.width);
    expect(l!.height).toBe(a!.height);
  });

  test('ficha: logo de 52 px si hay y avatar si no', async ({ page }) => {
    await page.goto(`/e/${ballenoil!.id}`);
    const logo = page.getByTestId('station-detail').locator('.brand-logo');
    await expect(logo).toBeVisible();
    expect((await logo.boundingBox())!.width).toBe(52);
    await page.goto(`/e/${plain!.id}`);
    await expect(page.getByTestId('station-detail').locator('.brand-avatar')).toBeVisible();
    await expect(page.getByTestId('station-detail').locator('.brand-logo')).toHaveCount(0);
  });

  test('favoritos: tarjetas con logo o avatar según la marca', async ({ page }) => {
    await page.addInitScript(
      (ids) => localStorage.setItem('gasora:favorites:v1', JSON.stringify(ids)),
      [ballenoil!.id, plain!.id],
    );
    await page.goto('/favoritos');
    await expect(page.getByTestId('station-card')).toHaveCount(2);
    await expect(page.locator('[data-testid="station-card"] .brand-logo')).toHaveCount(1);
    await expect(page.locator('[data-testid="station-card"] .brand-avatar')).toHaveCount(1);
  });

  test('si el archivo no carga, vuelve al avatar sin romper el diseño', async ({ page }) => {
    await page.route('**/brands/ballenoil.svg', (route) => route.fulfill({ status: 404 }));
    await page.goto('/ui-kit');
    const card = page.locator('.station-card', { hasText: 'Ballenoil' }).first();
    await expect(card.locator('.brand-avatar')).toBeVisible();
    await expect(card.locator('.brand-logo')).toHaveCount(0);
    expect((await card.locator('.brand-avatar').boundingBox())!.width).toBe(44);
  });

  test('los pines del mapa no llevan logos', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto('/ui-kit');
    await expect(page.locator('.price-pin__body').first()).toBeVisible();
    await expect(page.locator('.price-pin__body .brand-logo, .price-pin__body img')).toHaveCount(0);
  });
});
