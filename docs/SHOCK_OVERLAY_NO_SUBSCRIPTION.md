# SHOCK LIVE — on-device overlay, no subscription

Decision: no OTCharts, no paid live data feed. Keep the experimental `otcharts-live-feed.mjs` unused; do not ship or request API keys.

## Target experience
- Android foreground service with user-approved MediaProjection screen capture (Android consent dialog), visible persistent notification, and overlay permission; no covert screen recording.
- Detect broker chart, active instrument and timeframe automatically from screenshots; reject uncertain readings.
- Track the active candle position and motion using a calibrated chart image processing pipeline. Capture timestamps and detect frame gaps. Screenshots alone do not provide verified numeric quotes; the detector must have a dedicated visual-price adapter and conservative confidence gate before calling `ShockLivePipeline`.
- Emit at most one original BIP per confirmed candle shock; display BUY or SELL in overlay; never place orders.
- Broker-independent presentation; per-broker screen calibration and testing are required. OTC and regular Forex cannot be assumed equivalent.

## Engineering tasks
1. Build native Android MediaProjection + foreground service + overlay permission and a user-facing stop control.
2. Implement robust visual quote extraction and candle-boundary detection. Do not pass fabricated prices to the detector.
3. Feed timestamped visual observations into detector with explicit confidence and source metadata; WAIT on uncertainty.
4. Wire original alert sound, verify on Motorola, test DEMO and package APK via GitHub Actions.

## Status
This is an implementation plan, not a completed overlay or downloadable APK. The current Expo camera scanner does not yet implement MediaProjection screen capture.
