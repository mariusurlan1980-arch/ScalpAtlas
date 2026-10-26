import { ShockOnlyDetector, type ShockObservation } from './shockOnlyDetector';

function buy(ts: number, close: number, candleId = 'BUY-A', overrides: Partial<ShockObservation> = {}): ShockObservation {
  return {
    candleId, timestampMs: ts, open: 100, high: Math.max(110, close),
    low: Math.min(99, close), close, timeframeMinutes: 10, sourceConfirmed: true,
    trendConfirmed: true, trendDirection: 'BUY', ...overrides,
  };
}

const fast = new ShockOnlyDetector();
const states: string[] = [];
let buySignal = null;
for (const point of [
  buy(0, 110), buy(1000, 109), buy(2000, 105), buy(3000, 100.5),
  buy(4000, 102), buy(5000, 106.5), buy(6000, 108),
]) {
  const signal = fast.observe(point);
  states.push(`${fast.getStatus().phase}:${fast.getStatus().shockDepthPercent}`);
  if (signal) buySignal = signal;
}
if (!buySignal || buySignal.direction !== 'BUY' ||
    buySignal.shockDepthPercent !== 95 || buySignal.shockDurationMs !== 3000 ||
    buySignal.expiryMinutes !== 5) {
  throw new Error('BUY rapid nu a fost detectat');
}
if (fast.observe(buy(7000, 109))) throw new Error('A doua alertă în aceeași lumânare');

const slow = new ShockOnlyDetector();
for (let t = 0; t <= 15000; t += 1000) {
  if (slow.observe(buy(t, 110 - (9.5 * t / 15000), 'SLOW'))) {
    throw new Error('Mișcare lentă clasificată ca șoc');
  }
}

const untrusted = new ShockOnlyDetector();
for (let t = 0; t < 5; t++) {
  if (untrusted.observe(buy(t * 1000, 110 - t, 'UNTRUSTED', { sourceConfirmed: false }))) {
    throw new Error('Semnal pe cotații neverificate');
  }
}
if (untrusted.getStatus().phase !== 'INVALID') {
  throw new Error('Date invalide acceptate');
}

function sell(ts: number, close: number): ShockObservation {
  return {
    candleId: 'SELL-A', timestampMs: ts, open: 100, high: Math.max(101, close),
    low: Math.min(90, close), close, timeframeMinutes: 10, sourceConfirmed: true,
    trendConfirmed: true, trendDirection: 'SELL',
  };
}
const detectorSell = new ShockOnlyDetector();
let sellSignal = null;
for (const point of [
  sell(0, 90), sell(1000, 91), sell(2000, 95), sell(3000, 99.5),
  sell(4000, 98), sell(5000, 94.5), sell(6000, 92),
]) {
  const signal = detectorSell.observe(point);
  if (signal) sellSignal = signal;
}
if (!sellSignal || sellSignal.direction !== 'SELL' || sellSignal.shockDurationMs !== 3000) {
  throw new Error('SELL rapid nu a fost detectat');
}
console.log('ScalpAtlas ȘOC DEMO: teste BUY, SELL, lent, date neverificate și BIP unic — OK');
