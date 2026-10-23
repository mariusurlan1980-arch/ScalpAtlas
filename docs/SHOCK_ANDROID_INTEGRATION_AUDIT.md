# SHOCK LIVE — Android integration audit

Source inspected: `.github/templates/ScalpAtlasIntegratedLiveV100RC1.tsx` on main.

## Confirmed existing pipeline
- React Native/Expo camera captures a photo with `takePictureAsync`.
- `SCAN_INTERVAL_MS = 2000`; the timer schedules the next capture, not guaranteed 2-second price sampling.
- Screenshot/photograph is sent to an embedded analyzer via `AnalyzerBridge` and `ANALYSIS_ENGINE_HTML`.
- Existing `playConfirmedAlert('BUY'|'SELL')` invokes the original audio players.
- Existing signal handling applies multi-confirmation and M10 locking, which would delay a SHOCK alert; the new mode must bypass those gates **only when verified intrabar price data exists**.

## Blocking dependency
`ShockLiveDetector.update({candleId,price,timestamp})` needs an ordered numeric stream of prices inside the same candle. A sequence of chart photographs cannot be treated as verified quotes without reliable price-axis calibration, chart position/time mapping, and stale-data checks. Do not fabricate prices from pixel heights. Do not trigger trading alerts from unvalidated screenshots.

## Safe integration plan
1. Identify or add a legitimate quote-feed adapter (or calibrated screenshot-derived prices with explicit validation), including instrument, timeframe, candle ID, price, and timestamp.
2. On every valid sample call the isolated detector. If a new BUY/SELL event appears, route it to the existing `playConfirmedAlert` once and show SHOCK BUY/SELL. Keep all legacy confirmation gates unchanged for legacy mode.
3. When data is unavailable, stale, ambiguous, or sampling too slow, show WAIT and emit no beep.
4. Add adapter/replay tests and run Android build. Test latency and false positives on DEMO before using alerts for any decisions.

Current state: design/audit only; **no production Android integration or new APK**.
