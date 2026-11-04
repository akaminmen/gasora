import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

/**
 * Genera una sola vez el fondo de mapa de la ilustración del inicio (`HeroPreview`): captura el
 * mapa real de MapLibre con OpenFreeMap (estilos positron y dark) centrado en Málaga y lo guarda
 * como WebP en `src/assets/hero/`. No forma parte del build: los WebP se versionan y solo hay que
 * volver a ejecutarlo si se cambia el centro, el zoom o el tamaño (`npm run hero-map`).
 *
 * Opciones por variable de entorno: HERO_LNG, HERO_LAT, HERO_ZOOM, HERO_DIAG=1 (solo diagnóstico).
 */
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dist = resolve(root, 'node_modules/maplibre-gl/dist');
const outDir = resolve(root, 'src/assets/hero');

export const CENTER: [number, number] = [
  Number(process.env.HERO_LNG ?? -4.4205),
  Number(process.env.HERO_LAT ?? 36.7225),
];
export const ZOOM = Number(process.env.HERO_ZOOM ?? 15.5);
const WIDTH = 600;
const HEIGHT = 560;
const MAX_BYTES = 60 * 1024;
/** Posiciones de los pines de la ilustración (% de la caja de 600 × 560), para comprobar el suelo. */
const PINS: [number, number][] = [
  [30, 26],
  [62, 16],
  [68, 42],
  [20, 68],
  [66, 78],
];
const STYLES = {
  light: 'https://tiles.openfreemap.org/styles/positron',
  dark: 'https://tiles.openfreemap.org/styles/dark',
} as const;

const html = `<!doctype html><html><head><meta charset="utf-8">
<style>html,body{margin:0}#map{width:${WIDTH}px;height:${HEIGHT}px}</style></head>
<body><div id="map"></div>
<script type="module">
import * as maplibregl from '/maplibre-gl.mjs';
maplibregl.setWorkerUrl('/worker.mjs');
window.maplibregl = maplibregl;
window.ready = true;
</script></body></html>`;

const browser = await chromium.launch({
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const page = await browser.newPage({ viewport: { width: WIDTH, height: HEIGHT } });
const mjs = await readFile(resolve(dist, 'maplibre-gl.mjs'), 'utf8');
const worker = await readFile(resolve(dist, 'maplibre-gl-worker.mjs'), 'utf8');
await page.route('https://local.test/**', (route) => {
  const path = new URL(route.request().url()).pathname;
  const js = { contentType: 'text/javascript' };
  if (path === '/') return route.fulfill({ contentType: 'text/html', body: html });
  if (path === '/maplibre-gl.mjs') return route.fulfill({ ...js, body: mjs });
  if (path === '/worker.mjs') return route.fulfill({ ...js, body: worker });
  return route.fulfill({ status: 404, body: '' });
});
// tsx añade __name a las funciones que se serializan hacia la página
await page.addInitScript('window.__name = (f) => f;');
await page.goto('https://local.test/');
await page.waitForFunction(() => (window as unknown as { ready?: boolean }).ready === true);

await mkdir(outDir, { recursive: true });
for (const [theme, style] of Object.entries(STYLES)) {
  const report = await page.evaluate(
    async ({ style, center, zoom, pins }) => {
      const lib = (window as unknown as { maplibregl: typeof import('maplibre-gl') }).maplibregl;
      const map = new lib.Map({
        container: 'map',
        style,
        center,
        zoom,
        interactive: false,
        attributionControl: false,
        fadeDuration: 0,
        canvasContextAttributes: { preserveDrawingBuffer: true },
      });
      await new Promise<void>((res) => map.once('load', () => res()));
      // Sin puntos de interés, números de portal, transporte ni etiquetas de barrio: solo calles
      const drop =
        /poi|housenumber|aerodrome|airport|aeroway|rail|transit|station|ferry|label_other|place|island|continent|country|state|city|town|village|suburb|neighbourhood|water_name|waterway_label/;
      const hidden: string[] = [];
      const kept: string[] = [];
      for (const layer of map.getStyle().layers) {
        if (layer.type !== 'symbol') continue;
        if (/name-(path|minor)/.test(layer.id) || drop.test(layer.id)) {
          map.setLayoutProperty(layer.id, 'visibility', 'none');
          hidden.push(layer.id);
        } else {
          // Nombres solo de las calles principales (un mapa de fondo, no un callejero)
          if (/highway.?name/i.test(layer.id)) {
            const main = [
              'in',
              ['get', 'class'],
              ['literal', ['motorway', 'trunk', 'primary', 'secondary', 'tertiary']],
            ] as never;
            map.setFilter(layer.id, (layer.filter ? ['all', layer.filter, main] : main) as never);
          }
          kept.push(layer.id);
        }
      }
      await new Promise<void>((res) => map.once('idle', () => res()));
      map.triggerRepaint();
      await new Promise<void>((res) => map.once('idle', () => res()));
      const labels = map
        .queryRenderedFeatures(undefined, { layers: kept })
        .map((f) => `${f.layer.id}:${String(f.properties?.name ?? f.properties?.ref ?? '')}`);
      // Qué hay bajo cada pin (capa de fondo más alta con geometría)
      const under = pins.map(([x, y]) => {
        const point: [number, number] = [(x / 100) * 600, (y / 100) * 560];
        const layers = map
          .queryRenderedFeatures(point)
          .map((f) => f.layer.id)
          .filter((id) => !kept.includes(id));
        return { x, y, layers: [...new Set(layers)].slice(0, 6) };
      });
      return { hidden, kept, labels: [...new Set(labels)], under };
    },
    { style, center: CENTER, zoom: ZOOM, pins: PINS },
  );
  console.log(`\n== ${theme} ==`);
  console.log('símbolos ocultos:', report.hidden.length, '· conservados:', report.kept.join(', '));
  console.log('etiquetas visibles:', report.labels.length, report.labels.slice(0, 40).join(' | '));
  for (const u of report.under)
    console.log(`pin ${u.x}%,${u.y}% →`, u.layers.join(', ') || '(fondo)');
  if (process.env.HERO_DIAG === '1') {
    await page.evaluate(() => {
      document.getElementById('map')!.innerHTML = '';
    });
    continue;
  }
  const png = await page.locator('#map').screenshot({ type: 'png' });
  const webp = await page.evaluate(
    async ({ b64, max }) => {
      const img = new Image();
      img.src = `data:image/png;base64,${b64}`;
      await img.decode();
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      canvas.getContext('2d')!.drawImage(img, 0, 0);
      const encode = (q: number) =>
        new Promise<Blob>((res) => canvas.toBlob((b) => res(b!), 'image/webp', q));
      // La mejor calidad que cabe en el tope (búsqueda binaria)
      let lo = 0.3;
      let hi = 0.95;
      let best = await encode(lo);
      for (let i = 0; i < 8; i++) {
        const mid = (lo + hi) / 2;
        const blob = await encode(mid);
        if (blob.size <= max) {
          best = blob;
          lo = mid;
        } else hi = mid;
      }
      const buf = new Uint8Array(await best.arrayBuffer());
      let s = '';
      for (const v of buf) s += String.fromCharCode(v);
      return { b64: btoa(s), quality: lo };
    },
    { b64: png.toString('base64'), max: MAX_BYTES },
  );
  const bytes = Buffer.from(webp.b64, 'base64');
  const file = resolve(outDir, `hero-map-${theme}.webp`);
  await writeFile(file, bytes);
  console.log(`→ ${file}: ${bytes.length} bytes, calidad ${webp.quality.toFixed(2)}`);
  // Elimina el mapa para crear el siguiente
  await page.evaluate(() => {
    document.getElementById('map')!.innerHTML = '';
  });
}
await browser.close();
console.log(`\nCentro [lng, lat]: ${CENTER.join(', ')} · zoom ${ZOOM} · ${WIDTH}×${HEIGHT}`);
