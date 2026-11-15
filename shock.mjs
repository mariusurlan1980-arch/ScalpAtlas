// Evaluate one instrument. Times are Unix milliseconds and samples are ordered.
const M5 = 300_000;

export function detectShock(previous, current, { depth = 0.35, rebound = 0.25, maxDropMs = 5000 } = {}) {
  if (!previous?.closed || !Number.isSafeInteger(previous.start) ||
      previous.start % M5 !== 0 || current?.start !== previous.start + M5 ||
      ![previous.open, previous.close, current.open].every(Number.isFinite) ||
      !Array.isArray(current.samples)) return null;

  const body = Math.abs(previous.close - previous.open);
  const direction = Math.sign(previous.close - previous.open);
  if (!direction) return null;

  let extreme = 0;
  let lastTime = current.start - 1;
  let dropStart = null;
  let dropTime = null;
  let price = current.open;
  for (const sample of current.samples) {
    if (!sample || !Number.isSafeInteger(sample.time) || sample.time <= lastTime ||
        sample.time < current.start || sample.time >= current.start + M5 ||
        !Number.isFinite(sample.price)) return null;
    lastTime = sample.time;
    price = sample.price;
    const pullback = direction * (current.open - price);
    if (pullback <= 0 && dropTime === null) {
      extreme = 0;
      dropStart = null;
    } else if (pullback > extreme) {
      dropStart ??= sample.time;
      extreme = pullback;
      if (dropTime === null && extreme >= depth * body &&
          sample.time - dropStart <= maxDropMs) dropTime = sample.time;
    }
  }

  const move = direction * (price - current.open);
  if (dropTime === null || lastTime <= dropTime || move <= 0 ||
      extreme + move < rebound * body) return null;

  return { side: direction > 0 ? 'BUY' : 'SELL', candleStart: current.start, confirmedAt: lastTime };
}
