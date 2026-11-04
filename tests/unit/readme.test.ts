import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = resolve(import.meta.dirname, '../..');

/** Enlaces y imágenes locales de un Markdown (sin http, mailto ni anclas). */
function localTargets(file: string): { kind: 'imagen' | 'enlace'; target: string }[] {
  const text = readFileSync(resolve(root, file), 'utf8');
  const found: { kind: 'imagen' | 'enlace'; target: string }[] = [];
  for (const match of text.matchAll(/(!?)\[[^\]]*\]\(([^)\s]+)\)/g)) {
    const target = (match[2] ?? '').split('#')[0] ?? '';
    if (!target || /^(https?:|mailto:)/.test(target)) continue;
    found.push({ kind: match[1] ? 'imagen' : 'enlace', target });
  }
  return found;
}

describe('README.md', () => {
  const targets = localTargets('README.md');

  it('solo enlaza imágenes que existen', () => {
    const images = targets.filter((t) => t.kind === 'imagen');
    expect(images.length).toBeGreaterThan(0);
    const missing = images
      .filter((t) => !existsSync(resolve(root, dirname('README.md'), t.target)))
      .map((t) => t.target);
    expect(missing).toEqual([]);
  });

  it('solo enlaza documentos y carpetas del repositorio que existen', () => {
    const missing = targets
      .filter((t) => t.kind === 'enlace')
      .filter((t) => !existsSync(resolve(root, t.target)))
      .map((t) => t.target);
    expect(missing).toEqual([]);
  });

  it('indica la fecha de las capturas', () => {
    expect(readFileSync(resolve(root, 'README.md'), 'utf8')).toMatch(
      /Capturas tomadas el \d{2}\/\d{2}\/\d{4}/,
    );
  });
});
