import { HOME_META, STATIC_PAGES, type PageMeta } from '../src/lib/page-meta.ts';

/**
 * HTML de una pantalla estática a partir del `index.html` compilado. GitHub Pages sirve `/favoritos`
 * con el fichero `favoritos.html` y estado 200 (sin redirección), así que cada pantalla pública
 * tiene el suyo, con título, descripción, dirección canónica, datos para compartir y un texto
 * inicial propios. Si una etiqueta esperada no está, falla: es mejor romper el build que publicar la
 * portada disfrazada de otra pantalla.
 */

/** Cambia el valor que queda entre los dos grupos del patrón (prefijo y sufijo). */
function setValue(html: string, pattern: RegExp, value: string, what: string): string {
  if (!pattern.test(html)) throw new Error(`index.html no tiene ${what}`);
  return html.replace(
    pattern,
    (_match, before: string, after: string) => `${before}${value}${after}`,
  );
}

const escapeAttribute = (text: string) => text.replaceAll('&', '&amp;').replaceAll('"', '&quot;');
const escapeText = (text: string) => text.replaceAll('&', '&amp;').replaceAll('<', '&lt;');

/** Marcador que lleva `index.html` dentro de `#root`; el build lo sustituye por el texto inicial. */
export const INTRO_MARKER = '<!--static-intro-->';
const INTRO_BLOCK = /<main class="static-intro">[\s\S]*?<\/main>/;
export const JSON_LD_MARKER = '<!--json-ld-->';
const JSON_LD_BLOCK = /<script type="application\/ld\+json">[\s\S]*?<\/script>/;

/**
 * Texto de la pantalla en el HTML inicial: un `h1`, uno o dos párrafos y los enlaces a las demás
 * pantallas. Se muestra sin JavaScript; con JavaScript se oculta antes del primer pintado
 * (`.js .static-intro`) y la aplicación lo sustituye al arrancar, así no hay parpadeo, ni
 * desplazamientos de diseño, ni lectura doble con un lector de pantalla.
 */
export function renderIntro(page: PageMeta, base = '/'): string {
  const links = [HOME_META, ...STATIC_PAGES]
    .filter((other) => other.path !== page.path)
    .map((other) => `<li><a href="${base}${other.path}">${escapeText(other.linkLabel)}</a></li>`);
  return [
    '<main class="static-intro">',
    `  <h1>${escapeText(page.heading)}</h1>`,
    ...page.intro.map((paragraph) => `  <p>${escapeText(paragraph)}</p>`),
    '  <nav aria-label="Páginas de Gasora">',
    `    <ul>${links.join('')}</ul>`,
    '  </nav>',
    '</main>',
  ].join('\n');
}

/** Datos estructurados de la portada (WebSite y WebApplication), en JSON-LD. */
export function renderJsonLd(site: string): string {
  const data = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebSite',
        '@id': `${site}#website`,
        name: 'Gasora',
        url: site,
        description: HOME_META.description,
        inLanguage: 'es',
      },
      {
        '@type': 'WebApplication',
        '@id': `${site}#app`,
        name: 'Gasora',
        url: site,
        description: HOME_META.description,
        applicationCategory: 'UtilitiesApplication',
        operatingSystem: 'Web',
        browserRequirements: 'Requiere JavaScript',
        inLanguage: 'es',
        isAccessibleForFree: true,
        offers: { '@type': 'Offer', price: '0', priceCurrency: 'EUR' },
        image: `${site}icons/icon-512.png`,
      },
    ],
  };
  // «<» dentro de un script no debe poder cerrarlo: se escapa
  const json = JSON.stringify(data, null, 2).replaceAll('<', '\\u003c');
  return `<script type="application/ld+json">\n${json}\n</script>`;
}

/** `index.html` de la portada: con el texto inicial y los datos estructurados. */
export function injectHome(html: string, site: string): string {
  if (!html.includes(INTRO_MARKER)) throw new Error('index.html no tiene el marcador del texto');
  if (!html.includes(JSON_LD_MARKER)) throw new Error('index.html no tiene el marcador JSON-LD');
  const base = new URL(site).pathname;
  return html
    .replace(INTRO_MARKER, () => renderIntro(HOME_META, base))
    .replace(JSON_LD_MARKER, () => renderJsonLd(site));
}

export function renderStaticPage(html: string, page: PageMeta, site: string): string {
  const url = `${site}${page.path}`;
  const title = escapeAttribute(page.title);
  const description = escapeAttribute(page.description);
  const base = new URL(site).pathname;
  let out = html;
  out = setValue(out, /(<title>)[^<]*(<\/title>)/, escapeText(page.title), 'title');
  out = setValue(
    out,
    /(<meta\s+name="description"\s+content=")[^"]*(")/,
    description,
    'meta description',
  );
  out = setValue(out, /(<link rel="canonical" href=")[^"]*(")/, url, 'canonical');
  out = setValue(out, /(<meta property="og:url" content=")[^"]*(")/, url, 'og:url');
  out = setValue(out, /(<meta property="og:title" content=")[^"]*(")/, title, 'og:title');
  out = setValue(
    out,
    /(<meta\s+property="og:description"\s+content=")[^"]*(")/,
    description,
    'og:description',
  );
  out = setValue(out, /(<meta name="twitter:title" content=")[^"]*(")/, title, 'twitter:title');
  out = setValue(
    out,
    /(<meta\s+name="twitter:description"\s+content=")[^"]*(")/,
    description,
    'twitter:description',
  );
  // Texto inicial propio de la pantalla; los datos estructurados de la portada no van en las demás
  if (!INTRO_BLOCK.test(out)) throw new Error('index.html no tiene el texto inicial');
  out = out.replace(INTRO_BLOCK, () => renderIntro(page, base));
  if (!JSON_LD_BLOCK.test(out)) throw new Error('index.html no tiene los datos estructurados');
  out = out.replace(JSON_LD_BLOCK, () => '');
  return out;
}

/** `404.html`: la portada con `noindex`. Se sirve con estado 404 (y también en `/404`, con 200). */
export function renderNotFoundPage(html: string): string {
  const tag = '<meta charset="UTF-8" />';
  if (!html.includes(tag)) throw new Error('index.html no tiene meta charset');
  return html
    .replace(JSON_LD_BLOCK, () => '')
    .replace(tag, `${tag}\n    <meta name="robots" content="noindex" />`);
}
