/**
 * Experimental 1.5-candle M5 retracement strategy for Scalp Atlas DEMO.
 * Pure signal evaluation only: no broker calls, orders, Bluetooth, or device control.
 * Requires verified time-series data; screenshots alone cannot prove the price sequence.
 */
export type Direction = 'BUY' | 'SELL';
export type PriceSample = { timestampMs: number; price: number };
export type ClosedM5Candle = {
  pair: string;
  startMs: number;
  endMs: number;
  open: number;
  close: number;
  sourceConfirmed: boolean;
};
export type FormingM5Candle = {
  pair: string;
  startMs: number;
  open: number;
  samples: PriceSample[];
  sourceConfirmed: boolean;
};
export type OneHalfSettings = {
  /** Smallest valid quoted price movement (one tick) for THIS instrument, supplied by a verified feed. */
  priceTickSize: number;
};
export type OneHalfResult =
  | { signal: 'NONE'; reason: string; elapsedPercent: number }
  | { signal: Direction; reason: 'ONE_HALF_M5_RETRACE'; elapsedPercent: number; retracementPrice: number };

const DURATION_MS = 5 * 60_000;
const WAIT = (reason: string, elapsedPercent = 0): OneHalfResult => ({ signal: 'NONE', reason, elapsedPercent });

export function evaluateOneHalfM5(
  previous: ClosedM5Candle,
  current: FormingM5Candle,
  settings: OneHalfSettings,
): OneHalfResult {
  if (!previous?.sourceConfirmed || !current?.sourceConfirmed) return WAIT('Sursă de cotații neconfirmată');
  if (!previous.pair.trim() || current.pair !== previous.pair) return WAIT('Pereche valutară diferită');
  if (!Number.isFinite(settings?.priceTickSize) || settings.priceTickSize <= 0)
    return WAIT('Pasul minim al cotatiei (tick) nu este verificat pentru pereche');
  if (![previous.startMs,previous.endMs,previous.open,previous.close,current.startMs,current.open].every(Number.isFinite)
      || Math.min(previous.open,previous.close,current.open) <= 0
      || previous.endMs - previous.startMs !== DURATION_MS
      || previous.endMs !== current.startMs)
    return WAIT('Lumânarea 1 nu este închisă exact înainte de lumânarea M5 curentă');

  const direction: Direction | null = previous.close > previous.open ? 'BUY' : previous.close < previous.open ? 'SELL' : null;
  if (!direction) return WAIT('Prima lumânare este neutră');
  const samples = current.samples;
  if (!Array.isArray(samples) || samples.length < 4) return WAIT('Observații LIVE insuficiente');
  for (let i = 0; i < samples.length; i++) {
    const s = samples[i];
    if (!Number.isFinite(s.timestampMs) || !Number.isFinite(s.price) || s.price <= 0 ||
        s.timestampMs < current.startMs || s.timestampMs >= current.startMs + DURATION_MS ||
        (i > 0 && s.timestampMs <= samples[i-1].timestampMs)) return WAIT('Date LIVE invalide sau neordonate');
  }
  const latest = samples[samples.length - 1];
  const elapsedPercent = (latest.timestampMs - current.startMs) / DURATION_MS * 100;
  if (elapsedPercent < 50) return WAIT('Aștept 50% din lumânarea a doua', elapsedPercent);
  if (direction === 'BUY' && latest.price <= current.open) return WAIT('Lumânarea 2 nu este verde', elapsedPercent);
  if (direction === 'SELL' && latest.price >= current.open) return WAIT('Lumânarea 2 nu este roșie', elapsedPercent);

  // Symbolic retracement: at least ONE verified price tick in the opposite direction.
  // Verify actual price order: favorable move -> adverse pullback -> partial recovery.
  // The latest price must remain shy of the earlier favorable extreme to avoid chasing it.
  let maximumRetreat = 0;
  for (let i = 0; i < samples.length - 2; i++) {
    const peakOrTrough = samples[i].price;
    for (let j = i + 1; j < samples.length - 1; j++) {
      const dipOrBounce = samples[j].price;
      if (direction === 'BUY') {
        const retreat = peakOrTrough - dipOrBounce;
        if (retreat + settings.priceTickSize * 1e-7 >= settings.priceTickSize && latest.price > dipOrBounce && latest.price < peakOrTrough)
          maximumRetreat = Math.max(maximumRetreat, retreat);
      } else {
        const retreat = dipOrBounce - peakOrTrough;
        if (retreat + settings.priceTickSize * 1e-7 >= settings.priceTickSize && latest.price < dipOrBounce && latest.price > peakOrTrough)
          maximumRetreat = Math.max(maximumRetreat, retreat);
      }
    }
  }
  if (!maximumRetreat) return WAIT('Retragerea și revenirea nu sunt confirmate', elapsedPercent);
  return { signal: direction, reason: 'ONE_HALF_M5_RETRACE', elapsedPercent, retracementPrice: maximumRetreat };
}

/** One alert maximum per current candle and pair. Never calls a broker. */
export class OneHalfM5Session {
  private emitted = new Set<string>();
  observe(previous: ClosedM5Candle, current: FormingM5Candle, settings: OneHalfSettings): OneHalfResult {
    const key = `${current.pair}|${current.startMs}`;
    if (this.emitted.has(key)) return WAIT('Semnal deja emis pentru această lumânare');
    const result = evaluateOneHalfM5(previous, current, settings);
    if (result.signal !== 'NONE') this.emitted.add(key);
    return result;
  }
  reset(): void { this.emitted.clear(); }
}
