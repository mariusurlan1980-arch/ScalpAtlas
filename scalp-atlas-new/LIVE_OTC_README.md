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

## FREE-ONLY policy (user decision 2026-10-12)

- Subscription budget is strictly **USD 0**. NO paid plan, no trial requesting a credit card, no trade orders.
- Public vendor pages and indexed versions are inconsistent: current direct
  `/pricing` and `/api` pages have advertised **no free SSE streams**
  and approximately 200 free historical requests; separately crawled copies
  and the provider's Python GitHub client advertise one free live stream
  and 1,500 requests/week. **These do not establish an entitlement**.
- Trust the authenticated response from `GET /v1/usage` for this particular
  free account: `books` includes `otc`, `streams.limit` > 0 and there is
  an unused stream slot. Do not attempt SSE if `limit === 0`. No workaround
  or fabricated live candles if the provider refuses.
- During free access, first compare one OTC instrument's vendor OHLC with the
  same Pocket Option symbol, interval and correctly calibrated clock.
  If a quote stream is not available free, pause REAL numeric live integration.
  Do not substitute ordinary Forex or image scanning and call it Pocket Option LIVE.
- Any API key is private to the user's installation, not a chat message,
  source commit, debug log or server. Pocket Option passwords/tokens/SSID
  are NEVER inputs. A free-tier consent or OAuth-like scoped key is not provided
  by the Pocket Option broker.

## FREE LIVE PRE-FLIGHT (read-only, no account signup by assistant)

A one-shot free entitlement/clock/quote probe has been added:
`node scalp-atlas-new/freeLiveProbe.js`.
It does nothing and says `NEEDS_FREE_PROVIDER_API_KEY` when no free
provider API key has been authorized. After the user has a free account and
locally configured `OTCHARTS_API_KEY` privately, it calls free `/v1/usage`
first. It **will not** open a stream on a paid plan, a free plan reporting zero
stream slots, or any uncertain entitlement. If a free stream is granted, it
inspects 12 real numeric quotes and stops without subscribing permanently
or generating BUY/SELL/bip. A positive probe is **not evidence that the
prices exactly match Pocket Option** and cannot yet make the app usable.

CI validation: `node --test scalp-atlas-new/liveDataEngine.test.js
scalp-atlas-new/otchartsReadOnlyAdapter.test.js
scalp-atlas-new/freeLiveProbe.test.js`.

As of October 12, 2026, vendor pages contradict themselves regarding
free SSE entitlement; absent a privately authenticated key, it is impossible
to confirm the free allowance. Our status must remain **NO LIVE CONNECTION**
until a genuine permitted streaming API is independently verified.

## Verifiable FREE historical research result (2026-10-12)

We ran a reproducible read-only study on the independent publisher's
`PHCStanton/pocket-option-otc-dataset` public EURUSD_otc compressed sample:
10,000 rows (2026-03-31 21:27:23 UTC to 2026-04-01 12:23:36 UTC),
SHA-256 `e9a3e0300283f277f742166c1a299e64c8f8f2ae07f2ec6608b86ad45d5faed2`.
Source: `https://github.com/PHCStanton/pocket-option-otc-dataset`.
The source's accuracy and correspondence to the Pocket Option app have
NOT been independently verified; these are NOT LIVE quotes.

A conservative M5 two-closed-candle EMA9/21 strategy with a hypothetical
5-minute entry-to-expiry contract and 92% fixed payout returned:

- 15 complete contiguous M5 candles, 3 breaks/discontinuities;
- **0 eligible historical trades**, 0 wins, 0 losses, **UNKNOWN win rate**;
- **INSUFFICIENT SAMPLE**. No edge or profitability conclusion whatsoever.
- At a hypothetical 92% binary payout, break-even is **52.0833%** wins
  among decisive (non-tie) contracts BEFORE execution uncertainties.
  This figure is arithmetic, **not observed accuracy**.

Reproduce on GitHub Actions: workflow
`.github/workflows/research-free-historical-m5.yml`.
`node scalp-atlas-new/freeM5Backtest.js <public-sample.csv.gz>`.
Unit tests for fill timing, 5-second delay, gaps, and future-leakage prevention
passed in `.github/workflows/verify-live-otc-research.yml`.
No session scraping, no account credentials, no prices bought, no order execution.

**Resulting release decision:** DO NOT package a numeric Pocket Option LIVE APK.
The free samples do not provide a real-time source and cannot verify signal
performance. Wait for authorized, verified live price transport available at
$0; otherwise keep existing Android app explicitly labelled SCREEN ANALYSIS,
not numeric live pricing.

## Numeric price-match research gate — 2026-10-12

`quoteMatchAuditor.js` implements a conservative **numeric against numeric**
timestamp/price matching audit for one Pocket Option OTC instrument, with
independent source names, chronological quote checks, minimum 30 paired ticks
and >=120 seconds, tolerance checks, stale/missing/shifted overlap rejection,
and a hard `beepAllowed:false`, `safeForTrading:false` result **on every path**.

The benchmark reference MUST be independently obtained authorised
Pocket Option quotes, not an ordinary EUR/USD spot feed and not copied vendor
quotes. Even passing this audit cannot prove the source is really the broker:
provenance and end-to-end time alignment must be externally verified.
Unit tests deliberately simulate manipulated/mismatched/delayed quotes. The
existing Android UI, overlay and APK remain unchanged.

Provider public documentation is genuinely contradictory:
`https://otcharts.com/pricing` has advertised one SSE stream on a FREE key;
`https://otcharts.com/api` and `https://otcharts.com/llms.txt` report NO
free streaming. We cannot make a real paid/zero-cost entitlement conclusion
from those public pages. The authenticated free `GET /v1/usage` would settle
the entitlement for this account, but **no free provider account / API key is
present or verified here**. The user's Gmail support inquiry still had no
response at time of check. Do not claim numeric Pocket Option LIVE connection.

Run all current research tests: `node --test
scalp-atlas-new/liveDataEngine.test.js
scalp-atlas-new/otchartsReadOnlyAdapter.test.js
scalp-atlas-new/freeLiveProbe.test.js
scalp-atlas-new/freeM5Backtest.test.js
scalp-atlas-new/quoteMatchAuditor.test.js`.

## Source verification 2026-10-12 (public pages, not an authenticated API account)

We revisited the **currently served** provider pages:
- https://otcharts.com/pricing — Free API $0, 200 calls in initial month,
  five instruments, **NO LIVE STREAMING**, streaming starts at $15/month.
- https://otcharts.com/api — Free 200 calls/week and **0** open live streams
  in the published table.
- Older crawled versions of the pricing page and the vendor's GitHub
  otcharts-python README say **one free live stream**. These claims conflict
  with the provider's currently served site: do not promise this feature.
  Only an authenticated free `GET /v1/usage` showing `streams.limit>0`
  plus an authorized successful SSE subscription would establish access.

**Current decision:** The user's budget is strictly $0; do not buy or
recommend Lite. We cannot deliver a genuine numeric LIVE Pocket Option APK
from this source at present. Existing v1.0.59 app is still SCREEN CAPTURE /
PIXEL ANALYSIS and must not be misrepresented as a direct price feed.
The user's request explicitly excludes photographs; do not rebrand frame
sampling as direct numeric live quotes. Research code remains separate/draft.

## 2026-10-12 stream timeout safeguards

The free-tier preflight now aborts a silent SSE stream after at most 15 seconds
(default, configurable up to 45s). A stalled read is reported as
`FREE_LIVE_STREAM_TIMEOUT` and cannot become a confirmed connection, entry,
bip or order. A blank stream remains `FREE_LIVE_STREAM_EMPTY`.
The module still needs a genuinely authorized no-cost read-only API key for
the user and has no access to the user's broker password/session.

## Own numeric M5 research strategy — v0.1 (12 October 2026)

`ownLiveResearchEngine.js` now computes SCALP ATLAS' **own, locally
evaluated M5 strategy**, rather than relying on a broker's indicator:
on 32 numeric complete and consecutive candles, EMA9/21, two matching
closed candle bodies, median true-range risk, last-candle expansion,
12-bar extremum distance, and last numerical tick direction. It
**abstains** when the feed is stale (>12s), candles are missing, candles
do not align with the current tick, recent support/resistance is too near,
or the newest numerical tick contradicts direction. It never estimates
a statistically calibrated win probability.

**No numeric Pocket Option OTC LIVE feed is connected yet**, so the
new strategy produces at most `LAB_OBSERVATION_ONLY` and hard-coded
`beepAllowed:false`, `orderAllowed:false`, `suggestTrade:false`.
No changes were made to Android's installed v1.0.59 interface or overlay.

An additional research readiness check demands authenticated authorized
same-instrument broker-feed matching and at least 200 verified *settled*
Demo trades to compute payout-adjusted observed expectancy. Neither this
sample threshold nor a favorable backtest guarantees profitability, and
even a theoretical research pass does not enable beep or broker actions.
A 92% binary payout requires >52.08% wins (on decisive trades, before
other uncertainties) merely to have positive gross expectancy.
Research-only, no money risk, budget $0.
