/** Tamaño máximo de un SVG de logo. */
export const MAX_SVG_BYTES = 8 * 1024;
/** Aviso (no error) para los logos en WebP o PNG. */
export const WARN_RASTER_BYTES = 30 * 1024;

/**
 * Defectos de un SVG de logo: tamaño, scripts y referencias externas. Un SVG con `<script>`, con
 * manejadores `on…=`, `foreignObject`, enlaces que no sean internos (`#id`), `url()` externos,
 * `@import` o entidades externas no se admite: se sirve desde el mismo origen que la app.
 */
export function svgProblems(text: string, bytes: number): string[] {
  const problems: string[] = [];
  if (bytes > MAX_SVG_BYTES) {
    problems.push(`pesa ${(bytes / 1024).toFixed(1)} KB (máximo ${MAX_SVG_BYTES / 1024} KB)`);
  }
  if (!/<svg[\s>]/i.test(text)) problems.push('no es un SVG (falta la etiqueta <svg>)');
  if (/<script[\s>/]/i.test(text)) problems.push('contiene <script>');
  if (/<foreignObject[\s>/]/i.test(text)) problems.push('contiene <foreignObject>');
  if (/<(iframe|object|embed)[\s>/]/i.test(text)) problems.push('incrusta contenido externo');
  if (/\son[a-z]+\s*=/i.test(text)) problems.push('contiene manejadores de eventos (on…=)');
  if (/javascript:/i.test(text)) problems.push('contiene «javascript:»');
  if (/<!ENTITY/i.test(text)) problems.push('declara entidades (<!ENTITY)');
  if (/@import/i.test(text)) problems.push('usa @import');
  for (const match of text.matchAll(/(?:xlink:)?href\s*=\s*["']([^"']*)["']/gi)) {
    const value = (match[1] ?? '').trim();
    if (!value.startsWith('#'))
      problems.push(`referencia externa en href: «${value.slice(0, 40)}»`);
  }
  for (const match of text.matchAll(/url\(\s*["']?([^)"']*)/gi)) {
    const value = (match[1] ?? '').trim();
    if (!value.startsWith('#'))
      problems.push(`referencia externa en url(): «${value.slice(0, 40)}»`);
  }
  if (/https?:\/\/(?!www\.w3\.org\/)/i.test(text)) {
    problems.push('contiene direcciones http(s) que no son de espacios de nombres del W3C');
  }
  return [...new Set(problems)];
}
