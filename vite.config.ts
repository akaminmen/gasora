import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { createHash } from 'node:crypto';
import { copyFileSync, existsSync, readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { VitePWA } from 'vite-plugin-pwa';
import { contentHash } from './scripts/brand-hash';
import { E2E_LOGOS } from './scripts/e2e-logos';
import {
  BRANDS_URL,
  FONTS_URL,
  MAX_CACHED_TILES,
  STYLE_URL,
  TILES_URL,
} from './scripts/pwa-caching';
import type { Plugin } from 'vite';
import { defineConfig } from 'vitest/config';
import { version } from './package.json' with { type: 'json' };

// En GitHub Pages la app vive en una subruta (/<repo>/): el workflow define GASORA_BASE.
// `--base /ruta/` en la línea de órdenes (build:e2e:base) manda sobre la variable de entorno.
const cliBaseIndex = process.argv.indexOf('--base');
const cliBase = cliBaseIndex >= 0 ? process.argv[cliBaseIndex + 1] : undefined;
const base = cliBase ?? process.env['GASORA_BASE'] ?? '/';

/** Dirección pública de la web (con la subruta y la barra final), para las etiquetas de compartir. */
const owner = process.env['GITHUB_REPOSITORY_OWNER']?.toLowerCase() ?? 'akaminmen';
const site = process.env['GASORA_SITE'] ?? `https://${owner}.github.io${base}`;
const PUBLIC_PAGES = ['', 'favoritos', 'calculadora', 'acerca'];

/**
 * Escribe en `index.html` el nombre con hash del fichero de estaciones (`stations.{hash}.json`,
 * de `public/data/meta.json`) para que la app lo pida a la vez que `meta.json` en lugar de después.
 * En el build de los tests (`--mode e2e`) los datos se generan después del build: el nombre queda
 * vacío y `scripts/e2e-data.ts` lo escribe. Si falta `meta.json`, queda vacío y la app funciona igual.
 */
function stationsHint(mode: string): Plugin {
  return {
    name: 'gasora-stations-hint',
    transformIndexHtml: (html) => {
      let file = '';
      const metaPath = resolve(import.meta.dirname, 'public/data/meta.json');
      if (mode !== 'e2e' && existsSync(metaPath)) {
        const meta = JSON.parse(readFileSync(metaPath, 'utf8')) as { stationsFile?: string };
        if (/^stations\.[0-9a-f]+\.json$/.test(meta.stationsFile ?? '')) file = meta.stationsFile!;
      }
      return html.replaceAll('%STATIONS_FILE%', file);
    },
  };
}

/** Carpeta de salida del build en curso, para que el service worker lea el `index.html` final. */
const output = { dir: 'dist' };
function outputDir(): Plugin {
  return {
    name: 'gasora-output-dir',
    apply: 'build',
    configResolved(config) {
      output.dir = resolve(config.root, config.build.outDir);
    },
  };
}

/**
 * Revisión de `index.html` en la precarga del service worker sin el nombre del fichero de
 * estaciones: ese nombre cambia cada vez que cambian las estaciones y no debe provocar un aviso de
 * «versión nueva» sin cambios de código. Si el nombre queda viejo en un `index.html` guardado, la app
 * cae al camino normal (meta.json primero) sin errores.
 */
const stableIndexRevision = <T extends { url: string; revision: string | null }>(entries: T[]) => ({
  manifest: entries.map((entry) => {
    if (entry.url !== 'index.html') return entry;
    const html = readFileSync(resolve(output.dir, 'index.html'), 'utf8').replace(
      /(<meta name="gasora-stations" content=")[^"]*"/,
      '$1"',
    );
    return { ...entry, revision: createHash('md5').update(html).digest('hex') };
  }),
});

/** Logos de marca de `public/brands/` que existen (ver `src/lib/brand-logos.ts`). */
const BRAND_FILES_ID = 'virtual:brand-files';

function brandFiles(mode: string): Plugin {
  const dir = resolve(import.meta.dirname, 'public/brands');
  const resolved = `\0${BRAND_FILES_ID}`;
  /** Nombre de archivo → versión (hash del contenido) de los logos que existen. */
  const list = () => {
    const files: Record<string, string> = {};
    if (existsSync(dir)) {
      for (const name of readdirSync(dir).sort()) {
        if (/\.(svg|webp|png)$/i.test(name))
          files[name] = contentHash(readFileSync(resolve(dir, name)));
      }
    }
    if (mode === 'e2e') {
      for (const [name, svg] of Object.entries(E2E_LOGOS)) files[name] = contentHash(svg);
    }
    return files;
  };
  return {
    name: 'gasora-brand-files',
    resolveId: (id) => (id === BRAND_FILES_ID ? resolved : undefined),
    load: (id) => (id === resolved ? `export default ${JSON.stringify(list())};` : undefined),
    configureServer(server) {
      // En desarrollo, al soltar o borrar un logo se recarga la lista
      server.watcher.add(dir);
      const reload = (file: string) => {
        if (!file.replaceAll('\\', '/').includes('/public/brands/')) return;
        const module = server.moduleGraph.getModuleById(resolved);
        if (module) server.moduleGraph.invalidateModule(module);
        server.ws.send({ type: 'full-reload' });
      };
      server.watcher.on('add', reload).on('unlink', reload).on('change', reload);
    },
  };
}

/** Sustituye %SITE_URL% en index.html y genera robots.txt y sitemap.xml con la dirección real. */
function seoFiles(): Plugin {
  return {
    name: 'gasora-seo-files',
    transformIndexHtml: (html) => html.replaceAll('%SITE_URL%', site),
    generateBundle() {
      this.emitFile({
        type: 'asset',
        fileName: 'robots.txt',
        source: ['User-agent: *', 'Allow: /', '', `Sitemap: ${site}sitemap.xml`, ''].join('\n'),
      });
      const urls = PUBLIC_PAGES.map((page) => `  <url><loc>${site}${page}</loc></url>`);
      this.emitFile({
        type: 'asset',
        fileName: 'sitemap.xml',
        source: [
          '<?xml version="1.0" encoding="UTF-8"?>',
          '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
          ...urls,
          '</urlset>',
          '',
        ].join('\n'),
      });
    },
  };
}

/** GitHub Pages sirve 404.html en las rutas desconocidas: copiar index.html permite los enlaces /e/:id. */
function spaFallback(): Plugin {
  let outDir = 'dist';
  return {
    name: 'gasora-spa-fallback',
    apply: 'build',
    configResolved(config) {
      outDir = config.build.outDir;
    },
    closeBundle() {
      copyFileSync(resolve(outDir, 'index.html'), resolve(outDir, '404.html'));
    },
  };
}

export default defineConfig(({ mode }) => ({
  base,
  define: {
    // Versión visible en «Acerca de» (sirve para comprobar que una actualización ha llegado)
    __APP_VERSION__: JSON.stringify(version),
    __APP_BUILD__: JSON.stringify((process.env['GITHUB_SHA'] ?? 'local').slice(0, 7)),
  },
  // MapLibre va en un trozo aparte que solo se descarga al ver resultados (ADR 012): ~1,1 MB sin comprimir.
  build: {
    chunkSizeWarningLimit: 1200,
    rolldownOptions: {
      output: {
        // El worker de MapLibre es un módulo JS: con extensión .js cualquier servidor lo sirve como JavaScript
        assetFileNames: (asset) =>
          asset.names.some((name) => name.startsWith('maplibre-gl-worker'))
            ? 'assets/[name]-[hash].js'
            : 'assets/[name]-[hash][extname]',
      },
    },
  },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      // El registro y las actualizaciones los gestiona src/pwa/register.ts (ADR 014)
      registerType: 'prompt',
      injectRegister: false,
      includeAssets: ['favicon.svg', 'favicon.ico', 'apple-touch-icon.png'],
      manifest: {
        name: 'Gasora',
        short_name: 'Gasora',
        description: 'La gasolina más barata, más cerca. Precios de carburantes en España.',
        lang: 'es',
        start_url: base,
        scope: base,
        id: base,
        display: 'standalone',
        orientation: 'any',
        theme_color: '#4F46E5',
        background_color: '#F7FAFC',
        categories: ['navigation', 'utilities'],
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          {
            src: 'icons/icon-maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
        shortcuts: [
          { name: 'Favoritos', url: `${base}favoritos`, icons: [] },
          { name: 'Calculadora de ahorro', url: `${base}calculadora`, icons: [] },
        ],
      },
      workbox: {
        // La aplicación entera (incluido el mapa) se guarda al instalar para que funcione sin red
        globPatterns: ['**/*.{js,css,html,woff2,svg,png,webp,ico,webmanifest}'],
        // Los logos de marca se guardan al usarse (runtimeCaching), no en la precarga
        globIgnores: ['**/og-image.png', '**/404.html', 'data/**', 'brands/**'],
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
        cleanupOutdatedCaches: true,
        manifestTransforms: [stableIndexRevision],
        // Rutas de la SPA: se sirve index.html; los datos y el resto de ficheros, no
        navigateFallback: `${base}index.html`,
        navigateFallbackDenylist: [/\/data\//, /\.[a-z0-9]+$/i],
        // La versión nueva espera a que el usuario la acepte (o a que la app esté en segundo plano)
        skipWaiting: false,
        clientsClaim: true,
        runtimeCaching: [
          {
            // Logos de marca (public/brands/): solo los que se llegan a ver, con tope y caducidad
            urlPattern: BRANDS_URL,
            handler: 'CacheFirst',
            options: {
              cacheName: 'gasora-brand-logos-v1',
              expiration: {
                maxEntries: 60,
                maxAgeSeconds: 30 * 24 * 3600,
                purgeOnQuotaError: true,
              },
              cacheableResponse: { statuses: [200] },
            },
          },
          {
            // Teselas vectoriales y de relieve: solo las vistas, con tope (ver MAX_CACHED_TILES)
            urlPattern: TILES_URL,
            handler: 'CacheFirst',
            options: {
              cacheName: 'gasora-map-tiles-v1',
              expiration: {
                maxEntries: MAX_CACHED_TILES,
                maxAgeSeconds: 7 * 24 * 3600,
                purgeOnQuotaError: true,
              },
              cacheableResponse: { statuses: [200] },
            },
          },
          {
            // Estilo, TileJSON y sprites: se sirven de la caché y se actualizan en segundo plano
            urlPattern: STYLE_URL,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'gasora-map-style-v1',
              expiration: { maxEntries: 30, maxAgeSeconds: 7 * 24 * 3600, purgeOnQuotaError: true },
              cacheableResponse: { statuses: [200] },
            },
          },
          {
            // Tipografías del mapa (glyphs)
            urlPattern: FONTS_URL,
            handler: 'CacheFirst',
            options: {
              cacheName: 'gasora-map-fonts-v1',
              expiration: {
                maxEntries: 60,
                maxAgeSeconds: 30 * 24 * 3600,
                purgeOnQuotaError: true,
              },
              cacheableResponse: { statuses: [200] },
            },
          },
        ],
      },
    }),
    seoFiles(),
    spaFallback(),
    brandFiles(mode),
    stationsHint(mode),
    outputDir(),
  ],
  test: {
    include: ['tests/unit/**/*.test.ts'],
    environment: 'node',
  },
}));
