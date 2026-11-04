import { expect, test } from './fixtures';

/**
 * Apéndice B del plan: ubicación concedida, denegada y sin soporte. «Concedida» y «denegada» se
 * prueban en map.spec.ts y a11y.spec.ts; aquí, el navegador que no ofrece geolocalización.
 */
test('sin soporte de geolocalización: aviso claro y se puede seguir buscando por zona', async ({
  page,
}) => {
  await page.addInitScript(() => {
    delete (Navigator.prototype as { geolocation?: unknown }).geolocation;
  });
  await page.goto('/');
  expect(await page.evaluate(() => 'geolocation' in navigator)).toBe(false);
  await page.getByRole('button', { name: 'Usar mi ubicación' }).click();
  await expect(page.getByText('Tu navegador no permite obtener la ubicación')).toBeVisible();
  // El buscador por zona sigue disponible
  await expect(page.getByRole('combobox', { name: /Buscar por provincia/ }).first()).toBeVisible();
});
