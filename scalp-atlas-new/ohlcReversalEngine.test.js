'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { evaluateReversal, backtestReversals } = require('./ohlcReversalEngine');
const STEP = 600_000;
const base = 1_780_000_000_000;
function c(i, o, h, l, close, complete = true) {
  return { time: base + i * STEP, open: o, high: h, low: l, close, complete };
}
const history = Array.from({length: 12}, (_, i) => c(i, 100, 101, 99, 100));
const buy = [...history, c(12, 98, 99, 93, 97.8), c(13, 97.9, 99.1, 97.7, 99), c(14, 99.1, 100.1, 98.9, 100)];
const sell = [...history, c(12, 102, 107, 101, 102.2), c(13, 102.1, 102.3, 101, 101.2), c(14, 101.1, 101.2, 100, 100.1)];
test('BUY only after long lower wick and two finalized green candles', () => {
  const r = evaluateReversal({candles: buy, symbol:'EURUSD', timeframeMinutes: 10});
  assert.equal(r.side, 'BUY');
  assert.equal(r.confirmedAt, buy[14].time + STEP);
  assert.equal(r.probability, null);
});
test('SELL after long upper wick and two finalized red candles', () => {
  assert.equal(evaluateReversal({candles:sell, symbol:'EURUSD'}).side, 'SELL');
});
test('does not BUY on a red confirmation candle', () => {
  const cs = [...buy]; cs[14] = c(14, 100, 100.2, 98.8, 99.2);
  assert.equal(evaluateReversal({candles:cs, symbol:'EURUSD'}).state, 'WAIT');
});
test('does not signal from an unfinished final candle', () => {
  const cs = [...buy]; cs[14] = {...cs[14],complete:false};
  assert.equal(evaluateReversal({candles:cs, symbol:'EURUSD'}).state, 'WAIT');
});
test('does not accept missing candle or different timeframe data', () => {
  const cs = [...buy]; cs[13] = {...cs[13], time: cs[13].time+60_000};
  assert.equal(evaluateReversal({candles:cs, symbol:'EURUSD'}).state, 'WAIT');
});
test('stable deterministic signal id for identical closed bars', () => {
  const a = evaluateReversal({candles: buy, symbol:'EURUSD'});
  const b = evaluateReversal({candles: [...buy, c(15,100,101,99,100,false)],symbol:'EURUSD'});
  assert.equal(a.signalId,b.signalId);
});
test('backtest uses next candle only and does not use a future bar in signal', () => {
  const cs=[...buy, c(15, 100, 101, 99.9, 100.8)];
  const results=backtestReversals({candles:cs, symbol:'EURUSD'});
  assert.equal(results.total,1); assert.equal(results.wins,1);
  assert.equal(results.readyForReview,false);
});
test('backtest with no signals has null win rate, not 100%', () => {
  const r=backtestReversals({candles:history, symbol:'EURUSD'});
  assert.equal(r.total,0); assert.equal(r.conservativeWinRate,null);
});
