import { defineConfig } from '@playwright/test';
import base from './playwright.config';

/**
 * Pruebas contra servicios externos (hoy, los servidores de OpenFreeMap). Se ejecutan aparte del
 * resto de los e2e para que una caída o lentitud de ese servicio no rompa la integración continua.
 * Reintenta dos veces y, si el servicio no responde, la prueba se omite.
 */
export default defineConfig({
  ...base,
  testIgnore: undefined,
  testMatch: /.*-live\.spec\.ts/,
  retries: 2,
  workers: 1,
});
