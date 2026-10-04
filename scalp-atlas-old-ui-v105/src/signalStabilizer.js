import { SIGNAL } from './liveEngine.js';

const TF_MINUTES = Object.freeze({ M1: 1, M2: 2, M3: 3, M5: 5, M10: 10, M15: 15, M30: 30, H1: 60 });

function minutesFromExpiry(expiry, timeframe) {
  if (timeframe === 'M10') return 10;
  const parsed = Number.parseInt(String(expiry || '').match(/\d+/)?.[0] || '', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : (TF_MINUTES[timeframe] || 10);
}

export function createSignalStabilizer({ confirmations = 3, minimumConfirmationMs = 20_000 } = {}) {
  let candidate = null;
  let candidateCount = 0;
  let candidateSince = 0;
  let locked = null;
  let lockedUntil = 0;

  function resetCandidate() {
    candidate = null;
    candidateCount = 0;
    candidateSince = 0;
  }

  return {
    process(raw, now = Date.now()) {
      if (locked && now < lockedUntil) {
        const remainingSeconds = Math.max(1, Math.ceil((lockedUntil - now) / 1000));
        return {
          ...locked,
          locked: true,
          shouldBeep: false,
          remainingSeconds,
          confirmationCount: confirmations,
          confirmationTarget: confirmations,
          statusText: `SEMNAL ${locked.signal} ACTIV · ${Math.ceil(remainingSeconds / 60)} MIN RĂMASE`,
        };
      }

      if (locked) {
        locked = null;
        lockedUntil = 0;
        resetCandidate();
        return {
          ...raw,
          signal: SIGNAL.WAIT,
          probability: 0,
          expiry: '—',
          directionDuration: '—',
          shouldBeep: false,
          fingerprint: `REANALYZE:${raw.timeframe}:${now}`,
          confirmationCount: 0,
          confirmationTarget: confirmations,
          statusText: 'EXPIRARE ÎNCHEIATĂ · REANALIZEZ',
        };
      }

      if (raw.signal !== SIGNAL.BUY && raw.signal !== SIGNAL.SELL) {
        resetCandidate();
        return {
          ...raw,
          shouldBeep: false,
          confirmationCount: 0,
          confirmationTarget: confirmations,
          statusText: raw.chartDetected ? SIGNAL.WAIT : 'GRAFIC NEDETECTAT',
        };
      }

      if (candidate === raw.signal) {
        candidateCount += 1;
      } else {
        candidate = raw.signal;
        candidateCount = 1;
        candidateSince = now;
      }

      const stableForMs = Math.max(0, now - candidateSince);
      if (candidateCount < confirmations || stableForMs < minimumConfirmationMs) {
        return {
          ...raw,
          signal: SIGNAL.WAIT,
          expiry: '—',
          directionDuration: '—',
          shouldBeep: false,
          fingerprint: `CONFIRM:${candidate}:${candidateCount}:${raw.timeframe}`,
          confirmationCount: candidateCount,
          confirmationTarget: confirmations,
          statusText: `CONFIRMARE ${candidate} · ${Math.min(candidateCount, confirmations)}/${confirmations}`,
        };
      }

      const lockMinutes = minutesFromExpiry(raw.expiry, raw.timeframe);
      lockedUntil = now + lockMinutes * 60_000;
      locked = {
        ...raw,
        fingerprint: `CONFIRMED:${raw.signal}:${raw.timeframe}:${now}`,
        confirmedAt: now,
        lockMinutes,
      };
      resetCandidate();

      return {
        ...locked,
        locked: true,
        shouldBeep: true,
        remainingSeconds: lockMinutes * 60,
        confirmationCount: confirmations,
        confirmationTarget: confirmations,
        statusText: `${raw.signal} CONFIRMAT · BLOCAT ${lockMinutes} MIN`,
      };
    },

    reset() {
      resetCandidate();
      locked = null;
      lockedUntil = 0;
    },
  };
}
