import { describe, expect, it } from 'vitest';
import { extractHtmlResources, extractManifestResources, judge } from '../../scripts/verify-site';

const html = `<!doctype html><html><head>
<link rel="canonical" href="https://gasora.es/" />
<link rel="icon" type="image/svg+xml" href="/favicon.svg" />
<link rel="apple-touch-icon" href="/apple-touch-icon.png" />
<meta property="og:image" content="https://gasora.es/og-image.png" />
<script type="module" crossorigin src="/assets/index-AAA.js"></script>
<link rel="modulepreload" crossorigin href="/assets/format-BBB.js">
<link rel="stylesheet" crossorigin href="/assets/index-CCC.css">
<link rel="manifest" href="/manifest.webmanifest">
<script>inline()</script>
</head></html>`;

describe('extractHtmlResources', () => {
  it('extrae scripts, estilos, precargas, iconos, imagen social y manifiesto', () => {
    const found = extractHtmlResources(html, 'https://gasora.es/');
    expect(found.map((c) => c.url)).toEqual([
      'https://gasora.es/favicon.svg',
      'https://gasora.es/apple-touch-icon.png',
      'https://gasora.es/og-image.png',
      'https://gasora.es/assets/index-AAA.js',
      'https://gasora.es/assets/format-BBB.js',
      'https://gasora.es/assets/index-CCC.css',
      'https://gasora.es/manifest.webmanifest',
    ]);
    expect(found.find((c) => c.url.endsWith('.css'))?.expect).toBe('css');
    expect(found.find((c) => c.url.endsWith('.webmanifest'))?.expect).toBe('json');
  });
  it('resuelve las rutas relativas respecto a la dirección de la página', () => {
    const found = extractHtmlResources('<script src="assets/a.js"></script>', 'https://x.org/s/');
    expect(found[0]?.url).toBe('https://x.org/s/assets/a.js');
  });
});

describe('extractManifestResources', () => {
  it('resuelve los iconos respecto al manifiesto', () => {
    const found = extractManifestResources(
      { icons: [{ src: 'icons/icon-192.png' }, { src: 'icons/icon-512.png' }] },
      'https://gasora.es/manifest.webmanifest',
    );
    expect(found.map((c) => c.url)).toEqual([
      'https://gasora.es/icons/icon-192.png',
      'https://gasora.es/icons/icon-512.png',
    ]);
    expect(extractManifestResources(null, 'https://gasora.es/m')).toEqual([]);
  });
});

describe('judge', () => {
  it('acepta un 200 con el tipo esperado', () => {
    expect(
      judge({ url: 'u', expect: 'js' }, 200, 'application/javascript; charset=utf-8'),
    ).toBeNull();
    expect(judge({ url: 'u', expect: 'js' }, 200, 'text/javascript')).toBeNull();
    expect(judge({ url: 'u', expect: 'image' }, 200, 'image/png')).toBeNull();
    expect(judge({ url: 'u', expect: null }, 200, '')).toBeNull();
  });
  it('rechaza un 404 y un HTML donde debería haber un script', () => {
    expect(judge({ url: 'u', expect: 'js' }, 404, 'text/html')).toBe('HTTP 404');
    expect(judge({ url: 'u', expect: 'js' }, 200, 'text/html')).toMatch(/en lugar de js/);
  });
});
