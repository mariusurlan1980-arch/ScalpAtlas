// Run with: node --experimental-strip-types --test tests/autoDemoEngine.test.mts
// Tests are intentionally dependency-free and exercise only simulated trades.
import test from 'node:test';
import assert from 'node:assert/strict';
import { AutoDemoEngine } from '../scalp-atlas-new/autoDemoEngine.ts';

test('accepts a fresh valid BUY and settles WIN after expiry', () => {
  let now = 1_000_000;
  const engine = new AutoDemoEngine(() => now);
  const result = engine.evaluate({market:'EUR/USD OTC',direction:'BUY',timeframe:'M5',confidence:0.9,observedAt:now,price:1.1,validChart:true});
  assert.equal(result.accepted, true);
  assert.equal(engine.settle('EUR/USD OTC',1.2).length, 0);
  now += 300_000;
  assert.equal(engine.settle('EUR/USD OTC',1.2)[0].result, 'WIN');
  assert.equal(engine.settle('EUR/USD OTC',1.2).length, 0);
});
test('rejects contradictory signal during cooldown', () => {
  let now = 1_000_000;
  const engine = new AutoDemoEngine(() => now);
  const base = {market:'EUR/USD OTC',timeframe:'M10' as const,confidence:0.9,observedAt:now,price:1.1,validChart:true};
  assert.equal(engine.evaluate({...base,direction:'BUY'}).accepted,true);
  now += 10_000;
  assert.deepEqual(engine.evaluate({...base,direction:'SELL',observedAt:now}),{accepted:false,reason:'REVERSAL_LOCK'});
});
test('rejects stale and invalid chart data', () => {
  const engine = new AutoDemoEngine(() => 1_000_000);
  const base = {market:'EUR/USD',direction:'BUY' as const,timeframe:'M5' as const,confidence:0.9,observedAt:1_000_000,price:1.1,validChart:true};
  assert.equal(engine.evaluate({...base,observedAt:980_000}).accepted,false);
  assert.equal(engine.evaluate({...base,validChart:false}).accepted,false);
  assert.equal(engine.evaluate({...base,confidence:0.5}).accepted,false);
});
