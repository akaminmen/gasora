import { expect, test } from './fixtures';
import type { Page } from '@playwright/test';
import { BIG_CP } from './data';

/** Calculadora de ahorro (F9): litros, combustible, comparación y conteo animado. */
test.use({ viewport: { width: 1440, height: 900 } });

const search = (page: Page) => page.getByRole('combobox', { name: /Buscar por provincia/ }).first();
const amount = (page: Page) => page.getByTestId('calc-amount');

async function searchThenCalculator(page: Page, query = BIG_CP) {
  await page.goto('/');
  await search(page).fill(query);
  await search(page).press('Enter');
  await expect(page.getByTestId('station-card').first()).toBeVisible();
  await page
    .getByRole('navigation', { name: 'Principal' })
    .first()
    .getByRole('link', { name: 'Calculadora' })
    .click();
  await expect(page.getByTestId('calc-result')).toBeVisible();
}

/** Valor final del importe, tomado del texto para lectores de pantalla (no de la animación). */
async function finalAmount(page: Page): Promise<number> {
  const text = (await page.getByTestId('calc-result').getByRole('status').textContent()) ?? '';
  const match = /Ahorras ([\d.]+,\d{2}) euros/.exec(text);
  if (!match?.[1]) throw new Error(`Sin importe en «${text}»`);
  return Number(match[1].replace('.', '').replace(',', '.'));
}

test('sin una búsqueda previa explica qué hacer y enlaza al buscador', async ({ page }) => {
  await page.goto('/calculadora');
  await expect(page.getByRole('heading', { name: 'Primero busca gasolineras' })).toBeVisible();
  await page.getByRole('link', { name: 'Buscar gasolineras' }).click();
  await expect(page).toHaveURL('/');
});

test('calcula el ahorro de la zona buscada y lo explica', async ({ page }) => {
  await searchThenCalculator(page);
  const saving = await finalAmount(page);
  expect(saving).toBeGreaterThanOrEqual(0);
  await expect(page.getByTestId('calc-detail')).toContainText('frente a la media de la zona');
  await expect(page.getByTestId('calc-detail')).toContainText('con 50 L');
  await expect(page.getByTestId('calc-zone')).toContainText(`CP ${BIG_CP}`);
});

test('el importe cuenta hasta el valor final y se anuncia una sola vez', async ({ page }) => {
  await searchThenCalculator(page);
  const final = await finalAmount(page);
  await expect(amount(page)).toHaveAttribute('data-done', 'true');
  await expect(amount(page)).toHaveText(
    final.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
  );
  // El texto que cuenta es decorativo para lectores de pantalla
  await expect(amount(page)).toHaveAttribute('aria-hidden', 'true');
});

test('con «reducir movimiento» el importe aparece ya en su valor final', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await searchThenCalculator(page);
  const final = await finalAmount(page);
  await expect(amount(page)).toHaveText(
    final.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
  );
  await expect(amount(page)).not.toHaveAttribute('data-done', 'true');
});

test('los litros cambian el ahorro de forma proporcional y se recuerdan', async ({ page }) => {
  await searchThenCalculator(page);
  const at50 = await finalAmount(page);
  await page.getByRole('button', { name: '30 L' }).click();
  await expect.poll(() => finalAmount(page)).not.toBe(at50);
  const at30 = await finalAmount(page);
  if (at50 > 0) expect(Math.abs(at30 - (at50 * 30) / 50)).toBeLessThan(0.02);
  await page.getByRole('button', { name: 'Añadir 5 litros' }).click();
  await expect(page.getByRole('spinbutton', { name: 'Litros del depósito' })).toHaveValue('35');
  expect(await page.evaluate(() => localStorage.getItem('gasora:liters:v1'))).toBe('35');
  await page.reload();
  await expect(page.getByRole('spinbutton', { name: 'Litros del depósito' })).toHaveValue('35');
});

test('los litros se limitan entre 1 y 120', async ({ page }) => {
  await page.goto('/calculadora');
  const input = page.getByRole('spinbutton', { name: 'Litros del depósito' });
  await input.fill('500');
  await expect(input).toHaveValue('120');
  await input.fill('80');
  await expect(input).toHaveValue('80');
  await page.getByRole('button', { name: 'Añadir 5 litros' }).click();
  await expect(input).toHaveValue('85');
  for (let i = 0; i < 30; i++) await page.getByRole('button', { name: 'Quitar 5 litros' }).click();
  await expect(input).toHaveValue('1');
});

test('el ahorro de las tarjetas usa los mismos litros que la calculadora', async ({ page }) => {
  await page.goto('/calculadora');
  await page.getByRole('button', { name: '60 L' }).click();
  await page.goto('/');
  await search(page).fill(BIG_CP);
  await search(page).press('Enter');
  const text = await page.locator('.station-card__saving').first().textContent();
  expect(text).toMatch(/Ahorras [\d.,]+ € por depósito/);
});

test('comparar con la más cercana: solo con ubicación o código postal', async ({ page }) => {
  await searchThenCalculator(page);
  const near = page.getByRole('button', { name: /^La más cercana/ });
  await expect(near).toBeEnabled();
  await near.click();
  await expect(near).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByTestId('calc-detail')).toContainText('frente a la más cercana');
});

test('para una provincia, «la más cercana» no está disponible y lo explica', async ({ page }) => {
  await searchThenCalculator(page, 'Málaga');
  const near = page.getByRole('button', { name: /^La más cercana/ });
  await expect(near).toBeDisabled();
  await expect(near).toContainText('Disponible al buscar por ubicación o código postal');
  await expect(page.getByRole('button', { name: /^La media de la zona/ })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
});

test('cambiar de combustible recalcula (y es el mismo que en los resultados)', async ({ page }) => {
  await searchThenCalculator(page);
  await page.getByRole('main').getByRole('button', { name: 'Diésel', exact: true }).click();
  await expect(page.getByTestId('calc-zone')).toBeVisible();
  await page.getByRole('link', { name: 'Inicio' }).first().click();
  await expect(page.getByRole('button', { name: 'Diésel', exact: true }).first()).toHaveAttribute(
    'aria-pressed',
    'true',
  );
});

test('zonas táctiles de 44 px y sin desbordes en móvil, también con el texto al 200 %', async ({
  page,
}) => {
  for (const fontScale of [100, 200]) {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');
    await search(page).fill(BIG_CP);
    await search(page).press('Enter');
    await expect(page.getByTestId('station-card').first()).toBeVisible();
    await page.goto('/calculadora');
    await page.evaluate((scale) => {
      document.documentElement.style.fontSize = `${scale}%`;
    }, fontScale);
    const problems = await page.evaluate(() => {
      const issues: string[] = [];
      const overflow = document.documentElement.scrollWidth - document.documentElement.clientWidth;
      if (overflow > 0) issues.push(`desborda ${overflow}px`);
      for (const el of document.querySelectorAll<HTMLElement>('main button, main input')) {
        const r = el.getBoundingClientRect();
        if (r.width > 0 && (r.height < 43.5 || (el.tagName === 'BUTTON' && r.width < 43.5))) {
          issues.push(
            `${el.tagName} ${el.getAttribute('aria-label') ?? el.textContent?.slice(0, 15)}`,
          );
        }
      }
      return issues;
    });
    expect(problems, `texto al ${fontScale} %`).toEqual([]);
  }
});
