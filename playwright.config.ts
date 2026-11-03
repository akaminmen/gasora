import { defineConfig } from '@playwright/test';

/** Los tests e2e prueban el build real servido con `npm run preview` (necesita public/data). */
export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: true,
  reporter: [['list']],
  use: { baseURL: 'http://127.0.0.1:4173', locale: 'es-ES', timezoneId: 'Europe/Madrid' },
  webServer: {
    command: 'npm run build:e2e && npm run preview',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: !process.env['CI'],
    timeout: 120_000,
  },
});
