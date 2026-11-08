import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';

/**
 * Espera a que el mapa esté listo. Firefox en un equipo sin GPU ni WebGL de software (la CI de
 * Linux) no puede iniciar MapLibre y la aplicación muestra «No se ha podido cargar el mapa»: en ese
 * caso, y solo en Firefox, el test se omite con su motivo en lugar de fallar. En Chromium y WebKit
 * un mapa que no arranca sigue siendo un fallo.
 */
export async function waitForMap(page: Page): Promise<void> {
  const ready = page.locator('[data-testid="map"][data-ready="true"]');
  const unavailable = page.getByTestId('map-unavailable');
  await expect(ready.or(unavailable).first()).toBeVisible({ timeout: 15_000 });
  if ((await unavailable.count()) > 0) {
    test.skip(
      test.info().project.name === 'firefox',
      'Firefox sin WebGL en este equipo: el mapa no se puede iniciar',
    );
    throw new Error('El mapa no está disponible (¿WebGL?)');
  }
}
