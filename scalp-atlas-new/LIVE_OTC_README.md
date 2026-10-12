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

## Implementation update (2026-10-12)
`otchartsReadOnlyAdapter.js` now implements a strict read-only client for OTCharts:
`usage()`, `symbols()`, `candles()`, and SSE `stream()`.
It validates the stream's `connected` and `dropped` messages and refuses stale,
missing, invalid, wrong-symbol and unverified-clock ticks through the separate
numeric OHLC collector. This is **not** installed in the old Android APK,
not a quote-provider account connection, and not proof of provider feed accuracy.

**Current published vendor prices checked 12 October 2026:**
Free **$0**: 200 historical/API requests in the first month, **NO SSE live stream**.
Lite: **$15/month**, one SSE stream carrying up to five instruments; the vendor
can change plans. See https://otcharts.com/pricing and https://otcharts.com/api .
The provider is unofficial and must first be assessed for license, data matching,
latency and safety. No paid subscription or broker login should be made on the
user's behalf. A free-tier key may be tested privately for historical candles,
but not a real live stream under these currently published terms.

**Research unit tests:** `node --test scalp-atlas-new/liveDataEngine.test.js
scalp-atlas-new/otchartsReadOnlyAdapter.test.js`.
Never put an OTCharts key in the repository, URL, screenshots, or chat.
Use provider-owned account access and an appropriately secured local setup;
do not send any Pocket Option password, SSID or cookie.

**Next milestones before an Android LIVE APK:**
1. User independently verifies their free API entitlements via provider dashboard.
2. Compare same-symbol/clock vendor OHLC against actual Pocket Option OTC charts
   and identify time-offset / latency, without assuming the data matches.
3. If streaming access is genuinely available and expressly approved, integrate
   a protected key store and subscription state into the Android app. Show a
   persistent STOPPED/STALE/DISCONNECTED state, and never beep without validated
   complete bars. No periodic candle polling pretending to be live.
4. Run forward demo tests of 5-min trade outcomes and report win/loss/tie,
   payout-adjusted expectancy and sample-size uncertainty.

**Credentials vs user entitlements:** A validated account on Pocket Option does
not grant any entitlement to OTCharts' unrelated third-party quote API.
