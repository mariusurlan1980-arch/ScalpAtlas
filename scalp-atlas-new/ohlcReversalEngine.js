'use strict';

// Experimental research engine. This reads completed OHLC candles only.
// It does NOT consume screenshot estimates or emit calibrated probabilities.
const LOOKBACK = 12;
const MIN_CANDLES = LOOKBACK + 3;

function evaluateReversal({ candles, symbol, timeframeMinutes = 10 }) {
  if (!Array.isArray(candles) || !Number.isInteger(timeframeMinutes) || timeframeMinutes < 5 || !symbol) {
    return wait('INVALID_INPUT');
  }
  // The caller MUST explicitly mark finalized candles. Never assume that a
  // snapshot of the currently-forming candle is a completed observation.
  const closed = candles.filter(c => c && c.complete === true);
  if (candles.some(c => !c || (c.complete !== true && c.complete !== false)) ||
      candles.filter(c => c && c.complete === false).length > 1 ||
      (candles.at(-1)?.complete === true && candles.some(c => c?.complete === false)) ||
      closed.length < MIN_CANDLES) {
    return wait('NOT_ENOUGH_CLOSED_CANDLES');
  }
  const seq = closed.slice(-MIN_CANDLES);
  const ms = timeframeMinutes * 60_000;
  for (let i = 0; i < seq.length; i++) {
    const c = seq[i];
    if (!Number.isSafeInteger(c.time) || ![c.open, c.high, c.low, c.close].every(Number.isFinite) ||
        c.low <= 0 || c.low > Math.min(c.open, c.close) ||
        c.high < Math.max(c.open, c.close) || c.high < c.low ||
        (i > 0 && c.time - seq[i - 1].time !== ms)) return wait('INVALID_OR_GAPPED_OHLC');
  }
  const history = seq.slice(0, LOOKBACK);
  const pin = seq[LOOKBACK], first = seq[LOOKBACK + 1], second = seq[LOOKBACK + 2];
  const range = pin.high - pin.low;
  if (range <= 0) return wait('NO_SETUP');
  const body = Math.abs(pin.close - pin.open);
  const upper = pin.high - Math.max(pin.open, pin.close);
  const lower = Math.min(pin.open, pin.close) - pin.low;
  const ranges = history.map(c => c.high - c.low).sort((a, b) => a - b);
  const medianRange = (ranges[5] + ranges[6]) / 2;
  if (medianRange <= 0 || range < medianRange * .75 || range > medianRange * 6) return wait('NO_SETUP');
  const support = Math.min(...history.map(c => c.low));
  const resistance = Math.max(...history.map(c => c.high));
  const nearSupport = pin.low <= support + medianRange * .15;
  const nearResistance = pin.high >= resistance - medianRange * .15;
  const longLowerWick = lower / range >= .52 && lower >= body * 2;
  const longUpperWick = upper / range >= .52 && upper >= body * 2;
  // Two completed candles of the SAME color must confirm the opposite move.
  // This expressly rejects a BUY candidate while the latest candle is red.
  const bullishPair = first.close > first.open && second.close > second.open &&
    second.close > first.close && first.close > pin.close &&
    first.low >= pin.low && second.low >= pin.low;
  const bearishPair = first.close < first.open && second.close < second.open &&
    second.close < first.close && first.close < pin.close &&
    first.high <= pin.high && second.high <= pin.high;
  const buy = nearSupport && longLowerWick && bullishPair;
  const sell = nearResistance && longUpperWick && bearishPair;
  if (buy === sell) return wait('NO_CONFIRMED_REVERSAL');
  const side = buy ? 'BUY' : 'SELL';
  return {
    state: 'SIGNAL', side, symbol, timeframeMinutes,
    confirmedAt: second.time + ms, // signal exists only AFTER the second candle closes
    signalId: [symbol, timeframeMinutes, second.time, side].join('|'),
    pattern: buy ? 'LOWER_WICK_TWO_GREEN' : 'UPPER_WICK_TWO_RED',
    evaluationHorizonMinutes: timeframeMinutes,
    probability: null, // deliberately unavailable until out-of-sample calibration
    dataSource: 'OHLC_CLOSED',
  };
}

function wait(reason) { return { state: 'WAIT', side: null, reason, probability: null }; }

// Evaluation-only: enter at the NEXT candle's open, settle at that candle's
// close (one timeframe). No look-ahead, no stake sizing, no live order routing.
function backtestReversals({ candles, symbol, timeframeMinutes = 10, minSpacingCandles = 3 }) {
  if (!Array.isArray(candles)) throw new TypeError('candles must be an array');
  const cases = [];
  let lastEntry = -Infinity;
  for (let i = MIN_CANDLES - 1; i < candles.length - 1; i++) {
    if (i - lastEntry < minSpacingCandles) continue;
    const seen = candles.slice(0, i + 1);
    if (seen.some(c => c?.complete !== true)) continue;
    const result = evaluateReversal({ candles: seen, symbol, timeframeMinutes });
    if (result.state !== 'SIGNAL') continue;
    const entry = candles[i + 1];
    if (!entry || entry.complete !== true || !Number.isFinite(entry.open) ||
        !Number.isFinite(entry.close) || entry.time - candles[i].time !== timeframeMinutes * 60_000) continue;
    const delta = entry.close - entry.open;
    const outcome = delta === 0 ? 'TIE' : (delta > 0) === (result.side === 'BUY') ? 'WIN' : 'LOSS';
    cases.push({ id: result.signalId, side: result.side, entryTime: entry.time,
      entryPrice: entry.open, exitPrice: entry.close, outcome });
    lastEntry = i;
  }
  const wins = cases.filter(c => c.outcome === 'WIN').length;
  const ties = cases.filter(c => c.outcome === 'TIE').length;
  return { total: cases.length, wins, losses: cases.length - wins - ties, ties,
    conservativeWinRate: cases.length ? wins / cases.length : null,
    readyForReview: cases.length >= 300,
    cases };
}

module.exports = { evaluateReversal, backtestReversals, MIN_CANDLES };
