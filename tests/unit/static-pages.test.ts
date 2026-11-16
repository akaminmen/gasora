import { describe, expect, it } from 'vitest';
import { HOME_META, PUBLIC_PATHS, STATIC_PAGES, pageMeta } from '../../src/lib/page-meta';
import { renderNotFoundPage, renderStaticPage } from '../../scripts/static-pages';

const HTML = `<!doctype html>
<html lang="es">
  <head>
    <meta charset="UTF-8" />
    <meta
      name="description"
      content="Descripción de la portada"
    />
    <link rel="canonical" href="https://gasora.es/" />
    <meta property="og:title" content="Gasora · La gasolina más barata, más cerca" />
    <meta
      property="og:description"
      content="Descripción para compartir"
    />
    <meta property="og:url" content="https://gasora.es/" />
    <title>Gasora · La gasolina más barata, más cerca</title>
  </head>
  <body><div id="root"></div></body>
</html>`;

describe('páginas estáticas', () => {
  it('cada pantalla pública tiene título y descripción propios y distintos de la portada', () => {
    const titles = new Set([HOME_META.title]);
    const descriptions = new Set([HOME_META.description]);
    for (const page of STATIC_PAGES) {
      expect(page.title.length).toBeGreaterThan(5);
      expect(page.description.length).toBeGreaterThan(40);
      expect(page.description.length).toBeLessThanOrEqual(200);
      titles.add(page.title);
      descriptions.add(page.description);
    }
    expect(titles.size).toBe(STATIC_PAGES.length + 1);
    expect(descriptions.size).toBe(STATIC_PAGES.length + 1);
  });

  it('el sitemap lista la portada y las pantallas, sin barra final', () => {
    expect(PUBLIC_PATHS).toEqual(['', 'favoritos', 'calculadora', 'instalar', 'acerca']);
    for (const path of PUBLIC_PATHS) expect(path.endsWith('/')).toBe(false);
  });

  it('pageMeta falla con una ruta desconocida', () => {
    expect(() => pageMeta('no-existe')).toThrow();
  });

  it('renderStaticPage cambia título, descripción, canónica y datos para compartir', () => {
    const out = renderStaticPage(HTML, pageMeta('favoritos'), 'https://gasora.es/');
    expect(out).toContain('<title>Gasora · Favoritos</title>');
    expect(out).toContain('href="https://gasora.es/favoritos"');
    expect(out).toContain('<meta property="og:url" content="https://gasora.es/favoritos" />');
    expect(out).toContain(pageMeta('favoritos').description);
    expect(out).not.toContain('Descripción de la portada');
    expect(out).not.toContain('Descripción para compartir');
    expect(out).not.toContain('La gasolina más barata, más cerca');
  });

  it('escapa las comillas y el signo & de los textos', () => {
    const out = renderStaticPage(
      HTML,
      { path: 'x', title: 'A & B', description: 'Dice "hola" & adiós' },
      'https://gasora.es/',
    );
    expect(out).toContain('<title>A &amp; B</title>');
    expect(out).toContain('content="Dice &quot;hola&quot; &amp; adiós"');
  });

  it('falla si falta una etiqueta en lugar de publicar la portada disfrazada', () => {
    expect(() =>
      renderStaticPage(
        HTML.replace('<title>', '<titulo>'),
        pageMeta('acerca'),
        'https://gasora.es/',
      ),
    ).toThrow(/title/);
  });

  it('renderNotFoundPage añade noindex una sola vez', () => {
    const out = renderNotFoundPage(HTML);
    expect(out.match(/name="robots" content="noindex"/g)).toHaveLength(1);
    expect(out).toContain('<title>Gasora · La gasolina más barata, más cerca</title>');
  });
});
