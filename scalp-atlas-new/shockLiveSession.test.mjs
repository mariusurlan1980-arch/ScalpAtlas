import test from 'node:test';
import assert from 'node:assert/strict';
import { ShockLiveSession } from './shockLiveSession.ts';

const base = 1_700_000_100_000;
const make = (timestampMs, price, timeframeMinutes = 5) => ({ timestampMs, price, timeframeMinutes });

test('BUY triggers once, then waits until the next candle', () => {
  const session = new ShockLiveSession();
  const start = Math.floor(base / 300_000) * 300_000;
  const prices = [100, 99.6, 99.8, 100.05, 100.1];
  const results = prices.map((p, i) => session.push(make(start + 1000 + i * 1000, p)));
  assert.equal(results[3].signal, 'BUY');
  assert.equal(results[4].signal, 'NONE');
});

test('Timeframe change resets the candle sample buffer', () => {
  const session = new ShockLiveSession();
  session.push(make(base, 100));
  session.push(make(base + 1000, 99.6));
  const result = session.push(make(base + 2000, 100, 10));
  assert.equal(result.observations, 1);
  assert.equal(result.timeframeMinutes, 10);
  assert.equal(result.signal, 'NONE');
});

test('Reject duplicate timestamps without appending data', () => {
  const session = new ShockLiveSession();
  session.push(make(base, 100));
  const result = session.push(make(base, 99.6));
  assert.equal(result.observations, 1);
  assert.equal(result.signal, 'NONE');
});

test('New candle resets alert state', () => {
  const session = new ShockLiveSession();
  const start = Math.floor(base / 300_000) * 300_000;
  [100, 99.6, 99.8, 100.05].forEach((p, i) => session.push(make(start + 1000 + i * 1000, p)));
  const result = session.push(make(start + 300_000 + 1000, 100));
  assert.equal(result.signal, 'NONE');
  assert.equal(result.observations, 1);
});
