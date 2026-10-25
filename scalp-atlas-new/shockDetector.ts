/**
 * ScalpAtlas SHOCK: one forming candle, sharp excursion followed by recovery.
 *
 * IMPORTANT: the caller must provide multiple timestamped prices from the
 * SAME still-open candle. A static screenshot cannot establish this sequence.
 * This detector never computes a win probability or places trades.
 */
export type ShockDirection = 'BUY' | 'SELL' | 'NONE';
export type ShockSample = { timestampMs: number; price: number };
export type ShockResult = {
  signal: ShockDirection;
  reason: string;
  excursionFraction: number;
  recoveryFraction: number;
};

const WAIT = (reason: string): ShockResult => ({
  signal: 'NONE', reason, excursionFraction: 0, recoveryFraction: 0,
});

export function detectCandleShock(
  samples: ShockSample[],
  candleStartMs: number,
  candleDurationMs: number,
  options: { minExcursionFraction?: number; minRecoveryFraction?: number } = {},
): ShockResult {
  if (![candleStartMs, candleDurationMs].every(Number.isFinite) || candleDurationMs <= 0)
    return WAIT('Interval de lumânare invalid');
  if (!Array.isArray(samples) || samples.length < 4)
    return WAIT('Sunt necesare cel puțin patru observații LIVE');
  if (samples.some(s => !Number.isFinite(s.price) || s.price <= 0 ||
      !Number.isFinite(s.timestampMs) ||
      s.timestampMs < candleStartMs || s.timestampMs >= candleStartMs + candleDurationMs))
    return WAIT('Observațiile trebuie să provină din aceeași lumânare deschisă');
  if (samples.some((s, i) => i > 0 && s.timestampMs <= samples[i - 1].timestampMs))
    return WAIT('Ordinea observațiilor este invalidă');

  const minExcursion = options.minExcursionFraction ?? 0.001;
  const minRecovery = options.minRecoveryFraction ?? 0.65;
  if (!(minExcursion > 0 && minRecovery > 0 && minRecovery <= 1))
    return WAIT('Praguri invalide');

  const first = samples[0].price;
  const last = samples[samples.length - 1].price;
  // The turning point must be observed between the first and last sample.
  const middle = samples.slice(1, -1);
  const low = Math.min(...middle.map(s => s.price));
  const high = Math.max(...middle.map(s => s.price));

  const downExcursion = (first - low) / first;
  const upExcursion = (high - first) / first;
  const buyRecovery = first > low ? (last - low) / (first - low) : 0;
  const sellRecovery = high > first ? (high - last) / (high - first) : 0;

  // Reject ambiguous two-sided spikes instead of inventing a direction.
  const buy = downExcursion >= minExcursion && buyRecovery >= minRecovery && last > low;
  const sell = upExcursion >= minExcursion && sellRecovery >= minRecovery && last < high;
  if (buy === sell) return WAIT(buy ? 'Mișcare ambiguă în ambele direcții' : 'ȘOC neconfirmat');
  return buy
    ? { signal: 'BUY', reason: 'Cădere și recuperare în aceeași lumânare', excursionFraction: downExcursion, recoveryFraction: buyRecovery }
    : { signal: 'SELL', reason: 'Urcare și retragere în aceeași lumânare', excursionFraction: upExcursion, recoveryFraction: sellRecovery };
}
