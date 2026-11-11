import { BIG_CP } from './data';
import { expect, test } from './fixtures';
import { waitForMap } from './map-support';

/** Tablet y escritorio: el desplegable de marcas cabe en la ventana y se usa con el teclado. */
for (const [width, height] of [
  [640, 800],
  [768, 1024],
  [1023, 700],
  [1024, 700],
  [1440, 900],
] as const) {
  test(`${width}×${height}: el desplegable de marcas cabe en la ventana y se maneja con teclado`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height });
    await page.goto('/');
    const box = page.getByRole('combobox', { name: /Buscar por provincia/ }).first();
    await box.fill(BIG_CP);
    await box.press('Enter');
    await waitForMap(page);
    const trigger = page.getByRole('button', { name: /^Marcas/ });
    await trigger.focus();
    await page.keyboard.press('Enter');
    const panel = page.getByRole('group', { name: 'Marcas' });
    await expect(panel).toBeVisible();
    const r = await panel.evaluate((el) => {
      const b = el.getBoundingClientRect();
      return { l: b.left, t: b.top, r: b.right, b: b.bottom, w: innerWidth, h: innerHeight };
    });
    expect(r.l).toBeGreaterThanOrEqual(0);
    expect(r.t).toBeGreaterThanOrEqual(0);
    expect(r.r).toBeLessThanOrEqual(r.w);
    expect(r.b).toBeLessThanOrEqual(r.h);
    // Teclado: el foco entra, se mueve con Tab dentro del desplegable y Esc lo cierra devolviéndolo
    expect(
      await page.evaluate(
        () => !!document.activeElement?.closest('[role="group"][aria-label="Marcas"]'),
      ),
    ).toBe(true);
    await page.keyboard.press('Tab');
    await page.keyboard.press('Space');
    await page.keyboard.press('Escape');
    await expect(panel).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Marcas (1)' })).toBeFocused();
    // No usa el diálogo modal
    await expect(page.getByRole('dialog')).toHaveCount(0);
  });
}
