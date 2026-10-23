# Scalp Atlas — SHOCK LIVE specification (DEMO)

## Scope
Detect sharp pullback and initial rebound within the **current open candle**, without waiting for candle close or historical chart extrema. Timeframe auto-detected. Do not tie alerts to trade expiry. Preserve existing audio asset. No automatic order placement.

## Required input
Timestamped live price updates (ticks or frequent sampled quotes), candle open/high/low/current price and detected timeframe. A static screenshot cannot establish the sequence of intrabar price changes.

## Candidate BUY
1. Within current candle, observe a local upward move followed by a rapid downward pullback from the running intrabar high.
2. Pullback amplitude and speed must exceed configurable thresholds calibrated on recent price volatility and sampling rate (not a fixed universal pip amount).
3. After the local low, observe a measurable upward rebound sustained over multiple successive price updates; trigger BUY alert immediately after confirmation, without candle close.

## Candidate SELL
Mirror BUY: downward move, sharp rebound upward from running intrabar low, then measurable downward rejection over successive updates.

## State machine
OBSERVE -> PULLBACK_CANDIDATE -> REBOUND_CONFIRMATION -> ALERTED -> COOLDOWN -> OBSERVE.
Reset on new candle; one alert per candle/shock event. Reject stale quotes, missing data, low sampling frequency and conflicting BUY/SELL candidates. Show WAIT when uncertain. Avoid alerting based on price merely reaching an apparent low/high: it is only recognizable retrospectively.

## Validation before live use
Record symbol, timeframe, quote timestamps, direction, alert time, observed pullback amplitude, rebound amplitude, latency and forward outcomes at 5/10/15 minutes. Use replay and forward DEMO tests, including missed signals and false positives. No claim of guaranteed reversal, win rate or profitable expiry. Binary options/OTC are high risk.

## Integration checklist
- Locate actual Android app source and chart capture / price-stream adapter.
- Verify data update rate sufficient for intrabar detection.
- Implement detector and preserve existing original beep, one beep per signal.
- Add deterministic synthetic tick-sequence tests for BUY, SELL, noise, continued fall/rise, duplicates, and candle boundaries.
- Compile Android APK via CI and validate on device before distribution.

Status: specification only; not yet connected to runtime, compiled or tested.
