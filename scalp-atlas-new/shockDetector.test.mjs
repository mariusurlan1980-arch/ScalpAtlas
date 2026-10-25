import test from 'node:test';
import assert from 'node:assert/strict';
import { detectCandleShock } from './shockDetector.ts';

const start = 1_700_000_000_000;
const duration = 300_000;
const samples = (...prices) => prices.map((price, i) => ({ timestampMs: start + i * 10_000, price }));

test('BUY: rapid dip and recovery in one forming candle', () => {
  const result = detectCandleShock(samples(100, 99.6, 99.8, 100.05), start, duration);
  assert.equal(result.signal, 'BUY');
});

test('SELL: rapid spike and pullback in one forming candle', () => {
  const result = detectCandleShock(samples(100, 100.4, 100.2, 99.95), start, duration);
  assert.equal(result.signal, 'SELL');
});

test('No shock means no signal', () => {
  assert.equal(detectCandleShock(samples(100, 100.01, 100.02, 100.03), start, duration).signal, 'NONE');
});

test('Reject observations from two candles', () => {
  const input = samples(100, 99.6, 99.8, 100.05);
  input[3].timestampMs = start + duration;
  assert.equal(detectCandleShock(input, start, duration).signal, 'NONE');
});

test('Reject stale or unordered observations', () => {
  const input = samples(100, 99.6, 99.8, 100.05);
  input[2].timestampMs = input[1].timestampMs;
  assert.equal(detectCandleShock(input, start, duration).signal, 'NONE');
});

test('Reject ambiguous spikes in both directions', () => {
  assert.equal(detectCandleShock(samples(100, 99.5, 100.5, 100), start, duration).signal, 'NONE');
});
