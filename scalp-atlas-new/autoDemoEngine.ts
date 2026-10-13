/**
 * SCALP ATLAS — isolated AUTO DEMO simulator.
 * Does not interact with a broker, click external apps or place real orders.
 * UI and existing analysis engine remain unchanged.
 */
export type Direction = 'BUY' | 'SELL';
export type Timeframe = 'M5' | 'M10' | 'M15';
export type DemoSignal = {
  market: string;
  direction: Direction;
  timeframe: Timeframe;
  confidence: number;
  observedAt: number;
  price: number;
  validChart: boolean;
};
export type DemoTrade = {
  market: string;
  direction: Direction;
  openedAt: number;
  expiresAt: number;
  entryPrice: number;
  exitPrice?: number;
  result?: 'WIN' | 'LOSS' | 'DRAW';
};
export type DemoDecision = { accepted: true; trade: DemoTrade } | { accepted: false; reason: string };
const MIN_CONFIDENCE = 0.75;
const MAX_SIGNAL_AGE_MS = 15_000;
const EXPIRY_MS: Record<Timeframe, number> = { M5: 300_000, M10: 600_000, M15: 900_000 };

export class AutoDemoEngine {
  private trades: DemoTrade[] = [];
  private lastDirection = new Map<string, { direction: Direction; time: number }>();
  private readonly now: () => number;
  constructor(now: () => number = Date.now) { this.now = now; }
  getHistory(): DemoTrade[] { return this.trades.map(t => ({ ...t })); }
  evaluate(signal: DemoSignal): DemoDecision {
    const now = this.now();
    if (!signal.validChart) return { accepted: false, reason: 'CHART_INVALID' };
    if (!signal.market.trim() || !Number.isFinite(signal.price) || signal.price <= 0)
      return { accepted: false, reason: 'PRICE_OR_MARKET_INVALID' };
    if (!Number.isFinite(signal.confidence) || signal.confidence < MIN_CONFIDENCE)
      return { accepted: false, reason: 'LOW_CONFIDENCE' };
    if (!Number.isFinite(signal.observedAt) || signal.observedAt > now ||
        now - signal.observedAt > MAX_SIGNAL_AGE_MS)
      return { accepted: false, reason: 'STALE_SIGNAL' };
    const key = signal.market + ':' + signal.timeframe;
    const previous = this.lastDirection.get(key);
    if (previous && now - previous.time < EXPIRY_MS[signal.timeframe])
      return { accepted: false, reason: previous.direction === signal.direction ? 'COOLDOWN' : 'REVERSAL_LOCK' };
    const trade: DemoTrade = {
      market: signal.market, direction: signal.direction, openedAt: now,
      expiresAt: now + EXPIRY_MS[signal.timeframe], entryPrice: signal.price,
    };
    this.trades.push(trade);
    this.lastDirection.set(key, { direction: signal.direction, time: now });
    return { accepted: true, trade: { ...trade } };
  }
  settle(market: string, price: number): DemoTrade[] {
    if (!Number.isFinite(price) || price <= 0) return [];
    const now = this.now();
    const settled: DemoTrade[] = [];
    for (const trade of this.trades) {
      if (trade.market !== market || trade.result || now < trade.expiresAt) continue;
      trade.exitPrice = price;
      const delta = (price - trade.entryPrice) * (trade.direction === 'BUY' ? 1 : -1);
      trade.result = delta > 0 ? 'WIN' : delta < 0 ? 'LOSS' : 'DRAW';
      settled.push({ ...trade });
    }
    return settled;
  }
}
