import { expect, test } from './fixtures';
import { FUEL_INDEX, prices, stations, someStation } from './data';

/** Ficha real en /e/:id (F7 y F14): enlace directo, compartir, favorito y casos raros. */
test.use({ viewport: { width: 1440, height: 900 } });

test('el enlace directo muestra la ficha: precio, 6 combustibles, horario, cómo llegar', async ({
  page,
}) => {
  const s = someStation();
  await page.goto(`/e/${s.id}`);
  await expect(page.getByRole('heading', { level: 1 })).toContainText(s.n);
  const detail = page.getByTestId('station-detail');
  await expect(detail).toBeVisible();
  await expect(page.getByTestId('detail-price')).toHaveText(/\d,\d{3}/);
  await expect(
    detail.getByRole('group', { name: 'Precios de todos los combustibles' }),
  ).toContainText('Gasolina 95');
  await expect(detail.getByText(/Datos del Ministerio consultados el/)).toBeVisible();
  await expect(detail.getByText('Cómo llegar')).toBeVisible();
  await expect(page).toHaveTitle(`${s.n} · Gasora`);
  // Los precios de la ficha son los de los datos
  const expected = (prices[s.id]?.[FUEL_INDEX.g95e5] ?? 0) / 1000;
  await expect(page.getByTestId('detail-price')).toHaveText(expected.toFixed(3).replace('.', ','));
});

test('«Cómo llegar» ofrece Google Maps, Apple Maps y Waze con las coordenadas', async ({
  page,
}) => {
  const s = someStation();
  await page.goto(`/e/${s.id}`);
  await page.getByText('Cómo llegar').click();
  const links = page.getByTestId('station-detail').getByRole('link');
  await expect(links).toHaveText(['Google Maps', 'Apple Maps', 'Waze']);
  await expect(links.first()).toHaveAttribute(
    'href',
    /google\.com\/maps\/dir\/\?api=1&destination=/,
  );
});

test('un id que no existe muestra «ya no está disponible» con salida', async ({ page }) => {
  await page.goto('/e/99999999');
  await expect(
    page.getByRole('heading', { name: 'Esta gasolinera ya no está disponible' }),
  ).toBeVisible();
  await expect(page.getByRole('heading', { level: 1 })).toContainText('99999999');
  await page.getByRole('link', { name: 'Buscar gasolineras' }).click();
  await expect(page).toHaveURL('/');
});

test('una favorita que desapareció se puede quitar desde su ficha', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('gasora:favorites:v1', '["99999999"]'));
  await page.goto('/e/99999999');
  await page.getByRole('button', { name: 'Quitar de favoritos' }).click();
  expect(await page.evaluate(() => localStorage.getItem('gasora:favorites:v1'))).toBe('[]');
});

test('si no vende el combustible elegido, lo avisa y muestra otro', async ({ page }) => {
  const only = stations.find(
    (s) => prices[s.id]?.[FUEL_INDEX.g95e5] == null && prices[s.id]?.some((p) => p != null),
  );
  test.skip(!only, 'Todos los datos de prueba venden gasolina 95');
  await page.goto(`/e/${only?.id}`);
  await expect(page.getByTestId('fuel-note')).toContainText('no vende Gasolina 95');
  await expect(page.getByTestId('detail-price')).toHaveText(/\d,\d{3}/);
});

test('el favorito de la ficha se guarda y persiste', async ({ page }) => {
  const s = someStation();
  await page.goto(`/e/${s.id}`);
  await page.getByRole('button', { name: /^Guardar .* en favoritos$/ }).click();
  await expect(page.getByRole('button', { name: /^Quitar .* de favoritos$/ })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await page.reload();
  await expect(page.getByRole('button', { name: /^Quitar .* de favoritos$/ })).toBeVisible();
});

test.describe('compartir', () => {
  test('con la Web Share API comparte el enlace absoluto de la ficha', async ({ page }) => {
    const s = someStation();
    await page.addInitScript(() => {
      (window as unknown as { shared: unknown[] }).shared = [];
      navigator.share = (data) => {
        (window as unknown as { shared: unknown[] }).shared.push(data);
        return Promise.resolve();
      };
    });
    await page.goto(`/e/${s.id}`);
    await page.getByRole('button', { name: 'Compartir' }).click();
    const shared = await page.evaluate(
      () => (window as unknown as { shared: { url: string; title: string }[] }).shared,
    );
    expect(shared).toHaveLength(1);
    expect(shared[0]?.url).toBe(`http://127.0.0.1:4173/e/${s.id}`);
    expect(shared[0]?.title).toContain(s.n);
  });

  test('sin Web Share API copia el enlace y avisa', async ({ page, context }) => {
    const s = someStation();
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'share', { value: undefined, configurable: true });
    });
    await page.goto(`/e/${s.id}`);
    await page.getByRole('button', { name: 'Compartir' }).click();
    await expect(page.getByText('Enlace copiado.')).toBeVisible();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
      `http://127.0.0.1:4173/e/${s.id}`,
    );
  });

  test('si el usuario cancela el diálogo, no avisa de nada', async ({ page }) => {
    await page.addInitScript(() => {
      navigator.share = () => Promise.reject(new DOMException('cancelado', 'AbortError'));
    });
    await page.goto(`/e/${someStation().id}`);
    await page.getByRole('button', { name: 'Compartir' }).click();
    await page.waitForTimeout(300);
    await expect(page.getByText('Enlace copiado.')).toHaveCount(0);
    await expect(page.getByText('No se ha podido compartir')).toHaveCount(0);
  });
});
