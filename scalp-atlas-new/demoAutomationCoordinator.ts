/**
 * Demo-only, broker-neutral execution guard. Does not use Android Accessibility,
 * click any app, place actual orders, or bypass a broker's approved API.
 */
import { AutoDemoEngine, type DemoTrade } from './autoDemoEngine.ts';
import { submitLiveSignalToDemo, type LiveAnalysisEvent } from './liveDemoBridge.ts';

export type DemoOrderRequest = Readonly<{
  market: string; direction: 'BUY' | 'SELL';
  expiryMs: number; idempotencyKey: string;
}>;
export interface AuthorizedBrokerDemoAdapter {
  readonly brokerId: string;
  isDemoAccount(): Promise<boolean>;
  /** Integrator must use a broker-authorized endpoint, verify DEMO again, and honor idempotency. */
  placeDemoOrder(request: DemoOrderRequest): Promise<{ confirmed: boolean; brokerOrderId?: string }>;
}
export type AutomationResult =
  | { status: 'BLOCKED'; reason: string }
  | { status: 'PAPER_ONLY'; simulated: DemoTrade }
  | { status: 'DEMO_CONFIRMED'; simulated: DemoTrade; brokerOrderId: string }
  | { status: 'DEMO_UNCONFIRMED'; simulated: DemoTrade; reason: string };

export class DemoAutomationCoordinator {
  private readonly engine: AutoDemoEngine;
  private armed = false;
  private stopped = false;
  private mode: 'PAPER' | 'BROKER_DEMO' = 'PAPER';
  private adapter: AuthorizedBrokerDemoAdapter | null = null;
  private demoOrderCount = 0;
  private readonly maxDemoOrders = 3;
  private inFlight = false;
  constructor(now: () => number = Date.now) { this.engine = new AutoDemoEngine(now); }
  configure(mode: 'PAPER' | 'BROKER_DEMO', adapter: AuthorizedBrokerDemoAdapter | null = null) {
    this.mode = mode; this.adapter = adapter; this.armed = false;
    this.stopped = false; this.demoOrderCount = 0;
  }
  arm(): void { if (!this.stopped) this.armed = true; }
  emergencyStop(): void { this.armed = false; this.stopped = true; }
  getHistory(): DemoTrade[] { return this.engine.getHistory(); }
  async onVerifiedAnalysis(event: LiveAnalysisEvent, brokerId: string): Promise<AutomationResult> {
    if (this.stopped || !this.armed) return { status: 'BLOCKED', reason: 'NOT_ARMED' };
    if (this.inFlight) return { status: 'BLOCKED', reason: 'ORDER_PENDING' };
    if (this.mode === 'BROKER_DEMO') {
      if (!this.adapter || this.adapter.brokerId !== brokerId)
        return { status: 'BLOCKED', reason: 'AUTHORIZED_ADAPTER_REQUIRED' };
      if (this.demoOrderCount >= this.maxDemoOrders)
        return { status: 'BLOCKED', reason: 'DEMO_SESSION_LIMIT' };
    }
    this.inFlight = true;
    try {
      if (this.mode === 'BROKER_DEMO') {
        const inDemo = await this.adapter!.isDemoAccount().catch(() => false);
        if (this.stopped || !this.armed || !inDemo)
          return { status: 'BLOCKED', reason: 'DEMO_ACCOUNT_NOT_VERIFIED' };
      }
      const decision = submitLiveSignalToDemo(this.engine, event);
      if (!decision.accepted) return { status: 'BLOCKED', reason: decision.reason };
      const simulated = decision.trade;
      if (this.mode === 'PAPER') return { status: 'PAPER_ONLY', simulated };
      if (this.stopped || !this.armed)
        return { status: 'DEMO_UNCONFIRMED', simulated, reason: 'EMERGENCY_STOP' };
      this.demoOrderCount += 1; // counts ATTEMPTS, never blindly retries ambiguous orders
      try {
        const result = await this.adapter!.placeDemoOrder({
          market: simulated.market, direction: simulated.direction,
          expiryMs: simulated.expiresAt - simulated.openedAt,
          idempotencyKey: `${brokerId}:${simulated.market}:${simulated.openedAt}`,
        });
        if (result.confirmed && result.brokerOrderId)
          return { status: 'DEMO_CONFIRMED', simulated, brokerOrderId: result.brokerOrderId };
        return { status: 'DEMO_UNCONFIRMED', simulated, reason: 'BROKER_DID_NOT_CONFIRM' };
      } catch {
        return { status: 'DEMO_UNCONFIRMED', simulated, reason: 'BROKER_REQUEST_FAILED' };
      }
    } finally { this.inFlight = false; }
  }
}
