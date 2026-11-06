/** Precios por estación: IDEESS → un precio (milésimas de euro, o null) por combustible. */
export type PriceMap = Record<string, (number | null)[]>;

export interface Diff {
  /** Estaciones con algún precio distinto */
  changed: number;
  /** Cambios por combustible (misma posición que `FUELS`) */
  changedByFuel: number[];
  added: number;
  removed: number;
}

/** Compara dos fotos de precios: cuántas estaciones (y precios) han cambiado entre una y otra. */
export function comparePrices(previous: PriceMap, current: PriceMap): Diff {
  const changedByFuel = [0, 0, 0, 0, 0, 0];
  let changed = 0;
  let added = 0;
  for (const [id, now] of Object.entries(current)) {
    const before = previous[id];
    if (!before) {
      added += 1;
      continue;
    }
    let differs = false;
    now.forEach((price, index) => {
      if (price !== (before[index] ?? null)) {
        changedByFuel[index] = (changedByFuel[index] ?? 0) + 1;
        differs = true;
      }
    });
    if (differs) changed += 1;
  }
  const removed = Object.keys(previous).filter((id) => !(id in current)).length;
  return { changed, changedByFuel, added, removed };
}

export interface Sample {
  /** Instante de la medición (ISO, UTC) */
  at: string;
  /** Hora de Madrid, «HH:MM» */
  madrid: string;
  minutesSincePrevious: number | null;
  changed: number | null;
  error?: string;
}

/** Hora y minuto en Madrid de un instante. */
export function madridTime(date: Date): { hour: number; minute: number; text: string } {
  const parts = new Intl.DateTimeFormat('es-ES', {
    timeZone: 'Europe/Madrid',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  const hour = Number(parts.find((p) => p.type === 'hour')?.value ?? 0);
  const minute = Number(parts.find((p) => p.type === 'minute')?.value ?? 0);
  return {
    hour,
    minute,
    text: `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`,
  };
}

export interface HourSummary {
  /** Hora de Madrid (0–23) */
  hour: number;
  mediciones: number;
  /** Suma de estaciones con cambios de precio en las comparaciones de esa hora */
  estacionesConCambios: number;
}

/** Cambios por hora de Madrid, la hora con más cambios y la ventana de medianoche (23:30–01:30). */
export function summarize(samples: Sample[]): {
  porHoraMadrid: HourSummary[];
  horaConMasCambios: number | null;
  ventanaMedianoche: {
    desde: string;
    hasta: string;
    mediciones: number;
    estacionesConCambios: number;
  };
} {
  const byHour = new Map<number, HourSummary>();
  let midnight = 0;
  let midnightSamples = 0;
  for (const sample of samples) {
    if (sample.changed === null) continue;
    const [h, m] = sample.madrid.split(':').map(Number) as [number, number];
    const entry = byHour.get(h) ?? { hour: h, mediciones: 0, estacionesConCambios: 0 };
    entry.mediciones += 1;
    entry.estacionesConCambios += sample.changed;
    byHour.set(h, entry);
    const minutes = h * 60 + m;
    if (minutes >= 23 * 60 + 30 || minutes <= 60 + 30) {
      midnight += sample.changed;
      midnightSamples += 1;
    }
  }
  const porHoraMadrid = [...byHour.values()].sort((a, b) => a.hour - b.hour);
  const top = [...porHoraMadrid].sort((a, b) => b.estacionesConCambios - a.estacionesConCambios)[0];
  return {
    porHoraMadrid,
    horaConMasCambios: top && top.estacionesConCambios > 0 ? top.hour : null,
    ventanaMedianoche: {
      desde: '23:30',
      hasta: '01:30',
      mediciones: midnightSamples,
      estacionesConCambios: midnight,
    },
  };
}
