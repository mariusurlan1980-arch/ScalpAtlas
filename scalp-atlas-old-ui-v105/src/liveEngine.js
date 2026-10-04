export const SIGNAL = Object.freeze({
  BUY: 'BUY',
  SELL: 'SELL',
  WAIT: 'AȘTEAPTĂ CONFIRMARE',
});

// Adapter fail-closed. Until the validated pattern engine supplies metrics,
// LIVE never invents a BUY or SELL signal.
export function evaluateLiveFrame(frame, timeframe) {
  const metrics = frame?.metrics;
  const chartDetected = metrics?.chartDetected ?? Boolean(metrics?.validatedPattern);
  if (!chartDetected) {
    return {
      signal: SIGNAL.WAIT,
      pattern: 'Grafic nedetectat',
      probability: 0,
      expiry: '—',
      directionDuration: '—',
      timeframe,
      chartDetected: false,
      chartStatus: 'GRAFIC NEDETECTAT',
      liveMarker: null,
      fingerprint: `NO_CHART:${timeframe}`,
    };
  }

  if (!metrics?.validatedPattern) {
    return {
      signal: SIGNAL.WAIT,
      pattern: 'Nicio structură validată',
      probability: 0,
      expiry: '—',
      directionDuration: '—',
      timeframe,
      chartDetected: true,
      chartStatus: 'GRAFIC DETECTAT',
      liveMarker: metrics.liveMarker || null,
      fingerprint: `WAIT:${timeframe}`,
    };
  }

  const probability = Math.max(0, Math.min(100, metrics.probability || 0));
  const direction = metrics.direction === SIGNAL.BUY || metrics.direction === SIGNAL.SELL
    ? metrics.direction
    : SIGNAL.WAIT;
  const signal = probability >= 80 ? direction : SIGNAL.WAIT;

  return {
    signal,
    pattern: metrics.patternName || 'Structură neidentificată',
    probability,
    expiry: signal === SIGNAL.WAIT ? '—' : (metrics.expiry || '10 minute'),
    directionDuration: signal === SIGNAL.WAIT ? '—' : (metrics.directionDuration || '—'),
    timeframe,
    chartDetected: true,
    chartStatus: 'GRAFIC DETECTAT',
    liveMarker: metrics.liveMarker || null,
    fingerprint: `${signal}:${metrics.patternName || 'none'}:${timeframe}`,
  };
}
