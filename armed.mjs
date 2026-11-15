import { detectShock } from './shock.mjs';

export function createArmedRobot({ maxSignalAgeMs = 3500 } = {}) {
  let live = false;
  let pending = null;
  const lastEntryByPair = new Map();

  return {
    setLive(enabled) {
      live = enabled === true;
    },

    evaluate({ account, pair, previous, current, now, tradeActive }) {
      if (!live) return { status: 'OPRIT' };
      if (account !== 'QT Demo') return { status: 'CONT DEMO NECONFIRMAT' };
      if (tradeActive) return { status: 'TRANZACȚIE ACTIVĂ · PAUZĂ' };
      if (pending) return { status: 'ARMAT · ORDIN ÎN VERIFICARE' };
      const waiting = { status: 'ARMAT · AȘTEPT ȘOC' };
      if (!pair || !Number.isSafeInteger(now)) return waiting;
      const signal = detectShock(previous, current);
      if (!signal || now < signal.confirmedAt ||
          now - signal.confirmedAt > maxSignalAgeMs ||
          now >= signal.candleStart + 300000 ||
          signal.candleStart <= (lastEntryByPair.get(pair) ?? -Infinity)) return waiting;

      lastEntryByPair.set(pair, signal.candleStart);
      pending = { ...signal, pair, token: Symbol(pair), expiryMinutes: 5 };
      return { status: 'ARMAT · TRIMIT ORDIN DEMO', order: { ...pending } };
    },

    // Only call with a verified broker outcome for the corresponding attempt.
    settle({ token, account, status }) {
      if (!pending || token !== pending.token || account !== 'QT Demo' ||
          !['CLOSED_CONFIRMED', 'REJECTED_CONFIRMED'].includes(status)) return false;
      pending = null;
      return true;
    },
  };
}
