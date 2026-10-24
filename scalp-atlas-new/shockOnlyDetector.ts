/** Scalp Atlas SHOCK ONLY candidate engine. Requires time-series OHLC from the SAME forming candle.
 * A static screenshot cannot establish the order of wick formation and recovery.
 * DEMO only until measured forward testing. No profit guarantee.
 */
export type ShockDirection = 'BUY' | 'SELL';
export type ShockObservation = {
  candleId: string; timestampMs: number; open: number; high: number; low: number;
  close: number; timeframeMinutes: 5 | 10 | 15; sourceConfirmed: boolean;
};
export type ShockSignal = { direction: ShockDirection; candleId: string; expiryMinutes: 10; reason: 'SHOCK_RECOVERY' };
export type ShockSettings = { minimumRangeFraction: number; recoveryFraction: number; minAgeMs: number };
export const DEFAULT_SHOCK_SETTINGS: ShockSettings = {
  minimumRangeFraction: 0.001, recoveryFraction: 0.60, minAgeMs: 2000
};
export class ShockOnlyDetector {
  private previous: ShockObservation | null = null;
  private lowFirst = false;
  private highFirst = false;
  private emitted = new Set<string>();
  private candleFirstSeenAt = 0;
  constructor(private settings: ShockSettings = DEFAULT_SHOCK_SETTINGS) {}
  observe(o: ShockObservation): ShockSignal | null {
    if (!o.sourceConfirmed || !Number.isFinite(o.close) || o.close <= 0 ||
        ![o.open,o.high,o.low].every(Number.isFinite) ||
        o.high < Math.max(o.open,o.close) || o.low > Math.min(o.open,o.close) ||
        o.high <= o.low) return null;
    const p = this.previous;
    if (!p || p.candleId !== o.candleId) {
      this.previous = o;
      this.candleFirstSeenAt = o.timestampMs;
      this.lowFirst = false; this.highFirst = false;
      return null;
    }
    if (o.timestampMs <= p.timestampMs || o.high < p.high || o.low > p.low) return null;
    const threshold = o.close * this.settings.minimumRangeFraction;
    const range = o.high - o.low;
    // Must actually observe a new extreme before its reversal; no retrospective wick signal.
    if (o.low < p.low && o.close <= o.open) this.lowFirst = true;
    if (o.high > p.high && o.close >= o.open) this.highFirst = true;
    const age = o.timestampMs - this.candleFirstSeenAt;
    this.previous = o;
    if (range < threshold || age < this.settings.minAgeMs || this.emitted.has(o.candleId)) return null;
    const buy = this.lowFirst && o.close > o.open && (o.close-o.low)/range >= this.settings.recoveryFraction;
    const sell = this.highFirst && o.close < o.open && (o.high-o.close)/range >= this.settings.recoveryFraction;
    if (buy === sell) return null;
    this.emitted.add(o.candleId);
    return {direction:buy?'BUY':'SELL',candleId:o.candleId,expiryMinutes:10,reason:'SHOCK_RECOVERY'};
  }
  reset() { this.previous=null; this.candleFirstSeenAt=0; this.lowFirst=false; this.highFirst=false; this.emitted.clear(); }
}
