import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { CARD_SAMPLES, LONG_ADDRESS, LONG_NAME } from '../../src/features/ui-kit/samples';

const css = readFileSync(resolve(import.meta.dirname, '../../src/styles/tokens.css'), 'utf8');

/** Lee las variables de un bloque `selector { … }` de tokens.css. */
function block(selector: string): Record<string, string> {
  const start = css.indexOf(`${selector} {`);
  if (start < 0) throw new Error(`No hay bloque ${selector}`);
  const body = css.slice(start, css.indexOf('}', start));
  return Object.fromEntries(
    [...body.matchAll(/(--[\w-]+):\s*([^;]+);/g)].map((m) => [
      m[1] as string,
      (m[2] as string).trim(),
    ]),
  );
}

function luminance(hex: string): number {
  const n = Number.parseInt(hex.slice(1), 16);
  const channels = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * (channels[0] ?? 0) + 0.7152 * (channels[1] ?? 0) + 0.0722 * (channels[2] ?? 0);
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

const light = block(':root');
const dark = { ...light, ...block(":root[data-theme='dark'],\n[data-theme='dark']") };

// Pares de texto/fondo que usa la interfaz. Texto normal: 4,5:1. Elementos gráficos: 3:1.
const TEXT_PAIRS: [string, string][] = [
  ['--ink', '--bg'],
  ['--ink', '--surface'],
  ['--ink', '--surface-2'],
  ['--muted', '--bg'],
  ['--muted', '--surface'],
  ['--muted', '--surface-2'],
  ['--muted', '--brand-50'],
  ['--brand-link', '--bg'],
  ['--brand-link', '--surface'],
  ['--brand-link', '--brand-50'],
  ['--brand-link', '--brand-100'],
  ['--on-brand', '--brand-500'],
  ['--on-brand', '--brand-600'],
  ['--avatar-1-fg', '--avatar-1-bg'],
  ['--avatar-2-fg', '--avatar-2-bg'],
  ['--avatar-3-fg', '--avatar-3-bg'],
  ['--tier-cheap-fg', '--tier-cheap-bg'],
  ['--tier-mid-fg', '--tier-mid-bg'],
  ['--tier-high-fg', '--tier-high-bg'],
  ['--tier-top-fg', '--tier-top-bg'],
];

describe('contraste de los tokens (WCAG AA)', () => {
  for (const [name, tokens] of [
    ['claro', light],
    ['oscuro', dark],
  ] as const) {
    it(`texto ≥ 4,5:1 en el tema ${name}`, () => {
      const failures = TEXT_PAIRS.flatMap(([fg, bg]) => {
        const ratio = contrast(tokens[fg] as string, tokens[bg] as string);
        return ratio >= 4.5 ? [] : [`${fg} sobre ${bg}: ${ratio.toFixed(2)}:1`];
      });
      expect(failures).toEqual([]);
    });

    it(`el logotipo y el foco son visibles (≥ 3:1) en el tema ${name}`, () => {
      expect(
        contrast(tokens['--brand-logo'] as string, tokens['--bg'] as string),
      ).toBeGreaterThanOrEqual(3);
      expect(
        contrast(tokens['--focus'] as string, tokens['--bg'] as string),
      ).toBeGreaterThanOrEqual(3);
      expect(
        contrast(tokens['--focus'] as string, tokens['--surface'] as string),
      ).toBeGreaterThanOrEqual(3);
    });
  }

  it('los valores del plan están en tokens.css (sección 9.2)', () => {
    expect(light['--brand-500']).toBe('#4f46e5');
    expect(light['--brand-link']).toBe('#4338ca');
    expect(dark['--brand-link']).toBe('#a5b4fc');
    expect(dark['--bg']).toBe('#0a1220');
    expect(dark['--surface']).toBe('#141c2b');
  });

  it('la escala de precios es la misma en ambos temas', () => {
    for (const token of ['--tier-cheap-bg', '--tier-mid-bg', '--tier-high-bg', '--tier-top-bg']) {
      expect(dark[token]).toBe(light[token]);
    }
    expect(light['--tier-cheap-bg']).toBe('#15803d');
    expect(light['--tier-mid-bg']).toBe('#facc15');
    expect(light['--tier-high-bg']).toBe('#c2410c');
    expect(light['--tier-top-bg']).toBe('#b91c1c');
  });

  it('el verde solo aparece en la escala de precios, no como color de marca', () => {
    const brandTokens = Object.entries(light).filter(([k]) => k.startsWith('--brand'));
    for (const [, value] of brandTokens) {
      const n = Number.parseInt(value.slice(1), 16);
      const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255] as [number, number, number];
      expect(g > r && g > b).toBe(false);
    }
  });
});

describe('muestras extremas de la galería', () => {
  it('usan el rótulo de 86 caracteres y la dirección de 104 de los datos reales', () => {
    expect(LONG_NAME).toHaveLength(86);
    expect(LONG_ADDRESS).toHaveLength(104);
  });

  it('cubren los casos de la sección 9.7 (regla 6)', () => {
    expect(CARD_SAMPLES.some((c) => c.price === 1999)).toBe(true);
    expect(CARD_SAMPLES.some((c) => (c.saving ?? 0) >= 100)).toBe(true);
    expect(CARD_SAMPLES.some((c) => !c.saving)).toBe(true);
    expect(CARD_SAMPLES.some((c) => !c.best)).toBe(true);
    expect(CARD_SAMPLES.some((c) => c.best)).toBe(true);
    expect(CARD_SAMPLES.some((c) => c.name === LONG_NAME && c.address === LONG_ADDRESS)).toBe(true);
  });
});
