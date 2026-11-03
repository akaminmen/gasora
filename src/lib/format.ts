const priceFormat = new Intl.NumberFormat('es-ES', {
  minimumFractionDigits: 3,
  maximumFractionDigits: 3,
});

/** 1459 (milésimas de euro) → «1,459 €/L» */
export function formatPrice(milli: number): string {
  return `${priceFormat.format(milli / 1000)} €/L`;
}

const dateFormat = new Intl.DateTimeFormat('es-ES', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
  timeZone: 'Europe/Madrid',
});

/** ISO UTC → «28/10/2026, 16:39» (hora de España, como la publica el Ministerio) */
export function formatDateTime(iso: string): string {
  return dateFormat.format(new Date(iso));
}

/** 1359 (milésimas de euro) → «1,359» (sin unidad; la tarjeta pone «€/L» aparte). */
export function formatPriceNumber(milli: number): string {
  return priceFormat.format(milli / 1000);
}

const moneyFormat = new Intl.NumberFormat('es-ES', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** 3.6875 → «3,69» (importes en euros, siempre 2 decimales). */
export function formatMoney(euros: number): string {
  return moneyFormat.format(euros);
}

const kmFormat = new Intl.NumberFormat('es-ES', { maximumFractionDigits: 1 });

/** 0.9 → «0,9 km»; 12.34 → «12,3 km»; 120.4 → «120 km». */
export function formatKm(km: number): string {
  return `${kmFormat.format(km >= 100 ? Math.round(km) : km)} km`;
}
