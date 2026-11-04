import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { collectPackages, renderText } from '../../scripts/licenses';

const file = readFileSync(
  resolve(import.meta.dirname, '../../public/licencias-de-terceros.txt'),
  'utf8',
);

describe('licencias-de-terceros.txt', () => {
  const packages = collectPackages();

  it('incluye todas las librerías de producción y el código de Workbox del service worker', () => {
    const names = packages.map((p) => p.name);
    for (const required of ['maplibre-gl', 'react', 'zustand', 'zod', 'workbox-core', 'idb']) {
      expect(names).toContain(required);
    }
    // Si cambian las dependencias hay que volver a ejecutar `npm run licenses`
    const missing = names.filter((name) => !file.includes(`\n${name} `));
    expect(missing).toEqual([]);
  });

  it('reproduce el texto de las licencias, también el de las fuentes (OFL)', () => {
    expect(file).toContain('SIL OPEN FONT LICENSE Version 1.1');
    expect(file).toContain('Permission is hereby granted, free of charge');
    expect(file).toContain('Redistribution and use in source and binary forms');
  });

  it('ningún paquete queda sin licencia declarada', () => {
    expect(packages.filter((p) => p.license === '¿?')).toEqual([]);
  });

  it('el texto generado coincide, salvo versiones, con el archivo publicado', () => {
    const strip = (text: string) => text.replace(/^(\S+) \S+ — /gm, '$1 — ');
    expect(strip(renderText(packages))).toBe(strip(file));
  });
});
