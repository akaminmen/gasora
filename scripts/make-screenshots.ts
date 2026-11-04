import { execSync } from 'node:child_process';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { dirname, extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium, type Page } from '@playwright/test';

/**
 * Capturas del README (`npm run screenshots`): compila la web con los datos reales de
 * `public/data/` (en una carpeta temporal), la sirve en local y fotografía con Chromium las
 * pantallas principales en claro y en oscuro, en escritorio y en móvil. El mapa usa las teselas
 * reales de OpenFreeMap, así que necesita red. Las imágenes van a `docs/screenshots/`.
 *
 * El script comprueba lo que se puede medir (tarjetas, pines, ausencia de avisos de error), pero
 * no el aspecto: las capturas hay que revisarlas a ojo antes de publicarlas.
 */
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = resolve(root, 'docs/screenshots');
const site = join(tmpdir(), 'gasora-screenshots-site');
const PORT = 4175;

console.log('Compilando con los datos reales de public/data…');
execSync(`npx vite build --outDir "${site}" --emptyOutDir`, { cwd: root, stdio: 'ignore' });

// Servidor estático con la salida de rutas de la SPA
const types: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.woff2': 'font/woff2',
  '.webmanifest': 'application/manifest+json',
};
const server = createServer((request, response) => {
  const path = decodeURIComponent((request.url ?? '/').split('?')[0] ?? '/');
  let file = join(site, path);
  if (!file.startsWith(site) || !existsSync(file) || !statSync(file).isFile()) {
    file = join(site, 'index.html');
  }
  response.setHeader('content-type', types[extname(file)] ?? 'application/octet-stream');
  response.end(readFileSync(file));
});
await new Promise<void>((done) => server.listen(PORT, '127.0.0.1', done));
const origin = `http://127.0.0.1:${PORT}`;

// Datos de las escenas: Málaga y cuatro favoritas conocidas
const dataDir = resolve(root, 'public/data');
const meta = JSON.parse(readFileSync(resolve(dataDir, 'meta.json'), 'utf8')) as {
  stationsFile: string;
};
const index = JSON.parse(readFileSync(resolve(dataDir, 'search-index.json'), 'utf8')) as {
  municipalities: { id: number; name: string; count: number }[];
};
const malaga = index.municipalities.find((m) => m.name === 'Málaga');
if (!malaga) throw new Error('No se encuentra el municipio de Málaga en el índice de búsqueda');
const stations = (
  JSON.parse(readFileSync(resolve(dataDir, meta.stationsFile), 'utf8')) as {
    stations: { id: string; b: string; z: string; mid: number }[];
  }
).stations;
const favorites = ['repsol', 'bp', 'moeve', 'shell']
  .map((brand) => stations.find((s) => s.b === brand && s.mid === malaga.id)?.id)
  .filter((id): id is string => Boolean(id));

type Theme = 'light' | 'dark';
interface Shot {
  file: string;
  mobile: boolean;
  theme: Theme;
  path: string;
  prepare?: (page: Page) => Promise<void>;
  check: (page: Page) => Promise<void>;
}

const results = `/?q=m${malaga.id}&fuel=g95e5&sort=price`;
const nothingBroken = async (page: Page) => {
  const alerts = await page.locator('[role="alert"]').count();
  if (alerts > 0) throw new Error(`hay ${alerts} avisos de error en pantalla`);
};
const cards = (min: number) => async (page: Page) => {
  await nothingBroken(page);
  await page.locator('[data-testid="station-card"]').first().waitFor();
  const count = await page.locator('[data-testid="station-card"]').count();
  if (count < min) throw new Error(`solo ${count} tarjetas (mínimo ${min})`);
};

/** La calculadora usa la zona de la última búsqueda: se llega con el menú, sin recargar la página. */
const openCalculator = async (page: Page) => {
  await page.locator('[data-testid="station-card"]').first().waitFor();
  await page.locator('a[href$="/calculadora"]:visible').first().click();
  await page.getByRole('heading', { level: 1, name: /calculadora/i }).waitFor();
  await page.waitForTimeout(1500);
};

const shots: Shot[] = [];
for (const theme of ['light', 'dark'] as const) {
  shots.push({
    file: `inicio-escritorio-${theme}`,
    mobile: false,
    theme,
    path: '/',
    check: async (page) => {
      await nothingBroken(page);
      await page.getByTestId('hero-map').waitFor();
      await page
        .getByTestId('status-line')
        .getByText(/estaciones/)
        .waitFor({ timeout: 15000 });
    },
  });
  shots.push({
    file: `resultados-escritorio-${theme}`,
    mobile: false,
    theme,
    path: results,
    prepare: async (page) => {
      await page.waitForSelector('.maplibregl-canvas', { timeout: 20000 });
      await page.waitForTimeout(3000); // teselas del mapa
    },
    check: cards(5),
  });
  shots.push({
    file: `resultados-movil-${theme}`,
    mobile: true,
    theme,
    path: results,
    prepare: async (page) => {
      await page.waitForTimeout(2500);
    },
    check: cards(3),
  });
}
shots.push(
  {
    file: 'inicio-movil-light',
    mobile: true,
    theme: 'light',
    path: '/',
    check: nothingBroken,
  },
  {
    file: 'calculadora-escritorio-light',
    mobile: false,
    theme: 'light',
    path: results,
    prepare: openCalculator,
    check: nothingBroken,
  },
  {
    file: 'calculadora-movil-light',
    mobile: true,
    theme: 'light',
    path: results,
    prepare: openCalculator,
    check: nothingBroken,
  },
  {
    file: 'favoritos-escritorio-light',
    mobile: false,
    theme: 'light',
    path: '/favoritos',
    check: cards(favorites.length),
  },
  {
    file: 'favoritos-movil-light',
    mobile: true,
    theme: 'light',
    path: '/favoritos',
    check: cards(favorites.length),
  },
);

const browser = await chromium.launch({
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
await mkdir(outDir, { recursive: true });
const failures: string[] = [];
for (const shot of shots) {
  const context = await browser.newContext({
    viewport: shot.mobile ? { width: 390, height: 844 } : { width: 1440, height: 900 },
    deviceScaleFactor: shot.mobile ? 2 : 1,
    isMobile: shot.mobile,
    hasTouch: shot.mobile,
    locale: 'es-ES',
    timezoneId: 'Europe/Madrid',
    serviceWorkers: 'block',
    reducedMotion: 'reduce',
  });
  await context.addInitScript(
    ([theme, ids]) => {
      localStorage.setItem('gasora:theme:v1', theme as string);
      localStorage.setItem('gasora:favorites:v1', JSON.stringify(ids));
    },
    [shot.theme, favorites] as const,
  );
  const page = await context.newPage();
  try {
    await page.goto(`${origin}${shot.path}`, { waitUntil: 'networkidle' });
    await page.evaluate(() => document.fonts.ready);
    await shot.prepare?.(page);
    await shot.check(page);
    const png = await page.screenshot({ type: 'png' });
    await writeFile(resolve(outDir, `${shot.file}.png`), png);
    console.log(`✓ ${shot.file}.png (${(png.length / 1024).toFixed(0)} KB)`);
  } catch (error) {
    failures.push(`${shot.file}: ${(error as Error).message.split('\n')[0]}`);
    console.error(`✗ ${shot.file}: ${(error as Error).message.split('\n')[0]}`);
  } finally {
    await context.close();
  }
}
await browser.close();
server.close();
if (failures.length) {
  console.error(`\n${failures.length} capturas con problemas:\n${failures.join('\n')}`);
  process.exitCode = 1;
}
