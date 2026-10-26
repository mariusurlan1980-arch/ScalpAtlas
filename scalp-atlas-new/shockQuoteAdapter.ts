/**
 * ScalpAtlas OHLC adapter. This does NOT fetch quotes or bypass broker restrictions.
 * It only accepts already-authorized, timestamped and verified price observations.
 * A screenshot, OCR reading, or fabricated moving candle must NEVER set sourceConfirmed.
 */
import {
  ShockOnlyDetector,
  type ShockDirection,
  type ShockObservation,
  type ShockSignal,
  type ShockStatus,
} from './shockOnlyDetector';

export type QuoteTick = {
  marketId: string;
  timestampMs: number;
  price: number;
  timeframeMinutes: 5 | 10 | 15;
  sourceConfirmed: boolean;
};
export type QuoteUpdate = {
  observation: ShockObservation | null;
  status: ShockStatus;
  signal: ShockSignal | null;
  sourceReady: boolean;
  reason: string;
};
type Candle = { id: string; start: number; open: number; high: number; low: number; close: number; firstAt: number; lastAt: number };
const MAX_EDGE_GAP_MS = 2000;

export class ShockQuoteAdapter {
  private detector = new ShockOnlyDetector();
  private market: string | null = null;
  private tf: 5 | 10 | 15 | null = null;
  private candle: Candle | null = null;
  private previousTickMs = -1;
  private closed: Candle[] = [];

  reset(): void {
    this.market = null;
    this.tf = null;
    this.candle = null;
    this.previousTickMs = -1;
    this.closed = [];
    this.detector.reset();
  }

  private result(observation: ShockObservation | null, signal: ShockSignal | null, reason: string): QuoteUpdate {
    return {
      observation, signal, status: this.detector.getStatus(),
      sourceReady: Boolean(observation?.sourceConfirmed && observation?.trendConfirmed), reason,
    };
  }

  private trend(): ShockDirection | 'FLAT' {
    if (this.closed.length < 2) return 'FLAT';
    const [a, b] = this.closed.slice(-2);
    const first = a.close > a.open ? 'BUY' : a.close < a.open ? 'SELL' : 'FLAT';
    const second = b.close > b.open ? 'BUY' : b.close < b.open ? 'SELL' : 'FLAT';
    return first !== 'FLAT' && first === second ? first : 'FLAT';
  }

  /**
   * Seed ONLY two successive, completed 5/10/15 minute candles from the same
   * read-only provider. No seed from a forming candle or other market.
   */
  seedClosedCandles(
    marketId: string,
    tf: 5 | 10 | 15,
    bars: Array<{startMs:number;open:number;high:number;low:number;close:number}>
  ): boolean {
    if (this.market !== marketId || this.tf !== tf || !this.candle) return false;
    const width = tf * 60_000;
    const sorted = [...bars].sort((a,b)=>a.startMs-b.startMs);
    if (sorted.length < 2) return false;
    const [a,b] = sorted.slice(-2);
    const valid = (c: typeof a) =>
      [c.startMs,c.open,c.high,c.low,c.close].every(Number.isFinite) &&
      c.startMs%width===0 && c.open>0 && c.close>0 && c.low>0 &&
      c.high>=Math.max(c.open,c.close) && c.low<=Math.min(c.open,c.close);
    if (!valid(a) || !valid(b) || a.startMs + width !== b.startMs ||
        b.startMs + width !== this.candle.start) return false;
    this.closed = [a,b].map(c=>({
      id:`${marketId}:${tf}:${c.startMs}`,start:c.startMs,
      firstAt:c.startMs,lastAt:c.startMs+width-1,
      open:c.open,high:c.high,low:c.low,close:c.close,
    }));
    this.detector.reset();
    return true;
  }

  ingest(tick: QuoteTick): QuoteUpdate {
    if (!tick.sourceConfirmed || !tick.marketId || !Number.isFinite(tick.price) || tick.price <= 0 ||
        !Number.isSafeInteger(tick.timestampMs) || tick.timestampMs < 0 ||
        ![5, 10, 15].includes(tick.timeframeMinutes)) {
      this.reset();
      return this.result(null, null, 'DATE_NEVERIFICATE');
    }
    if (this.market !== tick.marketId || this.tf !== tick.timeframeMinutes) {
      this.reset();
      this.market = tick.marketId;
      this.tf = tick.timeframeMinutes;
    }
    if (tick.timestampMs === this.previousTickMs) {
      return this.result(null, null, 'TICK_ACEEASI_SECUNDA');
    }
    if (tick.timestampMs < this.previousTickMs) {
      this.reset();
      return this.result(null, null, 'TIMESTAMP_NECRONOLOGIC');
    }
    const width = tick.timeframeMinutes * 60_000;
    const start = Math.floor(tick.timestampMs / width) * width;
    if (this.candle && start < this.candle.start) {
      this.reset();
      return this.result(null, null, 'LUMANARE_IN_ORDINE_GRESITA');
    }
    if (this.candle && start !== this.candle.start) {
      // Only candle samples spanning their actual interval can verify a closed candle.
      if (start === this.candle.start + width &&
          this.candle.firstAt - this.candle.start <= MAX_EDGE_GAP_MS &&
          this.candle.start + width - this.candle.lastAt <= MAX_EDGE_GAP_MS) {
        this.closed.push(this.candle);
        this.closed = this.closed.slice(-2);
      } else {
        this.closed = [];
      }
      this.detector.reset();
      this.candle = null;
    }
    if (!this.candle) {
      this.candle = { id: `${tick.marketId}:${tick.timeframeMinutes}:${start}`, start,
        open: tick.price, high: tick.price, low: tick.price, close: tick.price,
        firstAt: tick.timestampMs, lastAt: tick.timestampMs };
    } else {
      this.candle.high = Math.max(this.candle.high, tick.price);
      this.candle.low = Math.min(this.candle.low, tick.price);
      this.candle.close = tick.price;
      this.candle.lastAt = tick.timestampMs;
    }
    this.previousTickMs = tick.timestampMs;
    const dir = this.trend();
    const c = this.candle;
    const o: ShockObservation = {
      candleId: c.id, timestampMs: tick.timestampMs, open: c.open, high: c.high, low: c.low, close: c.close,
      timeframeMinutes: tick.timeframeMinutes, sourceConfirmed: true,
      trendDirection: dir, trendConfirmed: dir !== 'FLAT',
    };
    const signal = this.detector.observe(o);
    return this.result(o, signal, dir === 'FLAT' ? 'ASTEAPTA_TRENDUL' : signal ? 'SEMNAL_DEMO' : 'MONITORIZARE');
  }
}
