import { describe, expect, it } from 'vitest';
import { HOME_META, PUBLIC_PATHS, STATIC_PAGES, pageMeta } from '../../src/lib/page-meta';
import {
  injectHome,
  renderIntro,
  renderJsonLd,
  renderNotFoundPage,
  renderStaticPage,
} from '../../scripts/static-pages';

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
    <meta name="twitter:title" content="Gasora · La gasolina más barata, más cerca" />
    <meta
      name="twitter:description"
      content="Descripción para compartir"
    />
    <!--json-ld-->
    <title>Gasora · La gasolina más barata, más cerca</title>
  </head>
  <body><div id="root"><!--static-intro--></div></body>
</html>`;

const HOME = injectHome(HTML, 'https://gasora.es/');

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
    const out = renderStaticPage(HOME, pageMeta('favoritos'), 'https://gasora.es/');
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
      HOME,
      {
        path: 'x',
        title: 'A & B',
        description: 'Dice "hola" & adiós',
        heading: 'H',
        intro: ['P'],
        linkLabel: 'X',
      },
      'https://gasora.es/',
    );
    expect(out).toContain('<title>A &amp; B</title>');
    expect(out).toContain('content="Dice &quot;hola&quot; &amp; adiós"');
  });

  it('falla si falta una etiqueta en lugar de publicar la portada disfrazada', () => {
    expect(() =>
      renderStaticPage(
        HOME.replace('<title>', '<titulo>'),
        pageMeta('acerca'),
        'https://gasora.es/',
      ),
    ).toThrow(/title/);
  });

  it('renderNotFoundPage añade noindex una sola vez', () => {
    const out = renderNotFoundPage(HOME);
    expect(out.match(/name="robots" content="noindex"/g)).toHaveLength(1);
    expect(out).toContain('<title>Gasora · La gasolina más barata, más cerca</title>');
  });

  it('injectHome escribe el texto inicial y los datos estructurados de la portada', () => {
    expect(HOME).toContain('<main class="static-intro">');
    expect(HOME).toContain(`<h1>${HOME_META.heading}</h1>`);
    expect(HOME).toContain('type="application/ld+json"');
    expect(HOME).not.toContain('<!--static-intro-->');
    expect(HOME).not.toContain('<!--json-ld-->');
    expect(() => injectHome('<html></html>', 'https://gasora.es/')).toThrow();
  });

  it('cada pantalla tiene su h1, sus párrafos y los enlaces a las demás (con la base)', () => {
    for (const page of [HOME_META, ...STATIC_PAGES]) {
      const intro = renderIntro(page, '/');
      expect(intro).toContain(`<h1>${page.heading}</h1>`);
      for (const paragraph of page.intro) expect(intro).toContain(paragraph);
      expect(intro).not.toContain(`href="/${page.path}"`);
      expect((intro.match(/<a /g) ?? []).length).toBe(STATIC_PAGES.length);
      expect(page.heading.length).toBeGreaterThan(10);
      expect(page.intro.join(' ').split(' ').length).toBeGreaterThan(25);
    }
    expect(renderIntro(pageMeta('acerca'), '/gasora/')).toContain('href="/gasora/favoritos"');
  });

  it('el texto de cada pantalla estática sustituye al de la portada y quita los datos estructurados', () => {
    const out = renderStaticPage(HOME, pageMeta('instalar'), 'https://gasora.es/');
    expect(out).toContain(`<h1>${pageMeta('instalar').heading}</h1>`);
    expect(out).not.toContain(HOME_META.heading);
    expect(out).not.toContain('application/ld+json');
    expect(out).toContain('name="twitter:title" content="Instalar Gasora"');
    expect(out.match(/<h1>/g)).toHaveLength(1);
  });

  it('el JSON-LD es JSON válido con WebSite y WebApplication gratuita en español', () => {
    const block = renderJsonLd('https://gasora.es/');
    const json = JSON.parse(block.replace(/^<script[^>]*>/, '').replace(/<\/script>$/, '')) as {
      '@graph': { '@type': string; offers?: { price: string }; inLanguage: string; url: string }[];
    };
    const types = json['@graph'].map((node) => node['@type']);
    expect(types).toEqual(['WebSite', 'WebApplication']);
    for (const node of json['@graph']) {
      expect(node.inLanguage).toBe('es');
      expect(node.url).toBe('https://gasora.es/');
    }
    expect(json['@graph'][1]!.offers?.price).toBe('0');
    // Un «<» en los datos no puede cerrar el script
    expect(block.slice(10, -9)).not.toContain('</');
  });
});
