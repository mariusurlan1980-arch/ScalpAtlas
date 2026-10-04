import assert from 'node:assert/strict';
import { SIGNAL } from '../src/liveEngine.js';
import { createSignalStabilizer } from '../src/signalStabilizer.js';

const engine = createSignalStabilizer({ confirmations: 3, minimumConfirmationMs: 20_000 });
const buy = { signal: SIGNAL.BUY, probability: 84, expiry: '10 minute', directionDuration: '10–20 minute', timeframe: 'M10', chartDetected: true, pattern: 'Test BUY', fingerprint: 'raw-buy' };
const sell = { ...buy, signal: SIGNAL.SELL, probability: 91, pattern: 'Test SELL', fingerprint: 'raw-sell' };

const c1 = engine.process(buy, 0);
const c2 = engine.process(buy, 10_000);
const c3 = engine.process(buy, 20_000);

assert.equal(c1.signal, SIGNAL.WAIT);
assert.equal(c1.shouldBeep, false);
assert.equal(c2.signal, SIGNAL.WAIT);
assert.equal(c2.shouldBeep, false);
assert.equal(c3.signal, SIGNAL.BUY);
assert.equal(c3.shouldBeep, true);
assert.equal(c3.lockMinutes, 10);

const sameAgain = engine.process(buy, 30_000);
assert.equal(sameAgain.signal, SIGNAL.BUY);
assert.equal(sameAgain.shouldBeep, false);
assert.equal(sameAgain.fingerprint, c3.fingerprint);

const opposite = engine.process(sell, 40_000);
assert.equal(opposite.signal, SIGNAL.BUY);
assert.equal(opposite.shouldBeep, false);
assert.equal(opposite.fingerprint, c3.fingerprint);

const nearExpiry = engine.process(sell, 619_999);
assert.equal(nearExpiry.signal, SIGNAL.BUY);
assert.equal(nearExpiry.shouldBeep, false);

const expired = engine.process(sell, 620_001);
assert.equal(expired.signal, SIGNAL.WAIT);
assert.equal(expired.shouldBeep, false);
assert.match(expired.statusText, /REANALIZEZ/);

assert.equal(engine.process(sell, 630_000).signal, SIGNAL.WAIT);
assert.equal(engine.process(sell, 640_000).signal, SIGNAL.WAIT);
const sellConfirmed = engine.process(sell, 650_000);
assert.equal(sellConfirmed.signal, SIGNAL.SELL);
assert.equal(sellConfirmed.shouldBeep, true);

console.log('M10 signal coherence: 3 confirmations, one-shot beep flag, 10-minute lock passed');
