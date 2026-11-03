import { describe, expect, it } from 'vitest';
import { formatDateTime, formatPrice } from '../../src/lib/format';

describe('formatPrice', () => {
  it('usa 3 decimales con coma', () => {
    expect(formatPrice(1459)).toBe('1,459 €/L');
    expect(formatPrice(1999)).toBe('1,999 €/L');
    expect(formatPrice(1400)).toBe('1,400 €/L');
  });
});

describe('formatDateTime', () => {
  it('muestra la hora de España', () => {
    expect(formatDateTime('2026-10-28T15:39:26.000Z')).toBe('28/10/2026, 16:39');
    expect(formatDateTime('2026-07-15T10:00:00.000Z')).toBe('15/07/2026, 12:00');
  });
});
