import { appendFileSync, existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { metaSchema } from '../src/lib/data-schema.ts';

/**
 * Antigüedad de los datos que se van a publicar (`npm run check:freshness`). Si la API del
 * Ministerio falla, la ingesta conserva el último dato bueno y la ejecución sale en verde con datos
 * viejos: nadie se entera. Este paso mide la antigüedad de `sourceDate` (la fecha de la última
 * descarga buena) y, pasado el umbral, pide que la ejecución termine en rojo para que GitHub envíe
 * el correo de fallo al propietario. Nunca falla por sí mismo: escribe las salidas `age_hours` y
 * `alert` y deja que el workflow decida (ver `deploy.yml`, trabajo `data-freshness`).
 *
 * Para no enviar un correo cada 15 minutos mientras dure una caída, `alert` solo es `true` en una
 * ventana de `windowMinutes` al cruzar el umbral y otra vez cada `repeatEveryHours` horas.
 */
export interface FreshnessInput {
  /** Fecha de la última descarga buena (`meta.sourceDate`) */
  sourceDate: string;
  now: number;
  alertAfterHours?: number;
  repeatEveryHours?: number;
  /** Anchura de la ventana de aviso; igual al intervalo del disparador externo (15 min) */
  windowMinutes?: number;
}

export interface Freshness {
  ageHours: number;
  stale: boolean;
  alert: boolean;
}

export function evaluateFreshness(input: FreshnessInput): Freshness {
  const { sourceDate, now, alertAfterHours = 6, repeatEveryHours = 24, windowMinutes = 15 } = input;
  const time = Date.parse(sourceDate);
  // Una fecha ilegible es un fallo de datos: se avisa siempre
  if (Number.isNaN(time)) return { ageHours: Number.POSITIVE_INFINITY, stale: true, alert: true };
  const ageMinutes = (now - time) / 60_000;
  const thresholdMinutes = alertAfterHours * 60;
  const stale = ageMinutes >= thresholdMinutes;
  const sinceThreshold = ageMinutes - thresholdMinutes;
  const alert = stale && sinceThreshold % (repeatEveryHours * 60) < windowMinutes;
  return { ageHours: ageMinutes / 60, stale, alert };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = resolve(import.meta.dirname, '..');
  const file = resolve(root, 'public/data/meta.json');
  const alertAfterHours = Number(process.env['FRESHNESS_ALERT_HOURS'] ?? 6);
  const repeatEveryHours = Number(process.env['FRESHNESS_REPEAT_HOURS'] ?? 24);
  let result: Freshness;
  let sourceDate = 'sin meta.json';
  if (!existsSync(file)) {
    result = { ageHours: Number.POSITIVE_INFINITY, stale: true, alert: true };
  } else {
    const meta = metaSchema.parse(JSON.parse(readFileSync(file, 'utf8')));
    sourceDate = meta.sourceDate;
    result = evaluateFreshness({ sourceDate, now: Date.now(), alertAfterHours, repeatEveryHours });
  }
  const age = Number.isFinite(result.ageHours) ? result.ageHours.toFixed(1) : 'desconocida';
  const message = `Datos del Ministerio de ${sourceDate}: antigüedad ${age} h (umbral de aviso ${alertAfterHours} h)`;
  if (result.stale) console.log(`::warning title=Datos sin actualizar::${message}`);
  else console.log(message);
  const output = process.env['GITHUB_OUTPUT'];
  if (output) {
    appendFileSync(output, `age_hours=${age}\nalert=${result.alert}\n`);
  }
  const summary = process.env['GITHUB_STEP_SUMMARY'];
  if (summary && result.stale) appendFileSync(summary, `## ⚠ Datos sin actualizar\n\n${message}\n`);
}
