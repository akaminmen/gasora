import { defineConfig, devices } from '@playwright/test';

/**
 * Los tests e2e prueban el build real servido con `npm run preview`, con datos de prueba
 * deterministas (`scripts/e2e-data.ts`, ver `build:e2e`).
 *
 * Proyectos:
 *  - chromium: todos los tests (menos los de servicios externos y los de la PWA).
 *  - firefox y webkit: solo layout, accesibilidad (axe) y teclado. Los umbrales de la tarjeta usan calc()
 *    dentro de @container y hay que comprobarlos fuera de Chromium.
 *  - pwa: service worker, manifiesto y modo sin conexión sobre un build con la subruta /gasora/
 *    (como en GitHub Pages), en el puerto 4174.
 */
export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: true,
  workers: 2,
  // El mapa se dibuja con WebGL por software en Chromium sin interfaz: con varios workers va más lento.
  timeout: 45_000,
  expect: { timeout: 10_000 },
  reporter: [['list']],
  use: {
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
      testIgnore: [/.*-live\.spec\.ts/, /pwa\.spec\.ts/],
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
      testMatch: /(layout|a11y|keyboard)\.spec\.ts/,
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
      testMatch: /(layout|a11y|keyboard)\.spec\.ts/,
    },
    {
      name: 'pwa',
      use: {
        ...devices['Desktop Chrome'],
        baseURL: 'http://127.0.0.1:4174/gasora/',
        serviceWorkers: 'allow',
      },
      testMatch: /pwa\.spec\.ts/,
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
      url: 'http://127.0.0.1:4174/gasora/',
      reuseExistingServer: !process.env['CI'],
      timeout: 120_000,
    },
  ],
});
