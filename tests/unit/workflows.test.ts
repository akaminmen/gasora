import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';

/** Validación de los workflows de GitHub Actions: YAML correcto y las reglas que nos importan. */
const dir = resolve(import.meta.dirname, '../../.github/workflows');
const load = (name: string) => parse(readFileSync(resolve(dir, name), 'utf8')) as Workflow;

interface Workflow {
  name: string;
  on: {
    push?: { branches?: string[] };
    schedule?: { cron: string; timezone?: string }[];
    workflow_dispatch?: { inputs?: Record<string, { type?: string; default?: unknown }> };
  };
  concurrency?: { group: string; 'cancel-in-progress'?: boolean };
  permissions?: Record<string, string>;
  jobs: Record<
    string,
    {
      needs?: string;
      if?: string;
      outputs?: Record<string, string>;
      steps?: {
        id?: string;
        if?: string;
        run?: string;
        uses?: string;
        env?: Record<string, string>;
        'continue-on-error'?: boolean;
      }[];
    }
  >;
}

/** Instantes (minutos del día) de un cron de la forma «m1,m2 h * * *» o «m1,m2 * * * *». */
function expand(cron: string): { minutes: number[]; hours: number[] | 'all' } {
  const [m, h] = cron.split(' ');
  const list = (value: string, max: number) =>
    value === '*' ? Array.from({ length: max }, (_, i) => i) : value.split(',').map(Number);
  return { minutes: list(m!, 60), hours: h === '*' ? 'all' : list(h!, 24) };
}

describe('deploy.yml', () => {
  const deploy = load('deploy.yml');

  it('es un YAML válido con los disparadores esperados', () => {
    expect(deploy.name).toBe('Ingesta y despliegue');
    expect(deploy.on.push?.branches).toEqual(['main']);
    expect(deploy.on.workflow_dispatch).toBeDefined();
    expect(Object.keys(deploy.jobs)).toEqual(['build', 'deploy']);
    expect(deploy.jobs['deploy']?.needs).toBe('build');
  });

  it('cada cron tiene 5 campos y los minutos y horas están en rango', () => {
    for (const entry of deploy.on.schedule ?? []) {
      expect(entry.cron.split(' ')).toHaveLength(5);
      const { minutes, hours } = expand(entry.cron);
      expect(minutes.every((m) => Number.isInteger(m) && m >= 0 && m < 60)).toBe(true);
      if (hours !== 'all')
        expect(hours.every((h) => Number.isInteger(h) && h >= 0 && h < 24)).toBe(true);
    }
  });

  it('ninguna ejecución cae en los minutos 0 y 30 (alta carga de GitHub)', () => {
    const minutes = (deploy.on.schedule ?? []).flatMap((s) => expand(s.cron).minutes);
    expect(minutes.length).toBeGreaterThan(0);
    expect(minutes.filter((m) => m === 0 || m === 30)).toEqual([]);
  });

  it('las entradas con hora usan la zona de Madrid (horario de verano e invierno)', () => {
    const withHour = (deploy.on.schedule ?? []).filter((s) => expand(s.cron).hours !== 'all');
    expect(withHour.length).toBeGreaterThan(0);
    for (const entry of withHour) expect(entry.timezone).toBe('Europe/Madrid');
    // Las de «todas las horas» no necesitan zona
    const everyHour = (deploy.on.schedule ?? []).filter((s) => expand(s.cron).hours === 'all');
    expect(everyHour.length).toBeGreaterThan(0);
  });

  it('cubre de 23:30 a 01:30 (Madrid) con un hueco de 10 minutos como máximo', () => {
    const minutesOfDay: number[] = [];
    for (const entry of (deploy.on.schedule ?? []).filter((s) => s.timezone === 'Europe/Madrid')) {
      const { minutes, hours } = expand(entry.cron);
      if (hours === 'all') continue;
      for (const h of hours) for (const m of minutes) minutesOfDay.push(h * 60 + m);
    }
    // Se desenrolla la medianoche: 23:xx pasa a 23·60 − 24·60 (negativo)
    const unrolled = minutesOfDay
      .map((t) => (t >= 23 * 60 ? t - 24 * 60 : t))
      .sort((a, b) => a - b);
    expect(unrolled[0]).toBeLessThanOrEqual(-30 + 10); // empieza hacia las 23:30–23:40
    expect(unrolled[unrolled.length - 1]).toBeGreaterThanOrEqual(90 - 10); // acaba hacia la 01:20–01:30
    const gaps = unrolled.slice(1).map((t, i) => t - unrolled[i]!);
    expect(Math.max(...gaps)).toBeLessThanOrEqual(10);
    expect(unrolled.every((t) => t >= -30 && t <= 90)).toBe(true);
  });

  it('un solo despliegue a la vez y sin cancelar uno en curso', () => {
    expect(deploy.concurrency).toEqual({ group: 'pages', 'cancel-in-progress': false });
  });

  it('los permisos son los mínimos para Pages', () => {
    expect(deploy.permissions).toEqual({ contents: 'read', pages: 'write', 'id-token': 'write' });
  });

  it('tiene la entrada manual force (booleana, falsa por defecto)', () => {
    const force = deploy.on.workflow_dispatch?.inputs?.['force'];
    expect(force?.type).toBe('boolean');
    expect(force?.default).toBe(false);
  });

  describe('omitir el despliegue si los datos no cambian', () => {
    const build = deploy.jobs['build']!;
    const steps = build.steps ?? [];
    const compare = steps.find((step) => step.id === 'compare');

    it('compara con lo publicado justo después de ingerir y validar los datos', () => {
      const index = (text: string) => steps.findIndex((step) => (step.run ?? '').includes(text));
      expect(compare?.run).toBe('npm run compare:published');
      expect(steps.indexOf(compare!)).toBeGreaterThan(index('npm run ingest'));
      expect(steps.indexOf(compare!)).toBeGreaterThan(index('npm run check:data'));
    });

    it('falla abierto: si la comparación se rompe, se despliega', () => {
      expect(compare?.['continue-on-error']).toBe(true);
      expect(build.outputs?.['deploy']).toContain("!= 'false'");
      expect(deploy.jobs['deploy']?.if).toBe("needs.build.outputs.deploy == 'true'");
    });

    it('le pasa la dirección pública y la entrada force', () => {
      expect(compare?.env?.['SITE_URL']).toBe('https://gasora.es/');
      expect(compare?.env?.['FORCE']).toBe('${{ inputs.force }}');
    });

    it('solo se omiten las pruebas, la compilación y la subida del artefacto', () => {
      const skipped = steps.filter((step) => step.if === "steps.compare.outputs.deploy != 'false'");
      const names = skipped.map((step) => step.run ?? step.uses ?? '');
      expect(names).toEqual([
        'npm test',
        'npm run build',
        'npm run check:build',
        'actions/configure-pages@v6',
        'actions/upload-pages-artifact@v5',
      ]);
      // Lo demás (instalación, ingesta, comprobación de datos) se ejecuta siempre
      for (const text of ['npm ci', 'npm run ingest', 'npm run check:data']) {
        expect(steps.find((step) => step.run === text)?.if).toBeUndefined();
      }
    });
  });

  it('la ingesta va antes de la compilación y del despliegue', () => {
    const runs = (deploy.jobs['build']?.steps ?? []).map((s) => s.run ?? s.uses ?? '');
    const at = (text: string) => runs.findIndex((r) => r.includes(text));
    expect(at('npm run ingest')).toBeGreaterThan(-1);
    expect(at('npm run ingest')).toBeLessThan(at('npm run build'));
    expect(at('npm run check:data')).toBeLessThan(at('npm run build'));
    expect(at('npm run build')).toBeLessThan(at('upload-pages-artifact'));
  });
});

describe('ci.yml', () => {
  const ci = load('ci.yml');
  it('es un YAML válido y ejecuta las comprobaciones principales', () => {
    expect(Object.keys(ci.on)).toEqual(expect.arrayContaining(['push', 'pull_request']));
    const runs = (ci.jobs['quality']?.steps ?? []).map((s) => s.run ?? '');
    for (const command of [
      'npm run lint',
      'npm run typecheck',
      'npm test',
      'npm run brands:check',
      'npm run test:e2e',
    ]) {
      expect(runs).toContain(command);
    }
  });
});
