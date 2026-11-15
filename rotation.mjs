export const MINIMUM_PAIRS = 10;
const MINIMUM_PAYOUT = 92;
const OBSERVATION_MS = 30_000;

// Candidates come from the broker's FX list. The caller confirms each chart
// change before starting the observation timer.
export function createFxRotation() {
  const visited = new Set();
  let requestedPair = null;
  let observedPair = null;
  let observedSince = null;

  return function update({ account, candidates, activePair, now, orderPending, tradeActive }) {
    if (tradeActive || orderPending) {
      requestedPair = observedPair = observedSince = null;
      return { action: 'WAIT_FOR_CLOSE' };
    }

    if (account !== 'QT Demo' || !Number.isSafeInteger(now)) {
      requestedPair = observedPair = observedSince = null;
      return { action: 'WAIT_FOR_DEMO' };
    }

    const eligible = [...new Set(candidates
      .filter(({ pair, payout }) =>
        typeof pair === 'string' &&
        /^[A-Z]{3}\/[A-Z]{3}(?: OTC)?$/.test(pair) &&
        Number.isFinite(payout) && payout >= MINIMUM_PAYOUT)
      .map(({ pair }) => pair))];
    const eligibleCount = eligible.length;
    const availability = { eligibleCount, missingPairs: Math.max(0, MINIMUM_PAIRS - eligibleCount) };

    if (requestedPair && !eligible.includes(requestedPair)) requestedPair = null;
    if (requestedPair && activePair !== requestedPair) {
      return { action: 'SELECT_PAIR', pair: requestedPair, ...availability };
    }
    if (requestedPair === activePair) requestedPair = null;

    if (eligible.includes(activePair) && !visited.has(activePair)) {
      if (observedPair !== activePair || now < observedSince) {
        observedPair = activePair;
        observedSince = now;
      }
      const remainingMs = OBSERVATION_MS - (now - observedSince);
      if (remainingMs > 0) return { action: 'OBSERVE', pair: activePair, remainingMs, ...availability };
      visited.add(activePair);
    }
    observedPair = observedSince = null;

    if (!eligibleCount) return { action: 'WAIT_FOR_PAIRS', ...availability };
    let nextPair = eligible.find(pair => !visited.has(pair));
    if (!nextPair) {
      visited.clear();
      nextPair = eligible.find(pair => pair !== activePair) ?? eligible[0];
    }
    if (nextPair === activePair) {
      observedPair = activePair;
      observedSince = now;
      return { action: 'OBSERVE', pair: activePair, remainingMs: OBSERVATION_MS, ...availability };
    }
    requestedPair = nextPair;
    return { action: 'SELECT_PAIR', pair: nextPair, ...availability };
  };
}
