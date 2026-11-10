import { appendFileSync, existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { metaSchema, type Meta } from '../src/lib/data-schema';

/**
 * Decide si «Ingesta y despliegue» debe compilar y desplegar o puede omitirse (`npm run
 * compare:published`). Compara los datos recién ingeridos (`public/data/meta.json`) con los que sirve
 * ahora mismo GitHub Pages.
 *
 * Regla: se omite SOLO si el evento es `schedule` o `workflow_dispatch` (sin `force`), el código
 * publicado es el de esta ejecución, la dirección con la que se compiló es la actual (cambiar de
 * dominio o de ruta base obliga a desplegar aunque los datos sean iguales) y la huella de contenido
 * y el fichero de estaciones coinciden.
 * Falla abierto: ante cualquier duda (no se puede descargar o leer lo publicado, falta la huella,
 * formato distinto) se despliega.
 */
export interface Decision {
  deploy: boolean;
  reason: string;
}

export interface DecideInput {
  event: string;
  force: boolean;
  /** Commit de esta ejecución (`GITHUB_SHA`) */
  sha: string;
  fresh: Meta;
  /** `meta.json` publicado, o `null` si no se pudo descargar o no es válido */
  published: Meta | null;
  /** Commit del código publicado (`version.json`), o `null` si no se pudo leer */
  publishedSha: string | null;
  /** Dirección pública de esta ejecución (`SITE_URL`) */
  site: string;
  /** Dirección con la que se compiló lo publicado (`version.json`), o `null` si no consta */
  publishedSite: string | null;
}

export function decideDeploy(input: DecideInput): Decision {
  const { event, force, sha, fresh, published, publishedSha, site, publishedSite } = input;
  if (event !== 'schedule' && event !== 'workflow_dispatch') {
    return { deploy: true, reason: `evento «${event}»: siempre se despliega` };
  }
  if (event === 'workflow_dispatch' && force) {
    return { deploy: true, reason: 'entrada manual force=true' };
  }
  if (!published) {
    return {
      deploy: true,
      reason: 'no se pudo leer el meta.json publicado (se despliega por si acaso)',
    };
  }
  if (!published.contentHash || !fresh.contentHash) {
    return { deploy: true, reason: 'falta la huella de contenido en lo publicado o en lo nuevo' };
  }
  if (!publishedSha || publishedSha !== sha) {
    return {
      deploy: true,
      reason: publishedSha
        ? `el código publicado (${publishedSha.slice(0, 7)}) no es el de esta ejecución (${sha.slice(0, 7)})`
        : 'no se pudo leer la versión publicada (version.json)',
    };
  }
  if (publishedSite !== site) {
    return {
      deploy: true,
      reason: publishedSite
        ? `lo publicado se compiló para otra dirección (${publishedSite}), no para ${site}`
        : 'lo publicado no indica la dirección con la que se compiló',
    };
  }
  if (published.schemaVersion !== fresh.schemaVersion || published.demo !== fresh.demo) {
    return { deploy: true, reason: 'cambia el formato de los datos o el modo de demostración' };
  }
  if (published.stationsFile !== fresh.stationsFile) {
    return { deploy: true, reason: 'cambian las estaciones (otro fichero de estaciones)' };
  }
  if (published.contentHash !== fresh.contentHash) {
    return { deploy: true, reason: 'cambian los precios o los datos de las estaciones' };
  }
  return { deploy: false, reason: 'sin cambios, no se despliega' };
}

/** Descarga un JSON de lo publicado esquivando cualquier caché (parámetro único y cabeceras). */
export async function fetchPublished(
  url: string,
  fetchImpl: typeof fetch = fetch,
): Promise<unknown | null> {
  try {
    const bust = `${url}${url.includes('?') ? '&' : '?'}nocache=${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const response = await fetchImpl(bust, {
      cache: 'no-store',
      headers: { 'Cache-Control': 'no-cache', Pragma: 'no-cache' },
      signal: AbortSignal.timeout(20_000),
    });
    if (!response.ok) return null;
    return (await response.json()) as unknown;
  } catch {
    return null;
  }
}

/** Lee el `meta.json` publicado; `null` si falta o no cumple el esquema. */
export function parsePublishedMeta(json: unknown): Meta | null {
  const result = metaSchema.safeParse(json);
  return result.success ? result.data : null;
}

export function parsePublishedSha(json: unknown): string | null {
  if (typeof json === 'object' && json !== null && 'sha' in json) {
    const sha = (json as { sha: unknown }).sha;
    return typeof sha === 'string' && /^[0-9a-f]{7,40}$/.test(sha) ? sha : null;
  }
  return null;
}

export function parsePublishedSite(json: unknown): string | null {
  if (typeof json === 'object' && json !== null && 'site' in json) {
    const site = (json as { site: unknown }).site;
    return typeof site === 'string' && /^https?:\/\/\S+$/.test(site) ? site : null;
  }
  return null;
}

async function main() {
  const root = resolve(import.meta.dirname, '..');
  const site = (process.env['SITE_URL'] ?? '').replace(/\/?$/, '/');
  const event = process.env['GITHUB_EVENT_NAME'] ?? 'push';
  const force = process.env['FORCE'] === 'true';
  const sha = process.env['GITHUB_SHA'] ?? '';
  const metaPath = resolve(root, 'public/data/meta.json');
  if (!existsSync(metaPath))
    throw new Error('Falta public/data/meta.json: la ingesta no ha corrido');
  const fresh = metaSchema.parse(JSON.parse(readFileSync(metaPath, 'utf8')));

  let decision: Decision;
  if (!site || site === '/') {
    decision = { deploy: true, reason: 'sin SITE_URL: se despliega' };
  } else {
    const [metaJson, versionJson] = await Promise.all([
      fetchPublished(`${site}data/meta.json`),
      fetchPublished(`${site}version.json`),
    ]);
    decision = decideDeploy({
      event,
      force,
      sha,
      fresh,
      published: parsePublishedMeta(metaJson),
      publishedSha: parsePublishedSha(versionJson),
      site,
      publishedSite: parsePublishedSite(versionJson),
    });
  }

  const line = decision.deploy ? `Se despliega: ${decision.reason}.` : `${decision.reason}.`;
  console.log(line);
  const output = process.env['GITHUB_OUTPUT'];
  if (output) appendFileSync(output, `deploy=${decision.deploy}\nreason=${decision.reason}\n`);
  const summary = process.env['GITHUB_STEP_SUMMARY'];
  if (summary) {
    appendFileSync(
      summary,
      [
        `### ${decision.deploy ? 'Despliegue' : 'Sin cambios, no se despliega'}`,
        '',
        `- Motivo: ${decision.reason}`,
        `- Evento: \`${event}\`${force ? ' (force=true)' : ''}`,
        `- Estaciones: ${fresh.stationCount} · huella de contenido: \`${fresh.contentHash ?? '—'}\``,
        '',
      ].join('\n'),
    );
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error: unknown) => {
    // Falla abierto: si esta comprobación se rompe, se despliega
    console.error(`No se pudo comparar con lo publicado: ${String(error)}`);
    const output = process.env['GITHUB_OUTPUT'];
    if (output) {
      appendFileSync(output, 'deploy=true\nreason=error al comparar con lo publicado\n');
    }
  });
}
