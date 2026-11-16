import type { PageMeta } from '../src/lib/page-meta.ts';

/**
 * HTML de una pantalla estática a partir del `index.html` compilado. GitHub Pages sirve `/favoritos`
 * con el fichero `favoritos.html` y estado 200 (sin redirección), así que cada pantalla pública
 * tiene el suyo, con título, descripción, dirección canónica y datos para compartir propios.
 * Si una etiqueta esperada no está, falla: es mejor romper el build que publicar la portada
 * disfrazada de otra pantalla.
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

export function renderStaticPage(html: string, page: PageMeta, site: string): string {
  const url = `${site}${page.path}`;
  const title = escapeAttribute(page.title);
  const description = escapeAttribute(page.description);
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
  return out;
}

/** `404.html`: la portada con `noindex`. Se sirve con estado 404 (y también en `/404`, con 200). */
export function renderNotFoundPage(html: string): string {
  const tag = '<meta charset="UTF-8" />';
  if (!html.includes(tag)) throw new Error('index.html no tiene meta charset');
  return html.replace(tag, `${tag}\n    <meta name="robots" content="noindex" />`);
}
