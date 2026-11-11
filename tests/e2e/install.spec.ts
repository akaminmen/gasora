import { expect, test } from './fixtures';

/** Página /instalar y botón de la cabecera (Chromium). */
const UA = {
  iphone:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
  android:
    'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36',
  windowsEdge:
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36 Edg/126.0.0.0',
};

test.describe('página /instalar', () => {
  test('enlace directo y recarga, un solo h1, título y descripción propios', async ({ page }) => {
    await page.goto('/instalar');
    await expect(page.getByRole('heading', { level: 1, name: 'Instalar Gasora' })).toBeVisible();
    await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
    await expect(page).toHaveTitle('Instalar Gasora');
    await expect(page.locator('meta[name="description"]')).toHaveAttribute(
      'content',
      /instalar Gasora en el iPhone/,
    );
    await page.reload();
    await expect(page.getByRole('heading', { level: 1, name: 'Instalar Gasora' })).toBeVisible();
    // Las tres familias de dispositivos están siempre visibles, con los pasos en listas ordenadas
    for (const name of ['iPhone y iPad', 'Android', 'Ordenador', 'Si no te aparece la opción']) {
      await expect(page.getByRole('heading', { level: 2, name })).toBeVisible();
    }
    expect(await page.locator('ol').count()).toBeGreaterThanOrEqual(5);
    // Al salir se restaura el título de la página
    await page.getByRole('link', { name: 'Gasora, ir al inicio' }).click();
    await expect(page).toHaveTitle(/^Gasora/);
  });

  test('está en el sitemap generado', async ({ request }) => {
    const sitemap = await (await request.get('/sitemap.xml')).text();
    expect(sitemap).toContain('<loc>https://gasora.es/instalar</loc>');
  });

  for (const [name, ua, device] of [
    ['iPhone', UA.iphone, 'ios'],
    ['Android', UA.android, 'android'],
    ['Windows con Edge', UA.windowsEdge, 'desktop'],
  ] as const) {
    test(`detecta ${name} y destaca solo esa sección, sin ocultar las demás`, async ({
      browser,
    }) => {
      const context = await browser.newContext({ userAgent: ua, hasTouch: device !== 'desktop' });
      const page = await context.newPage();
      await page.goto('/instalar');
      await expect(page.getByTestId(`install-${device}`)).toHaveAttribute('data-current', 'true');
      await expect(page.getByTestId('install-current-badge')).toHaveCount(1);
      for (const other of ['ios', 'android', 'desktop'].filter((d) => d !== device)) {
        await expect(page.getByTestId(`install-${other}`)).toHaveAttribute('data-current', 'false');
        await expect(page.getByTestId(`install-${other}`)).toBeVisible();
      }
      if (device === 'desktop') {
        await expect(page.getByTestId('install-browser-desktop-edge')).toHaveAttribute(
          'data-current',
          'true',
        );
      }
      // No se simula ningún botón de instalar: solo existe con el evento real del navegador
      await expect(page.getByTestId('install-now')).toHaveCount(0);
      await context.close();
    });
  }

  test('«Instalar ahora» aparece con beforeinstallprompt y lo usa; si no hay evento, no existe', async ({
    page,
  }) => {
    await page.goto('/instalar');
    await expect(page.getByRole('button', { name: 'Instalar ahora' })).toHaveCount(0);
    await page.evaluate(() => {
      const w = window as unknown as { __prompted: number };
      w.__prompted = 0;
      const event = new Event('beforeinstallprompt', { cancelable: true });
      Object.assign(event, {
        prompt: () => {
          w.__prompted += 1;
          return Promise.resolve();
        },
        userChoice: Promise.resolve({ outcome: 'accepted' }),
      });
      window.dispatchEvent(event);
    });
    const button = page.getByRole('button', { name: 'Instalar ahora' });
    await expect(button).toBeVisible();
    await button.click();
    expect(
      await page.evaluate(() => (window as unknown as { __prompted: number }).__prompted),
    ).toBe(1);
    // Tras instalarse, lo dice y quita el botón
    await page.evaluate(() => window.dispatchEvent(new Event('appinstalled')));
    await expect(page.getByTestId('install-already')).toBeVisible();
    await expect(button).toHaveCount(0);
  });

  test('instalada (display-mode: standalone): lo dice, sin botón ni icono en la cabecera', async ({
    browser,
  }) => {
    const context = await browser.newContext({
      viewport: { width: 390, height: 800 },
      hasTouch: true,
    });
    await context.addInitScript(() => {
      const original = window.matchMedia.bind(window);
      window.matchMedia = (query: string) => {
        const result = original(query);
        if (!query.includes('display-mode: standalone')) return result;
        return new Proxy(result, {
          get: (target, key) => {
            if (key === 'matches') return true;
            const value = Reflect.get(target, key) as unknown;
            return typeof value === 'function' ? value.bind(target) : value;
          },
        });
      };
    });
    const page = await context.newPage();
    await page.goto('/instalar');
    await expect(page.getByTestId('install-already')).toBeVisible();
    await expect(page.getByTestId('header-install')).toHaveCount(0);
    await context.close();
  });

  test('instalada en iOS (navigator.standalone): sin icono en la cabecera', async ({ browser }) => {
    const context = await browser.newContext({ viewport: { width: 390, height: 800 } });
    await context.addInitScript(() => {
      Object.defineProperty(navigator, 'standalone', { value: true });
    });
    const page = await context.newPage();
    await page.goto('/');
    await expect(page.getByRole('link', { name: 'Acerca de Gasora' })).toBeVisible();
    await expect(page.getByTestId('header-install')).toHaveCount(0);
    await context.close();
  });
});

test.describe('icono de instalar en la cabecera', () => {
  for (const width of [320, 360, 375, 390, 414, 639]) {
    test(`${width} px: visible, con nombre accesible, 44 px y lleva a /instalar`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 800 });
      await page.goto('/');
      const link = page.getByRole('link', { name: 'Instalar la aplicación' });
      await expect(link).toBeVisible();
      const box = (await link.boundingBox())!;
      expect(box.width).toBeGreaterThanOrEqual(43.5);
      expect(box.height).toBeGreaterThanOrEqual(43.5);
      await link.click();
      await expect(page).toHaveURL(/\/instalar$/);
      await expect(page.getByRole('heading', { level: 1, name: 'Instalar Gasora' })).toBeVisible();
    });
  }
  for (const width of [640, 768, 1024, 1440]) {
    test(`${width} px (tablet y escritorio): la cabecera no muestra el icono`, async ({ page }) => {
      await page.setViewportSize({ width, height: 800 });
      await page.goto('/');
      await expect(page.getByTestId('header-install')).toBeHidden();
    });
  }
  test('«Acerca de» enlaza a las instrucciones con «Ver instrucciones»', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/acerca');
    await page.getByRole('link', { name: 'Ver instrucciones' }).click();
    await expect(page).toHaveURL(/\/instalar$/);
  });
});
