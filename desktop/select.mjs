export function confirmedShock(result) {
  const direction = result.signal;
  const trend = result.trendVisualPoints?.length === 3 && result.trendMeasured;
  const counterTrend = trend && ['BUY', 'SELL'].includes(result.trendDirection)
    && result.trendDirection !== direction;
  const sellException = direction === 'SELL' && result.trendDirection === 'BUY'
    && result.sellPullbackValidated && result.sellPullbackPeakGuard
    && result.sellPullbackDirection === 'SELL' && result.sellPullbackTravelPx >= 6
    && result.sellPullbackTravelPct >= 35;
  return ['BUY', 'SELL'].includes(direction) && result.strategy === 'SHOCK'
    && result.quality >= 55 && result.candleDetected && result.opticalQuality > 0
    && result.observedCandleDirection === direction && result.shockDirection === direction
    && result.shockOpticalVerified && result.shockSameCandle
    && result.shockRetraced && result.shockRecovered && result.frameId === result.shockFrameId
    && result.shockRetracementPercent > 30 && result.shockRecoveryPercent >= 20
    && result.shockWickPercent >= 1
    && result.shockDropDurationMs >= 300 && result.shockDropDurationMs <= 18_000
    && (!counterTrend || sellException);
}

export function selectChart(charts, now) {
  return charts.filter(({ result, capturedAt }) => result
    && now - capturedAt >= 0 && now - capturedAt <= 1500 && confirmedShock(result))
    .sort((a, b) => b.result.shockRetracementPercent - a.result.shockRetracementPercent
      || b.result.shockRecoveryPercent - a.result.shockRecoveryPercent
      || b.capturedAt - a.capturedAt)[0];
}
