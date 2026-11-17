import { createServer, type Server } from 'node:http';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { extname, join, resolve } from 'node:path';

/**
 * Servidor que imita lo medido en GitHub Pages (ADR 019): una dirección sin extensión se sirve con el
 * fichero `.html` del mismo nombre y estado 200 (`/favoritos` → `favoritos.html`, y `/404` →
 * `404.html`); un directorio sin barra final redirige (301) a la dirección con barra; todo lo que no
 * es un fichero recibe `404.html` con estado 404. Sirve `dist-base` (build con base /).
 */
const DIR = resolve(import.meta.dirname, '../../dist-base');
const TYPES: Record<string, string> = {
  '.js': 'text/javascript',
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css',
  '.json': 'application/json',
  '.webmanifest': 'application/manifest+json',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
};

export const isFile = (file: string) => existsSync(file) && statSync(file).isFile();

export function pagesLike(): Promise<{ server: Server; origin: string }> {
  const server = createServer((request, response) => {
    const path = decodeURIComponent(new URL(request.url ?? '/', 'http://x').pathname);
    let file = join(DIR, path);
    let status = 200;
    if (!file.startsWith(DIR)) {
      file = join(DIR, '404.html');
      status = 404;
    } else if (existsSync(file) && statSync(file).isDirectory()) {
      if (!path.endsWith('/')) {
        response.writeHead(301, { location: `${path}/` }).end();
        return;
      }
      file = join(file, 'index.html');
    } else if (!isFile(file) && isFile(`${file}.html`)) {
      file = `${file}.html`;
    }
    if (!isFile(file)) {
      file = join(DIR, '404.html');
      status = 404;
    }
    response.writeHead(status, {
      'content-type': TYPES[extname(file)] ?? 'application/octet-stream',
    });
    response.end(readFileSync(file));
  });
  return new Promise((done) => {
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      done({
        server,
        origin: `http://127.0.0.1:${typeof address === 'object' && address ? address.port : 0}`,
      });
    });
  });
}
