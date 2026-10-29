import test from 'node:test';
import assert from 'node:assert/strict';
import { AutoDemoSession } from '../scalp-atlas-new/autoDemoSession.ts';

test('AUTO DEMO session opens and settles virtual trade from verified quotes', () => {
  let now = 1_000_000;
  const session = new AutoDemoSession(() => now);
  const signal = { market: 'EUR/USD', timeframe: 'M5', signal: 'BUY', state: 'SIGNAL', probability: 85, observedAt: now, price: 1.1, chartValid: true };
  const opened = session.onLiveAnalysis(signal);
  assert.equal(opened.decision.accepted, true);
  assert.equal(session.getHistory().length, 1);
  now += 300_001;
  const settled = session.onVerifiedQuote('EUR/USD', 1.2);
  assert.equal(settled.length, 1);
  assert.equal(settled[0].result, 'WIN');
  assert.equal(session.onVerifiedQuote('EUR/USD', 1.3).length, 0);
});
test('no paper order when quote is missing', () => {
  const session = new AutoDemoSession(() => 1_000_000);
  const result = session.onLiveAnalysis({ market: 'EUR/USD', timeframe: 'M10', signal: 'SELL', state: 'SIGNAL', probability: 99, observedAt: 1_000_000, price: null, chartValid: true });
  assert.equal(result.decision.accepted, false);
  assert.equal(session.getHistory().length, 0);
});
