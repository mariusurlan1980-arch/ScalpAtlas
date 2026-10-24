/** Scalp Atlas SHOCK ONLY candidate engine. Requires time-series OHLC from the SAME forming candle.
 * A static screenshot cannot establish the order of wick formation and recovery.
 * This detects a SHOCK inside ONE forming candle, not a trend reversal.
 * DEMO only until measured forward testing. No profit guarantee.
 */
export type ShockDirection = 'BUY' | 'SELL';
export type ShockObservation = {
  candleId: string; marketId: string; timestampMs: number; open: number; high: number; low: number;
  close: number; timeframeMinutes: 5 | 10 | 15; sourceConfirmed: boolean;
};
export type ShockSignal = { direction: ShockDirection; candleId: string; expiryMinutes: 10; reason: 'SHOCK_RECOVERY' };
export type ShockLiveStatus = { intensityPercent: number; phase: 'OBSERVING' | 'DROPPING' | 'RISING' | 'RECOVERING_BUY' | 'RECOVERING_SELL'; signal: ShockSignal | null };
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
  private contextKey = '';
  constructor(private settings: ShockSettings = DEFAULT_SHOCK_SETTINGS) {}
  observe(o: ShockObservation): ShockSignal | null {
    return this.observeLive(o).signal;
  }
  observeLive(o: ShockObservation): ShockLiveStatus {
    const idle = (): ShockLiveStatus => ({intensityPercent:0,phase:'OBSERVING',signal:null});
    if (!o.sourceConfirmed || !Number.isFinite(o.close) || o.close <= 0 ||
        ![o.open,o.high,o.low].every(Number.isFinite) ||
        o.high < Math.max(o.open,o.close) || o.low > Math.min(o.open,o.close) ||
        o.high < o.low || !o.marketId.trim()) return idle();
    const key = `${o.marketId}|${o.timeframeMinutes}|${o.candleId}`;
    const p = this.previous;
    if (!p || this.contextKey !== key) {
      this.contextKey = key;
      this.previous = o;
      this.candleFirstSeenAt = o.timestampMs;
      this.lowFirst = false; this.highFirst = false;
      return idle();
    }
    if (o.timestampMs <= p.timestampMs || o.high < p.high || o.low > p.low || o.open !== p.open) return idle();
    const threshold = o.close * this.settings.minimumRangeFraction;
    const prevRange = p.high - p.low;
    const prevLowRecovery = prevRange > 0 ? (p.close-p.low)/prevRange : 0;
    const prevHighRecovery = prevRange > 0 ? (p.high-p.close)/prevRange : 0;
    const range = o.high - o.low;
    // Must actually observe a new extreme before its reversal; no retrospective wick signal.
    if (o.low < p.low && o.close < o.open && (o.close-o.low) <= (o.open-o.low)*0.5) this.lowFirst = true;
    if (o.high > p.high && o.close > o.open && (o.high-o.close) <= (o.high-o.open)*0.5) this.highFirst = true;
    const age = o.timestampMs - this.candleFirstSeenAt;
    this.previous = o;
    // Live percentage is a candle-recovery metric, NOT a win probability.
    const buyRecovery = range > 0 ? Math.max(0,Math.min(100,Math.round(100*(o.close-o.low)/range))) : 0;
    const sellRecovery = range > 0 ? Math.max(0,Math.min(100,Math.round(100*(o.high-o.close)/range))) : 0;
    const phase = this.lowFirst && o.close > o.open ? 'RECOVERING_BUY' :
      this.highFirst && o.close < o.open ? 'RECOVERING_SELL' :
      this.lowFirst ? 'DROPPING' : this.highFirst ? 'RISING' : 'OBSERVING';
    const intensityPercent = phase === 'RECOVERING_BUY' ? buyRecovery : phase === 'RECOVERING_SELL' ? sellRecovery : 0;
    const status: ShockLiveStatus = {intensityPercent,phase,signal:null};
    if (range < threshold || age < this.settings.minAgeMs || this.emitted.has(key)) return status;
    const buy = this.lowFirst && o.close > o.open && (o.close-o.low)/range >= this.settings.recoveryFraction && buyRecovery/100 > prevLowRecovery;
    const sell = this.highFirst && o.close < o.open && (o.high-o.close)/range >= this.settings.recoveryFraction && sellRecovery/100 > prevHighRecovery;
    if (buy === sell) return status;
    this.emitted.add(key);
    status.signal = {direction:buy?'BUY':'SELL',candleId:o.candleId,expiryMinutes:10,reason:'SHOCK_RECOVERY'};
    return status;
  }
  reset() { this.previous=null; this.contextKey=''; this.candleFirstSeenAt=0; this.lowFirst=false; this.highFirst=false; this.emitted.clear(); }
}
