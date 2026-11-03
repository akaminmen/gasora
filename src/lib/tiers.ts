/** Tramos de precio relativo (sección 6 del plan). El color nunca va solo: lleva símbolo y texto. */
export type Tier = 'cheap' | 'mid' | 'high' | 'top';

export const TIERS: Tier[] = ['cheap', 'mid', 'high', 'top'];

export const TIER_LABELS: Record<Tier, string> = {
  cheap: 'Barata',
  mid: 'Media',
  high: 'Alta',
  top: 'Cara',
};

/** ▼ barata, — media, ▲ alta y cara */
export const TIER_SYMBOLS: Record<Tier, 'down' | 'dash' | 'up'> = {
  cheap: 'down',
  mid: 'dash',
  high: 'up',
  top: 'up',
};
