/**
 * Experimental M5 DEMO signal bridge. Accepts confirmed OHLC metadata and
 * verified intrabar tick observations from a future approved data adapter.
 * Does not connect to a broker, place trades, sound a bip, or use Bluetooth.
 */
import { OneHalfM5Session, type ClosedM5Candle, type OneHalfResult, type PriceSample } from './oneHalfCandleM5.ts';

const M5_MS = 300_000;
const MAX_QUOTE_DELAY_MS = 5_000;

export type M5LiveTick = {
  pair: string;
  timeframeMinutes: number;
  candleStartMs: number;
  candleOpen: number;
  timestampMs: number;
  receivedAtMs: number;
  price: number;
  sourceConfirmed: boolean;
};
export type M5FeedUpdate = {
  pair: string;
  signal: 'NONE' | 'BUY' | 'SELL';
  reason: string;
  elapsedPercent: number;
  observations: number;
  /** Always true. A feed signal is not permission to execute an order. */
  simulationOnly: true;
};

export class OneHalfM5LiveFeed {
  private previous: ClosedM5Candle | null = null;
  private tickSize = 0;
  private candleOpen = 0;
  private samples: PriceSample[] = [];
  private session = new OneHalfM5Session();
  // Keep deduplication even if the screen rotates away and then returns.
  private emitted = new Set<string>();

  /** Re-arm after each pair change, only from an independently confirmed closed M5 candle. */
  arm(previous: ClosedM5Candle, priceTickSize: number): boolean {
    this.previous = null;
    this.samples = [];
    this.candleOpen = 0;
    this.tickSize = 0;
    if (!previous || !previous.sourceConfirmed || !previous.pair?.trim() ||
        !Number.isFinite(priceTickSize) || priceTickSize <= 0 ||
        ![previous.startMs, previous.endMs, previous.open, previous.close].every(Number.isFinite) ||
        Math.min(previous.open, previous.close) <= 0 ||
        previous.endMs - previous.startMs !== M5_MS ||
        previous.endMs % M5_MS !== 0) return false;
    this.previous = previous;
    this.tickSize = priceTickSize;
    return true;
  }

  /** Clear the active feed on a lost stream or account/timeframe change. */
  disarm(): void {
    this.previous = null;
    this.tickSize = 0;
    this.samples = [];
    this.candleOpen = 0;
  }

  /** A return value is an observation/alert ONLY; no trading commands exist here. */
  push(tick: M5LiveTick): M5FeedUpdate {
    const response = (signal: M5FeedUpdate['signal'], reason: string, elapsedPercent = 0): M5FeedUpdate => ({
      pair: typeof tick?.pair === 'string' ? tick.pair : '',
      signal, reason, elapsedPercent, observations: this.samples.length, simulationOnly: true,
    });
    if (!this.previous) return response('NONE', 'Aștept lumânare M5 închisă și confirmată');
    if (!tick || !tick.sourceConfirmed || tick.timeframeMinutes !== 5 || tick.pair !== this.previous.pair) {
      this.disarm();
      return response('NONE', 'Pereche, timeframe sau sursă schimbată: sesiune resetată');
    }
    if (![tick.timestampMs,tick.receivedAtMs,tick.candleStartMs,tick.candleOpen,tick.price].every(Number.isFinite) ||
        tick.price <= 0 || tick.candleOpen <= 0 ||
        tick.receivedAtMs < tick.timestampMs || tick.receivedAtMs - tick.timestampMs > MAX_QUOTE_DELAY_MS) {
      return response('NONE', 'Cotație invalidă ori întârziată');
    }
    if (tick.candleStartMs !== this.previous.endMs ||
        tick.timestampMs < tick.candleStartMs || tick.timestampMs >= tick.candleStartMs + M5_MS) {
      this.disarm();
      return response('NONE', 'Lumânarea a doua nu este consecutivă: rearmare necesară');
    }
    if (this.samples.length && (tick.timestampMs <= this.samples[this.samples.length - 1].timestampMs ||
        Math.abs(tick.candleOpen - this.candleOpen) > this.tickSize * 1e-7)) {
      return response('NONE', 'Cotație duplicată sau deschidere M5 schimbată');
    }
    if (!this.samples.length) this.candleOpen = tick.candleOpen;
    this.samples.push({ timestampMs: tick.timestampMs, price: tick.price });
    const key = `${tick.pair}|${tick.candleStartMs}`;
    if (this.emitted.has(key)) return response('NONE', 'Semnal deja emis pentru această lumânare');
    const result: OneHalfResult = this.session.observe(this.previous, {
      pair: tick.pair,
      startMs: tick.candleStartMs,
      open: this.candleOpen,
      samples: this.samples,
      sourceConfirmed: true,
    }, { priceTickSize: this.tickSize });
    if (result.signal === 'NONE') return response('NONE', result.reason, result.elapsedPercent);
    this.emitted.add(key);
    return response(result.signal, '1,5 lumânări M5 cu retragere simbolică', result.elapsedPercent);
  }
}
