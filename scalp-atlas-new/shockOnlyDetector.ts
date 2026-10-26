/**
 * ScalpAtlas — șoc intralumânare (prototip DEMO; nu este legat de un broker).
 * Necesită cotații OHLC ordonate cronologic din aceeași lumânare în formare,
 * un trend deja confirmat din lumânări anterioare și date proaspete.
 * 90% este retragerea raportată la CORPUL lumânării de dinaintea șocului,
 * NU procentul fitilului și NU probabilitatea de câștig.
 */
export type ShockDirection = 'BUY' | 'SELL';
export type ShockObservation = {
  candleId: string;
  timestampMs: number;
  open: number;
  high: number;
  low: number;
  close: number;
  timeframeMinutes: 5 | 10 | 15;
  sourceConfirmed: boolean;
  /** Calculat din lumânări ÎNCHISE, nu din culoarea tranzitorie. */
  trendDirection: ShockDirection | 'FLAT';
  trendConfirmed: boolean;
};
export type ShockPhase = 'INVALID' | 'WAIT' | 'SHOCK' | 'CONFIRMED';
export type ShockStatus = {
  phase: ShockPhase;
  shockDepthPercent: number;
  reboundPercent: number;
  /** Proporția FITILULUI inferior/superior real din lungimea lumânării. */
  wickPercent: number;
  direction: ShockDirection | null;
  elapsedMs: number | null;
};
export type ShockSignal = {
  direction: ShockDirection;
  candleId: string;
  expiryMinutes: 5;
  reason: 'FAST_SHOCK_RECOVERY';
  shockDepthPercent: number;
  reboundPercent: number;
  shockDurationMs: number;
};
export type ShockSettings = {
  /** Cel mult 5 secunde pentru coborâre/urcare. Opțional 10 sec. în teste. */
  maxShockMs: number;
  /** După extremă trebuie confirmată revenirea în câteva secunde. */
  maxRecoveryMs: number;
  /** Coborârea/urcarea ca parte din corpul pre-șoc. */
  minimumShockFraction: number;
  /** Mișcarea înapoi ca parte din căderea/urcarea de șoc. */
  minimumReboundFraction: number;
  /** Filtru pentru lumânări pre-șoc de dimensiune neglijabilă. */
  minimumBodyFractionOfPrice: number;
  /** Prețul de plecare trebuie să fie aproape de extremul observat. */
  maximumDistanceFromExtremeFraction: number;
  /** Nu permite inferențe de viteză din observații rare. */
  maxObservationGapMs: number;
  minimumReboundTicks: number;
};
export const DEFAULT_SHOCK_SETTINGS: ShockSettings = {
  maxShockMs: 5000,
  maxRecoveryMs: 5000,
  minimumShockFraction: 0.90,
  minimumReboundFraction: 0.40,
  minimumBodyFractionOfPrice: 0.0004,
  maximumDistanceFromExtremeFraction: 0.15,
  maxObservationGapMs: 2000,
  minimumReboundTicks: 2,
};

type Candidate = {
  direction: ShockDirection;
  startAt: number;
  detectedAt: number;
  startPrice: number;
  extremePrice: number;
  depth: number;
  bodyAtStart: number;
  reboundTicks: number;
};

const clampPct = (fraction: number): number => Math.max(0, Math.min(100, Math.round(fraction * 100)));

export class ShockOnlyDetector {
  private previous: ShockObservation | null = null;
  private samples: ShockObservation[] = [];
  private candidate: Candidate | null = null;
  private emitted = new Set<string>();
  private status: ShockStatus = this.blankStatus('WAIT');

  constructor(private settings: ShockSettings = DEFAULT_SHOCK_SETTINGS) {
    if (!(settings.minimumShockFraction > 0 && settings.minimumShockFraction <= 2 &&
          settings.minimumReboundFraction > 0 && settings.minimumReboundFraction <= 1 &&
          settings.maxShockMs > 0 && settings.maxShockMs <= 10000 &&
          settings.maxRecoveryMs > 0 && settings.maxRecoveryMs <= 10000 &&
          settings.maxObservationGapMs > 0 && settings.minimumReboundTicks >= 1)) {
      throw new Error('Configurare ȘOC invalidă');
    }
  }

  private blankStatus(phase: ShockPhase): ShockStatus {
    return { phase, shockDepthPercent: 0, reboundPercent: 0, wickPercent: 0,
      direction: null, elapsedMs: null };
  }

  getStatus(): ShockStatus { return { ...this.status }; }

  private valid(o: ShockObservation): boolean {
    return Boolean(o.candleId && o.sourceConfirmed && o.trendConfirmed &&
      (o.trendDirection === 'BUY' || o.trendDirection === 'SELL') &&
      [5, 10, 15].includes(o.timeframeMinutes) &&
      Number.isFinite(o.timestampMs) &&
      [o.open, o.high, o.low, o.close].every(x => Number.isFinite(x) && x > 0) &&
      o.high >= Math.max(o.open, o.close) && o.low <= Math.min(o.open, o.close) &&
      o.high > o.low);
  }

  private wickFraction(o: ShockObservation, dir: ShockDirection): number {
    const full = o.high - o.low;
    return dir === 'BUY' ? (Math.min(o.open, o.close) - o.low) / full
      : (o.high - Math.max(o.open, o.close)) / full;
  }

  observe(o: ShockObservation): ShockSignal | null {
    if (!this.valid(o)) {
      this.clearReadings('INVALID');
      return null;
    }
    const p = this.previous;
    if (p && o.candleId === p.candleId &&
        (o.timestampMs <= p.timestampMs || o.open !== p.open ||
          o.timeframeMinutes !== p.timeframeMinutes || o.high < p.high || o.low > p.low)) {
      this.clearReadings('INVALID');
      return null;
    }
    if (!p || o.candleId !== p.candleId || o.timestampMs - p.timestampMs > this.settings.maxObservationGapMs) {
      // Nu reconstruim un șoc dintr-un singur cadru sau dintr-un gol în flux.
      this.previous = o;
      this.samples = [o];
      this.candidate = null;
      this.status = this.blankStatus('WAIT');
      return null;
    }
    this.previous = o;
    this.samples.push(o);
    this.samples = this.samples.filter(s => o.timestampMs - s.timestampMs <= this.settings.maxShockMs);
    if (this.emitted.has(o.candleId)) {
      this.status.phase = 'CONFIRMED';
      return null;
    }

    if (this.candidate) {
      const c = this.candidate;
      const stillMatchingTrend = o.trendDirection === c.direction;
      if (!stillMatchingTrend || o.timestampMs - c.detectedAt > this.settings.maxRecoveryMs) {
        this.candidate = null;
        this.status = this.blankStatus('WAIT');
        return null;
      }
      const oldExtreme = c.extremePrice;
      const isNewExtreme = c.direction === 'BUY' ? o.close < oldExtreme : o.close > oldExtreme;
      if (isNewExtreme) {
        c.extremePrice = o.close;
        c.reboundTicks = 0;
      } else {
        const advancing = c.direction === 'BUY' ? o.close > p.close : o.close < p.close;
        c.reboundTicks = advancing ? c.reboundTicks + 1 : 0;
      }
      c.depth = Math.abs(c.startPrice - c.extremePrice);
      const rebound = c.direction === 'BUY' ? o.close - c.extremePrice : c.extremePrice - o.close;
      const reboundFraction = rebound / c.depth;
      const originalDirectionRestored = c.direction === 'BUY' ? o.close > o.open : o.close < o.open;
      this.status = {
        phase: 'SHOCK', direction: c.direction, shockDepthPercent: clampPct(c.depth / c.bodyAtStart),
        reboundPercent: clampPct(reboundFraction), wickPercent: clampPct(this.wickFraction(o, c.direction)),
        elapsedMs: o.timestampMs - c.startAt,
      };
      if (c.reboundTicks >= this.settings.minimumReboundTicks &&
          reboundFraction >= this.settings.minimumReboundFraction && originalDirectionRestored) {
        this.emitted.add(o.candleId);
        this.status.phase = 'CONFIRMED';
        return {
          direction: c.direction, candleId: o.candleId, expiryMinutes: 5,
          reason: 'FAST_SHOCK_RECOVERY', shockDepthPercent: this.status.shockDepthPercent,
          reboundPercent: this.status.reboundPercent, shockDurationMs: c.detectedAt - c.startAt,
        };
      }
      return null;
    }

    // Căutăm un moment recent cu corp mare în sensul trendului, urmat de o
    // mișcare opusă, FĂCUTĂ în cel mult maxShockMs (nu dedusă dintr-o poză).
    let strongest = 0;
    let selected: { s: ShockObservation; depth: number; body: number } | null = null;
    for (const s of this.samples) {
      if (s.timestampMs >= o.timestampMs || s.trendDirection !== o.trendDirection) continue;
      const buy = o.trendDirection === 'BUY';
      const body = buy ? s.close - s.open : s.open - s.close;
      if (body < s.open * this.settings.minimumBodyFractionOfPrice) continue;
      const distanceFromExtreme = buy ? s.high - s.close : s.close - s.low;
      if (distanceFromExtreme > body * this.settings.maximumDistanceFromExtremeFraction) continue;
      const depth = buy ? s.close - o.close : o.close - s.close;
      const fraction = Math.max(0, depth / body);
      if (fraction > strongest) {
        strongest = fraction;
        selected = { s, depth, body };
      }
    }
    this.status = {
      phase: 'WAIT', direction: o.trendDirection as ShockDirection, shockDepthPercent: clampPct(strongest),
      reboundPercent: 0, wickPercent: clampPct(this.wickFraction(o, o.trendDirection as ShockDirection)), elapsedMs: null,
    };
    if (selected && strongest >= this.settings.minimumShockFraction) {
      this.candidate = {
        direction: o.trendDirection as ShockDirection, startAt: selected.s.timestampMs, detectedAt: o.timestampMs,
        startPrice: selected.s.close, extremePrice: o.close, depth: selected.depth,
        bodyAtStart: selected.body, reboundTicks: 0,
      };
      this.status.phase = 'SHOCK';
      this.status.elapsedMs = o.timestampMs - selected.s.timestampMs;
    }
    return null;
  }

  private clearReadings(phase: ShockPhase): void {
    this.previous = null;
    this.samples = [];
    this.candidate = null;
    this.status = this.blankStatus(phase);
  }

  reset(): void {
    this.clearReadings('WAIT');
    this.emitted.clear();
  }
}
