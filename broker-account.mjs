import { createM5Candles } from './m5-candles.mjs';

// The Android adapter supplies labels from the active broker's account tile.
// Each label contains the visible node text or its accessibility description.
export function readBrokerAccount(labels) {
  if (!Array.isArray(labels)) return 'UNKNOWN';

  let demo = false;
  let real = false;
  for (const label of labels) {
    if (typeof label !== 'string') continue;
    const text = label.normalize('NFKC').replace(/[\u200b-\u200d\ufeff]/g, '').trim();
    if (/\bQT\s*Real\b/i.test(text)) real = true;
    if (/^QT\s*Demo(?:\s+[A-Z]{3})?$/i.test(text)) demo = true;
  }
  if (real) return demo ? 'UNKNOWN' : 'QT Real';
  return demo ? 'QT Demo' : 'UNKNOWN';
}

export function createBrokerAdapter(nativeBroker) {
  const observePrice = createM5Candles();
  return {
    pollSavedOrderStatus() {
      return nativeBroker.pollOrderStatus();
    },

    async readFrame() {
      const activeBefore = await nativeBroker.readActiveChartPair();
      const { accountLabels, activePair: framePair, timeframe, ...frame } =
        await nativeBroker.readForegroundFrame();
      const account = readBrokerAccount(accountLabels);
      const chart = account === 'QT Demo' && timeframe === 'M5' && activeBefore === framePair
        ? await nativeBroker.readM5Chart()
        : null;
      const activeAfter = account === 'QT Demo' ? await nativeBroker.readActiveChartPair() : null;
      const activePair = activeBefore && activeBefore === activeAfter && activeAfter === framePair
        ? activeAfter : null;
      const verifiedChart = activePair !== null && chart?.activePair === activePair;

      const candles = observePrice({
        account, activePair, timeframe,
        price: verifiedChart ? chart.price : undefined,
        time: verifiedChart ? chart.time : undefined,
        previous: verifiedChart ? {
          start: chart.previousStart, open: chart.previousOpen, close: chart.previousClose, closed: true,
        } : undefined,
        current: verifiedChart ? { start: chart.currentStart, open: chart.currentOpen } : undefined,
      });
      return {
        ...frame,
        account,
        activePair,
        previous: candles?.previous,
        current: candles?.current,
      };
    },

    // The native implementation must recheck the account and target when
    // performing the gesture so a stale frame cannot authorize it.
    selectVerifiedDemoPair(pair, activePair) {
      return nativeBroker.selectPairOnVerifiedDemo(pair, activePair);
    },

    submitVerifiedDemoOrder({ attemptId, pair, side, expiryMinutes, confirmedAt }) {
      return nativeBroker.submitOrderOnVerifiedDemo({ attemptId, pair, side, expiryMinutes, confirmedAt });
    },

    readOrder({ attemptId, pair, side, confirmedAt }) {
      return nativeBroker.readVerifiedDemoReceipt({ attemptId, pair, side, confirmedAt });
    },
  };
}
