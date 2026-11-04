import { defineConfig, devices } from '@playwright/test';
import base from './playwright.config';

/**
 * Pruebas contra servicios externos (hoy, los servidores de OpenFreeMap). Se ejecutan aparte del
 * resto de los e2e para que una caída o lentitud de ese servicio no rompa la integración continua.
 * Reintenta dos veces y, si el servicio no responde, la prueba se omite.
 */
export default defineConfig({
  ...base,
  projects: [
    {
      name: 'live',
      use: { ...devices['Desktop Chrome'] },
      testMatch: /.*-live\.spec\.ts/,
    },
  ],
  // Solo hace falta el servidor normal
  webServer: base.webServer instanceof Array ? base.webServer[0] : base.webServer,
  retries: 2,
  workers: 1,
});
