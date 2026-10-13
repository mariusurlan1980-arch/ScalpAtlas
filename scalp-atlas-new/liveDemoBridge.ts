import { AutoDemoEngine, type DemoDecision, type Direction, type Timeframe } from './autoDemoEngine';

/** Bridge for verified LIVE analysis events. Never touches Pocket Option or other broker apps. */
export type LiveAnalysisEvent = {
  market: string | null;
  timeframe: string | null;
  signal: string | null;
  state: string | null;
  probability: number | null; // percentage 0–100 from analysis engine
  observedAt: number;
  price: number | null; // verified quote from authorized source, never OCR guess
  chartValid: boolean;
};
export type BridgeResult = DemoDecision | { accepted: false; reason: string };

const VALID_TIMEFRAMES: ReadonlyArray<string> = ['M5', 'M10', 'M15'];
export function submitLiveSignalToDemo(
  engine: AutoDemoEngine,
  event: LiveAnalysisEvent,
): BridgeResult {
  if (event.state !== 'SIGNAL' || !event.chartValid)
    return { accepted: false, reason: 'NO_CONFIRMED_SIGNAL' };
  if (event.signal !== 'BUY' && event.signal !== 'SELL')
    return { accepted: false, reason: 'INVALID_DIRECTION' };
  if (!event.timeframe || !VALID_TIMEFRAMES.includes(event.timeframe))
    return { accepted: false, reason: 'UNSUPPORTED_TIMEFRAME' };
  if (!event.market || !Number.isFinite(event.price) || event.price === null || event.price <= 0)
    return { accepted: false, reason: 'VERIFIED_PRICE_REQUIRED' };
  if (event.probability === null || !Number.isFinite(event.probability))
    return { accepted: false, reason: 'INVALID_PROBABILITY' };
  return engine.evaluate({
    market: event.market,
    timeframe: event.timeframe as Timeframe,
    direction: event.signal as Direction,
    confidence: event.probability / 100,
    observedAt: event.observedAt,
    price: event.price,
    validChart: event.chartValid,
  });
}
