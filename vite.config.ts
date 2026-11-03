import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { copyFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Plugin } from 'vite';
import { defineConfig } from 'vitest/config';

// En GitHub Pages la app vive en una subruta (/<repo>/): el workflow define GASORA_BASE.
const base = process.env['GASORA_BASE'] ?? '/';

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

export default defineConfig({
  base,
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
  plugins: [react(), tailwindcss(), spaFallback()],
  test: {
    include: ['tests/unit/**/*.test.ts'],
    environment: 'node',
  },
});
