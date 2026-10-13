import { AutoDemoEngine, type DemoTrade } from './autoDemoEngine';
import { submitLiveSignalToDemo, type LiveAnalysisEvent, type BridgeResult } from './liveDemoBridge';

/**
 * In-app paper-trading coordinator.
 * Receives verified analysis/quotes from the host app. Never places broker orders.
 * Each market quote settles expired simulated positions before evaluating a new signal.
 */
export class AutoDemoSession {
  private readonly engine: AutoDemoEngine;
  constructor(now: () => number = Date.now) {
    this.engine = new AutoDemoEngine(now);
  }

  onVerifiedQuote(market: string, price: number): DemoTrade[] {
    if (!market.trim() || !Number.isFinite(price) || price <= 0) return [];
    return this.engine.settle(market, price);
  }

  onLiveAnalysis(event: LiveAnalysisEvent): {
    decision: BridgeResult;
    settled: DemoTrade[];
  } {
    const settled = event.market && event.price !== null
      ? this.onVerifiedQuote(event.market, event.price)
      : [];
    const decision = submitLiveSignalToDemo(this.engine, event);
    return { decision, settled };
  }

  getHistory(): DemoTrade[] {
    return this.engine.getHistory();
  }
}
