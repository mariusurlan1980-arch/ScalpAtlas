import { detectCandleShock, type ShockDirection, type ShockSample } from './shockDetector';

export type ShockFrame = {
  timeframeMinutes: 5 | 10 | 15;
  timestampMs: number;
  price: number;
};

export type ShockUpdate = {
  signal: ShockDirection;
  reason: string;
  timeframeMinutes: number;
  candleStartMs: number;
  observations: number;
};

/**
 * Receives real, timestamped price samples from a future approved screen
 * capture/market-data adapter. Does not read screens or infer prices itself.
 * One alert maximum per candle; no trade execution.
 */
export class ShockLiveSession {
  private samples: ShockSample[] = [];
  private candleStartMs = -1;
  private timeframeMinutes = 0;
  private alerted = false;

  reset() {
    this.samples = [];
    this.candleStartMs = -1;
    this.timeframeMinutes = 0;
    this.alerted = false;
  }

  push(frame: ShockFrame): ShockUpdate {
    const { timeframeMinutes: tf, timestampMs, price } = frame;
    if (![5, 10, 15].includes(tf) || !Number.isFinite(timestampMs) ||
        !Number.isFinite(price) || price <= 0) {
      return this.update('NONE', 'Date LIVE invalide');
    }
    const durationMs = tf * 60_000;
    const start = Math.floor(timestampMs / durationMs) * durationMs;
    if (this.candleStartMs !== start || this.timeframeMinutes !== tf) {
      this.samples = [];
      this.alerted = false;
      this.candleStartMs = start;
      this.timeframeMinutes = tf;
    }
    const previous = this.samples[this.samples.length - 1];
    if (previous && timestampMs <= previous.timestampMs)
      return this.update('NONE', 'Observație duplicată sau întârziată');

    this.samples.push({ timestampMs, price });
    if (this.alerted) return this.update('NONE', 'Semnal deja emis pentru lumânarea curentă');
    const result = detectCandleShock(this.samples, start, durationMs);
    if (result.signal !== 'NONE') this.alerted = true;
    return this.update(result.signal, result.reason);
  }

  private update(signal: ShockDirection, reason: string): ShockUpdate {
    return {
      signal, reason,
      timeframeMinutes: this.timeframeMinutes,
      candleStartMs: this.candleStartMs,
      observations: this.samples.length,
    };
  }
}
