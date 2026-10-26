import { ShockQuoteAdapter, type QuoteTick } from './shockQuoteAdapter';

const adapter = new ShockQuoteAdapter();
function quote(ts: number, price: number, marketId = 'USD/TEST'): QuoteTick {
  return { marketId, timestampMs: ts, price, timeframeMinutes: 5, sourceConfirmed: true };
}
const events = [
  quote(0, 100), quote(299000, 101),
  quote(300000, 101), quote(599000, 102),
  quote(600000, 103), quote(601000, 110),
  quote(602000, 109), quote(603000, 105), quote(604000, 103.4),
  quote(605000, 104.2), quote(606000, 106.3),
];
let signal: ReturnType<ShockQuoteAdapter['ingest']>['signal'] = null;
for (const event of events) {
  const update = adapter.ingest(event);
  if (update.signal) signal = update.signal;
}
if (!signal || signal.direction !== 'BUY' || signal.shockDepthPercent < 90 ||
    signal.shockDurationMs > 5000 || signal.expiryMinutes !== 5) {
  throw new Error('Adapter: BUY rapid nedetectat');
}
if (adapter.ingest(quote(607000, 107)).signal) throw new Error('BIP duplicat');
const switched = adapter.ingest(quote(608000, 110, 'OTHER-MARKET'));
if (switched.signal || switched.sourceReady) throw new Error('Piața nouă a moștenit semnalul');
if (adapter.ingest(quote(609000, 111, 'OTHER-MARKET')).signal) {
  throw new Error('Trendul nu este confirmat');
}
const rejected = adapter.ingest({ ...quote(610000, 112, 'OTHER-MARKET'), sourceConfirmed: false });
if (rejected.signal || rejected.sourceReady) throw new Error('Flux neverificat acceptat');
console.log('Adapter ȘOC: OHLC, BUY, BIP unic, schimbare pereche, sursă invalidă — OK');
