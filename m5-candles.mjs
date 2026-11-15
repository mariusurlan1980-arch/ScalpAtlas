const M5_MS = 300_000;

// Require a sample close to the boundary before treating it as the open.
// Chart prices alone cannot reconstruct candles from before LIVE started.
export function createM5Candles({ maxGapMs = 1500 } = {}) {
  let pair = null;
  let previous;
  let current;
  let lastTime = null;

  function reset() {
    pair = previous = current = lastTime = null;
  }

  return function observe(frame) {
    const { account, activePair, timeframe, price, time } = frame ?? {};
    if (account !== 'QT Demo' || !activePair || timeframe !== 'M5' ||
        !Number.isFinite(price) || price <= 0 || !Number.isSafeInteger(time) || time < 0) {
      reset();
      return null;
    }
    if (pair !== activePair || (lastTime !== null && time - lastTime > maxGapMs)) reset();
    if (lastTime !== null && time <= lastTime) return null;
    pair = activePair;

    const start = time - time % M5_MS;
    if (!current || start !== current.start) {
      previous = current?.start === start - M5_MS
        ? { start: current.start, open: current.open, close: current.close, closed: true }
        : null;
      const history = frame.previous;
      if (history?.closed === true && history.start === start - M5_MS &&
          [history.open, history.close].every(value => Number.isFinite(value) && value > 0)) {
        previous = { start: history.start, open: history.open, close: history.close, closed: true };
      }
      const live = frame.current;
      const open = live?.start === start && Number.isFinite(live.open) && live.open > 0
        ? live.open
        : time - start <= maxGapMs ? price : null;
      current = open === null ? null : { start, open, close: price, samples: [] };
    }
    lastTime = time;
    if (!current) return null;

    current.close = price;
    current.samples.push({ time, price });
    return previous ? {
      previous: { ...previous },
      current: { ...current, samples: current.samples.slice() },
    } : null;
  };
}
