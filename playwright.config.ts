import { defineConfig, devices } from '@playwright/test';

/**
 * Los tests e2e prueban el build real servido con `npm run preview`, con datos de prueba
 * deterministas (`scripts/e2e-data.ts`, ver `build:e2e`).
 *
 * Proyectos:
 *  - chromium: todos los tests (menos los de servicios externos y los de la PWA).
 *  - firefox y webkit: solo layout, accesibilidad (axe) y teclado. Los umbrales de la tarjeta usan calc()
 *    dentro de @container y hay que comprobarlos fuera de Chromium.
 *  - pwa: service worker, manifiesto, enlaces profundos y modo sin conexión sobre un build con la base /
 *    (como en GitHub Pages), en el puerto 4174.
 */
export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: true,
  workers: 2,
  // El mapa se dibuja con WebGL por software en Chromium sin interfaz: con varios workers va más lento.
  timeout: 45_000,
  expect: { timeout: 10_000 },
  // En la CI (CI=true) una prueba que falla se repite una vez: si pasa, se informa como «flaky» (no se
  // oculta) y el resto de fallos siguen siendo rojos. Las trazas de la repetición se guardan.
  retries: process.env['CI'] ? 1 : 0,
  reporter: process.env['CI'] ? [['list'], ['github']] : [['list']],
  use: {
    trace: 'on-first-retry',
    baseURL: 'http://127.0.0.1:4173',
    locale: 'es-ES',
    timezoneId: 'Europe/Madrid',
    // Sin service worker salvo en el proyecto «pwa»: no debe alterar el resto de tests
    serviceWorkers: 'block',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
      // Las pruebas contra servicios externos van aparte: playwright.live.config.ts
      testIgnore: [/.*-live\.spec\.ts/, /(pwa|deep-links|seo)\.spec\.ts/, /mobile-.*\.spec\.ts/],
    },
    {
      name: 'firefox',
      use: {
        ...devices['Desktop Firefox'],
        // En los equipos sin GPU (la CI de Linux) Firefox desactiva WebGL: se fuerza el de software
        launchOptions: {
          firefoxUserPrefs: { 'webgl.force-enabled': true, 'webgl.disabled': false },
        },
      },
      testMatch: /(layout|a11y|keyboard|install-ui)\.spec\.ts/,
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
      testMatch: /(layout|a11y|keyboard|install-ui)\.spec\.ts/,
    },
    {
      name: 'mobile-webkit',
      use: { ...devices['iPhone 11 Pro'] },
      testMatch: /mobile-.*\.spec\.ts/,
    },
    {
      name: 'pwa',
      use: {
        ...devices['Desktop Chrome'],
        baseURL: 'http://127.0.0.1:4174/',
        serviceWorkers: 'allow',
      },
      testMatch: /(pwa|deep-links|seo)\.spec\.ts/,
    },
  ],
  webServer: [
    {
      command: 'npm run build:e2e && npm run preview',
      url: 'http://127.0.0.1:4173',
      reuseExistingServer: !process.env['CI'],
      timeout: 120_000,
    },
    {
      command: 'npm run build:e2e:base && npm run preview:base',
      url: 'http://127.0.0.1:4174/',
      reuseExistingServer: !process.env['CI'],
      timeout: 120_000,
    },
  ],
});
