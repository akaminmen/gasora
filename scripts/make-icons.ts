import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

/**
 * Genera los iconos de la app (PWA, iOS, favicon) y la imagen para compartir, renderizándolos con
 * Chromium. Los PNG se guardan en `public/` y se versionan: este script solo hay que volver a
 * ejecutarlo si cambia un logo (`npm run icons`). Dos fuentes:
 *  - `public/logo-mark.svg`: el logotipo completo (pin con surtidor y ondas), sobre transparente.
 *    De él salen los iconos de la PWA y la imagen para compartir.
 *  - `public/favicon.svg`: la versión para pestañas, cuadrada, con fondo índigo y el pin en blanco,
 *    sin las ondas (a 16 px no se distinguen). De ella salen `favicon.ico` (16, 32 y 48 px),
 *    `favicon-48x48.png` y el icono de iOS (a sangre, sin esquinas redondeadas: iOS pone las suyas).
 */
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const pub = resolve(root, 'public');
const BRAND_50 = '#EEF2FF';

const logo = await readFile(resolve(pub, 'logo-mark.svg'), 'utf8');
const inline = logo.replace('<svg ', '<svg width="100%" height="100%" ');
const tab = await readFile(resolve(pub, 'favicon.svg'), 'utf8');
const tabInline = tab.replace('<svg ', '<svg width="100%" height="100%" ');
const tabSquare = tabInline.replace('rx="11"', 'rx="0"');
const font = await readFile(
  resolve(
    root,
    'node_modules/@fontsource-variable/plus-jakarta-sans/files/plus-jakarta-sans-latin-wght-normal.woff2',
  ),
);

const browser = await chromium.launch();
const page = await browser.newPage();

/** Renderiza una página HTML a PNG del tamaño pedido. */
async function render(html: string, width: number, height: number, transparent = false) {
  await page.setViewportSize({ width, height });
  await page.setContent(html, { waitUntil: 'load' });
  await page.evaluate(() => document.fonts.ready);
  return page.screenshot({ type: 'png', omitBackground: transparent });
}

/** Icono: el logo ocupa `scale` del lado; con `background` rellena todo el cuadrado (maskable, iOS). */
const iconHtml = (size: number, scale: number, background?: string) => `<!doctype html>
<html><body style="margin:0;width:${size}px;height:${size}px;background:${background ?? 'transparent'};display:grid;place-items:center">
<div style="width:${size * scale}px;height:${size * scale}px">${inline}</div></body></html>`;

const out = async (file: string, data: Buffer) => {
  await mkdir(dirname(resolve(pub, file)), { recursive: true });
  await writeFile(resolve(pub, file), data);
  console.log(`${file}: ${data.length} bytes`);
};

// Iconos «any»: fondo transparente, logo casi a sangre
await out('icons/icon-192.png', await render(iconHtml(192, 0.92), 192, 192, true));
await out('icons/icon-512.png', await render(iconHtml(512, 0.92), 512, 512, true));
// Maskable: fondo lleno y logo dentro de la zona segura (el 80 % central; se usa el 58 %)
await out('icons/icon-maskable-512.png', await render(iconHtml(512, 0.58, BRAND_50), 512, 512));
// iOS: sin transparencia (iOS la pone en negro) y a sangre: el cuadrado índigo con el pin en blanco
const fullBleed = `<!doctype html><html><body style="margin:0;width:180px;height:180px">${tabSquare}</body></html>`;
await out('apple-touch-icon.png', await render(fullBleed, 180, 180));

// Favicon: el cuadrado de pestaña a 16, 32 y 48 px (esquinas transparentes)
const tabHtml = (size: number) =>
  `<!doctype html><html><body style="margin:0;width:${size}px;height:${size}px;background:transparent">${tabInline}</body></html>`;
const entries = [] as { size: number; data: Buffer }[];
for (const size of [16, 32, 48]) {
  entries.push({ size, data: await render(tabHtml(size), size, size, true) });
}
await out('favicon-48x48.png', entries[2]!.data);
const header = Buffer.alloc(6 + 16 * entries.length);
header.writeUInt16LE(0, 0);
header.writeUInt16LE(1, 2);
header.writeUInt16LE(entries.length, 4);
let offset = header.length;
entries.forEach((entry, i) => {
  const at = 6 + 16 * i;
  header.writeUInt8(entry.size, at);
  header.writeUInt8(entry.size, at + 1);
  header.writeUInt8(0, at + 2);
  header.writeUInt8(0, at + 3);
  header.writeUInt16LE(1, at + 4);
  header.writeUInt16LE(32, at + 6);
  header.writeUInt32LE(entry.data.length, at + 8);
  header.writeUInt32LE(offset, at + 12);
  offset += entry.data.length;
});
await out('favicon.ico', Buffer.concat([header, ...entries.map((e) => e.data)]));

// Imagen para compartir (Open Graph / Twitter): 1200 × 630
const og = `<!doctype html>
<html><head><style>
@font-face{font-family:Jakarta;src:url(data:font/woff2;base64,${font.toString('base64')});font-weight:200 800}
body{margin:0;width:1200px;height:630px;display:flex;align-items:center;gap:56px;padding:0 96px;box-sizing:border-box;
background:linear-gradient(135deg,#4F46E5 0%,#312E81 100%);font-family:Jakarta,sans-serif;color:#fff}
.mark{width:230px;height:230px;flex:none;background:${BRAND_50};border-radius:56px;display:grid;place-items:center}
.mark div{width:170px;height:170px}
h1{margin:0;font-size:124px;font-weight:800;letter-spacing:-0.03em;line-height:1}
h1 span{color:#A5B4FC}
p{margin:20px 0 0;font-size:44px;font-weight:600;line-height:1.2;color:#E0E7FF}
</style></head><body>
<div class="mark"><div>${inline}</div></div>
<div><h1>Gas<span>ora</span></h1><p>La gasolina más barata,<br>más cerca.</p></div>
</body></html>`;
await out('og-image.png', await render(og, 1200, 630));

await browser.close();
