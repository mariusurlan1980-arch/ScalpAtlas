# SHOCK LIVE — multi-broker quote contract

The signal detector must not depend on a single broker. A broker adapter may forward quotes only when it has an authorized and verifiable live numeric feed.

## Quote schema

```js
{
 broker: 'broker-specific-id',
 marketMode: 'FOREX' | 'OTC',
 instrument: 'EUR/USD' | 'EUR/USD OTC',
 timeframe: 'M1' | 'M5' | 'M10' | 'M15' | 'M30' | 'H1',
 candleId: 'unique active candle start time from that broker',
 price: 1.23456,
 timestamp: 1700000000000
}
```

## Integration rules

1. Each broker has its own adapter and authorization requirements. No screen-scraping, reverse-engineered private feed, or third-party Forex substitution for OTC is assumed.
2. Route only verified quotes into `ShockLivePipeline.ingest`. Unknown source or missing fields means WAIT and no audible alert.
3. Reset detector state on changes to broker, instrument, market mode or timeframe. Keep independent sessions across devices.
4. A `SIGNAL` event invokes the existing original BIP and shows BUY or SELL. Never place an order automatically.
5. Tests with synthetic quotes do not certify a broker adapter. Test live feed, gaps, instrument switches and Android sound in DEMO before release.

## Status
This file defines the interface; no broker adapter is connected to Android and no new APK is produced.
