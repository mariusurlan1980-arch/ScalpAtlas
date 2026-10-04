import assert from 'node:assert/strict';
import { evaluateLiveFrame, SIGNAL } from '../src/liveEngine.js';

const wait = evaluateLiveFrame(null, 'M5');
assert.equal(wait.signal, SIGNAL.WAIT);
assert.equal(wait.directionDuration, '—');

const noChart = evaluateLiveFrame({ metrics: { chartDetected: false, validatedPattern: false } }, 'M5');
assert.equal(noChart.signal, SIGNAL.WAIT);
assert.equal(noChart.chartDetected, false);
assert.equal(noChart.pattern, 'Grafic nedetectat');

const chartWait = evaluateLiveFrame({ metrics: { chartDetected: true, validatedPattern: false } }, 'M5');
assert.equal(chartWait.signal, SIGNAL.WAIT);
assert.equal(chartWait.chartDetected, true);
assert.equal(chartWait.pattern, 'Nicio structură validată');

const weak = evaluateLiveFrame({ metrics: { validatedPattern: true, direction: SIGNAL.BUY, patternName: 'Canal Ascendent', probability: 69, expiry: '5 minute', directionDuration: '5–10 minute' } }, 'M5');
assert.equal(weak.signal, SIGNAL.WAIT);
assert.equal(weak.directionDuration, '—');

const buy = evaluateLiveFrame({ metrics: { chartDetected: true, validatedPattern: true, direction: SIGNAL.BUY, patternName: 'Dublu Minim', probability: 82, expiry: '5 minute', directionDuration: '6–12 minute' } }, 'M5');
assert.equal(buy.signal, SIGNAL.BUY);
assert.equal(buy.pattern, 'Dublu Minim');
assert.equal(buy.directionDuration, '6–12 minute');

const sell = evaluateLiveFrame({ metrics: { chartDetected: true, validatedPattern: true, direction: SIGNAL.SELL, patternName: 'Breakout Suport', probability: 88, expiry: '10 minute', directionDuration: '12–24 minute' } }, 'M10');
assert.equal(sell.signal, SIGNAL.SELL);

const borderline = evaluateLiveFrame({ metrics: { chartDetected: true, validatedPattern: true, direction: SIGNAL.SELL, patternName: 'Slab', probability: 79 } }, 'M10');
assert.equal(borderline.signal, SIGNAL.WAIT);
assert.equal(sell.directionDuration, '12–24 minute');

console.log('LIVE engine: BUY / SELL / WAIT + direction duration tests passed');
