import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

/**
 * Comprobación de solo lectura de la web publicada (`npm run verify:site [dirección]`). Descarga la
 * portada, extrae las URL de scripts, hojas de estilo, iconos y manifiesto, y comprueba que todas
 * responden 200 y con un tipo de contenido coherente (no un HTML donde debería haber un script, que
 * es lo que pasa cuando la ruta base está mal). Pensada para ejecutarla a mano tras un despliegue.
 * Solo hace peticiones GET; no escribe nada. Sale con código 1 si algo falla.
 */
export const DEFAULT_SITE = 'https://gasora.es/';

export interface Check {
  url: string;
  /** Familia de tipo de contenido esperada; `null` si no se exige ninguna */
  expect: 'html' | 'js' | 'css' | 'image' | 'json' | 'text' | null;
}

const TAGS = /<(link|script|meta|img)\b([^>]*)>/gi;

function attribute(tag: string, name: string): string | undefined {
  return new RegExp(`\\s${name}\\s*=\\s*"([^"]*)"`, 'i').exec(tag)?.[1];
}

/** Recursos que carga la portada: scripts, hojas de estilo, precargas, iconos y manifiesto. */
export function extractHtmlResources(html: string, pageUrl: string): Check[] {
  const found = new Map<string, Check>();
  for (const match of html.matchAll(TAGS)) {
    const tag = (match[1] ?? '').toLowerCase();
    const attrs = ` ${match[2] ?? ''}`;
    let raw: string | undefined;
    let kind: Check['expect'] = null;
    if (tag === 'script') {
      raw = attribute(attrs, 'src');
      kind = 'js';
    } else if (tag === 'img') {
      raw = attribute(attrs, 'src');
      kind = 'image';
    } else if (tag === 'link') {
      const rel = (attribute(attrs, 'rel') ?? '').toLowerCase();
      raw = attribute(attrs, 'href');
      if (rel.includes('stylesheet')) kind = 'css';
      else if (rel.includes('modulepreload')) kind = 'js';
      else if (rel.includes('icon')) kind = 'image';
      else if (rel.includes('manifest')) kind = 'json';
      else continue;
    } else if (attribute(attrs, 'property') === 'og:image') {
      raw = attribute(attrs, 'content');
      kind = 'image';
    }
    if (!raw || raw.startsWith('data:') || raw.startsWith('#')) continue;
    const url = new URL(raw, pageUrl).href;
    found.set(url, { url, expect: kind });
  }
  return [...found.values()];
}

/** Iconos del manifiesto, resueltos respecto a la dirección del manifiesto. */
export function extractManifestResources(manifest: unknown, manifestUrl: string): Check[] {
  if (typeof manifest !== 'object' || manifest === null) return [];
  const icons = (manifest as { icons?: { src?: unknown }[] }).icons ?? [];
  return icons.flatMap((icon) =>
    typeof icon.src === 'string'
      ? [{ url: new URL(icon.src, manifestUrl).href, expect: 'image' as const }]
      : [],
  );
}

const TYPES: Record<NonNullable<Check['expect']>, RegExp> = {
  html: /text\/html/,
  js: /javascript|ecmascript/,
  css: /text\/css/,
  image: /^image\//,
  json: /json/,
  text: /^text\//,
};

/** `null` si la respuesta es correcta; si no, el motivo. */
export function judge(check: Check, status: number, contentType: string): string | null {
  if (status !== 200) return `HTTP ${status}`;
  if (check.expect && !TYPES[check.expect].test(contentType.toLowerCase())) {
    return `tipo «${contentType || 'sin tipo'}» en lugar de ${check.expect}`;
  }
  return null;
}

async function get(url: string): Promise<Response> {
  return fetch(url, {
    redirect: 'follow',
    cache: 'no-store',
    headers: { 'Cache-Control': 'no-cache' },
    signal: AbortSignal.timeout(20_000),
  });
}

export async function verifySite(site: string): Promise<{ lines: string[]; failures: number }> {
  const lines: string[] = [];
  let failures = 0;
  const report = (ok: boolean, text: string) => {
    if (!ok) failures += 1;
    lines.push(`${ok ? 'OK    ' : 'FALLA '} ${text}`);
  };

  const home = await get(site).catch((error: unknown) => error);
  if (!(home instanceof Response)) {
    report(false, `${site}: no se pudo descargar (${String(home)})`);
    return { lines, failures };
  }
  const homeProblem = judge(
    { url: site, expect: 'html' },
    home.status,
    home.headers.get('content-type') ?? '',
  );
  report(!homeProblem, `${site}${homeProblem ? ` → ${homeProblem}` : ''}`);
  if (homeProblem) return { lines, failures };
  const html = await home.text();
  // Si hubo redirección, los recursos se resuelven respecto a la dirección final
  const pageUrl = home.url || site;
  if (pageUrl !== site) lines.push(`       (redirige a ${pageUrl})`);

  const checks = new Map<string, Check>();
  const add = (list: Check[]) => list.forEach((check) => checks.set(check.url, check));
  add(extractHtmlResources(html, pageUrl));

  const manifest = [...checks.values()].find((check) => check.expect === 'json');
  if (!manifest) report(false, 'la portada no enlaza el manifiesto');
  else {
    const response = await get(manifest.url).catch(() => null);
    const json: unknown = response?.ok ? await response.json().catch(() => null) : null;
    if (json) {
      add(extractManifestResources(json, manifest.url));
      const { start_url: startUrl, scope } = json as { start_url?: string; scope?: string };
      const expected = new URL('./', pageUrl).pathname;
      for (const [name, value] of [
        ['start_url', startUrl],
        ['scope', scope],
      ] as const) {
        const path = value ? new URL(value, manifest.url).pathname : '';
        report(path === expected, `manifiesto: ${name} = ${value ?? '—'} (se espera ${expected})`);
      }
    }
  }

  // Ficheros que la aplicación publica siempre
  add([
    { url: new URL('version.json', pageUrl).href, expect: 'json' },
    { url: new URL('data/meta.json', pageUrl).href, expect: 'json' },
    { url: new URL('sw.js', pageUrl).href, expect: 'js' },
    { url: new URL('robots.txt', pageUrl).href, expect: 'text' },
    { url: new URL('sitemap.xml', pageUrl).href, expect: null },
    { url: new URL('404.html', pageUrl).href, expect: null },
  ]);

  for (const check of checks.values()) {
    const response = await get(check.url).catch((error: unknown) => error);
    const problem =
      response instanceof Response
        ? judge(check, response.status, response.headers.get('content-type') ?? '')
        : `no se pudo descargar (${String(response)})`;
    report(!problem, `${check.url}${problem ? ` → ${problem}` : ''}`);
  }

  // La dirección con la que se compiló debe ser la que se visita
  const version = await get(new URL('version.json', pageUrl).href)
    .then((r) => r.json() as Promise<{ site?: string }>)
    .catch(() => null);
  if (version?.site) {
    report(
      new URL(version.site).origin === new URL(pageUrl).origin,
      `version.json: compilada para ${version.site}`,
    );
  }
  return { lines, failures };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const site = (process.argv[2] ?? process.env['SITE_URL'] ?? DEFAULT_SITE).replace(/\/?$/, '/');
  const { lines, failures } = await verifySite(site);
  console.log(lines.join('\n'));
  if (failures) {
    console.error(`\n${failures} comprobación(es) fallida(s) en ${site}`);
    process.exitCode = 1;
  } else {
    console.log(`\nTodo correcto en ${site}`);
  }
}
