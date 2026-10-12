# SCALP ATLAS LIVE: real prices, not screenshot scans

**Status: research core implemented, Android LIVE integration NOT connected yet.**
This branch preserves the original 1.0.59 APK, UI, CAMERA LIVE, and overlay unchanged.

The existing Android overlay is a LIVE **screen capture** loop. It sees dynamic images but
does NOT have direct market quotes or reliable closed-candle timestamps. Calling it
“LIVE” does not make the source live OHLC.

A different architecture requires an **authorized, read-only real-time price feed**:
1. Confirm feed provider access and whether ticks for `venue=otc` match prices visible
   on the **same Pocket Option OTC instrument** at the **same timestamp**.
2. Confirm entitlement to stream (not just fetch snapshots) and calibrate provider's
   clock. OTCharts documents broker candle timestamps offset from UTC by two hours.
   Treat the live tick clock separately and verify before applying any offset.
3. User obtains a third-party API credential privately via that vendor. NEVER paste a
   Pocket Option account password, SSID, browser cookie, or token into ChatGPT.
   The research core does not hold credentials. No provider-specific API is installed.
4. The Android client subscribes to a permitted tick stream, validates symbol/clock/
   feed age/continuity, aggregates OHLC, and never emits sound on stale/gapped data.
5. The trading strategy must be backtested on actual matching OTC data and then tested
   separately on DEMO with logged entry/expiry/settlement quotes before any trust
   in direction could be claimed. The historical experiments are distinct from live
   trading; predictive performance currently UNKNOWN.

`liveDataEngine.js` is a dependency-free collector (read-only). It accepts legitimate
tick event shapes `{symbol,price,time}` from an external adapter and emits numeric
complete OHLC only after a new bar begins. `createSseDecoder` can parse a streaming
server-sent events feed, **but is not an HTTP client**. The Android transport is NOT
implemented on this branch. It does not submit orders, generate BUY/SELL, pretend
confidence scores, beep, or read the phone screen.

Prototype source option only: https://otcharts.com/pocket-option-api
— NOT a Pocket Option official or independently validated API; their own pages report
changing/inconsistent free-tier and stream entitlements. Do not pay before checking the
current plan and verifying matching raw quotes. Other regulated or licensed sources
can be swapped in, but ordinary interbank Forex quotes are not equivalent to Pocket
Option OTC broker-generated prices.

Run local validation:
`node --test scalp-atlas-new/liveDataEngine.test.js`

Release criteria: provider eligibility established, authenticated READ-ONLY quotes
demonstrated, source vs Pocket Option matching and latency measured, timestamp
calibration documented, source outage behavior tested, 300 out-of-sample historical
situations and 200 logged demo signals reviewed; no BUY/SELL without verification.
