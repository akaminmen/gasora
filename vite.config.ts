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
  plugins: [react(), tailwindcss(), spaFallback()],
  test: {
    include: ['tests/unit/**/*.test.ts'],
    environment: 'node',
  },
});
