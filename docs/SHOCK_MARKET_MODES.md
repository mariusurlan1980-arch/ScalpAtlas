# SHOCK LIVE — OTC and regular Forex

## Market modes
- `FOREX`: normal market pairs; only use verified live numeric quotes from the same broker/instrument displayed to the user.
- `OTC`: broker-specific weekend/OTC pairs; never substitute an external spot-Forex quote for a Pocket Option OTC quote.
- `AUTO`: identify mode from an explicit verified instrument identifier or broker metadata, not from day of week alone. Weekends are not proof of OTC mode.

## Safety rules
- Maintain isolated detector state by broker, market mode, instrument, timeframe and candle ID. Switching any field resets the current shock candidate.
- Do not emit BUY/SELL or play BIP unless there are fresh ordered numeric prices and a verified candle identity. Otherwise display WAIT / NO VERIFIED LIVE FEED.
- Keep the original sound asset unchanged; only invoke the existing sound callback after a validated signal.
- Use DEMO for validation; synthetic test passes are not proof of live reliability.

## Integration blocker
The existing camera/OCR screenshot pipeline does not establish a sufficiently accurate, verified live quote feed for Pocket Option OTC or Forex. Source and permission for broker-specific live quotes must be established before Android runtime integration or an APK can truthfully claim to detect intrabar shocks.
