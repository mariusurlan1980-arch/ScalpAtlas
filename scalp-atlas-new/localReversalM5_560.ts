/**
 * Scalp Atlas 560 - local high/low reversal + two matching M5 candles (DEMO).
 *
 * Price-based candidate only; must receive verified, timestamped OHLC data from
 * the SAME pair and consecutive M5 candles. Never places orders or clicks.
 * Local extrema are measured against the latest THREE completed candles;
 * they are NOT an oracle for a future market top/bottom.
 */
export type Side560 = 'BUY' | 'SELL';
export type Candle560 = {
  pair: string; startMs: number; endMs: number;
  open: number; high: number; low: number; close: number;
  sourceConfirmed: boolean;
};
export type Tick560 = { timestampMs: number; price: number };
export type Forming560 = {
  pair: string; startMs: number; open: number;
  samples: Tick560[]; sourceConfirmed: boolean;
};
export type ReversalInput560 = {
  /** Three closed candles immediately BEFORE the first reversal candle. */
  before: [Candle560, Candle560, Candle560];
  /** Fully closed first green/red candle at the observed low/high. */
  first: Candle560;
  /** Second, still forming candle. */
  second: Forming560;
  /** Smallest verified quoted increment for the instrument (not a global pip). */
  priceTickSize: number;
  /** Wall-clock time at which the candidate is evaluated. */
  evaluatedAtMs: number;
};
export type ReversalResult560 =
  | { signal: 'NONE'; reason: string }
  | { signal: Side560; localExtreme: 'LOCAL_MINIMUM' | 'LOCAL_MAXIMUM';
      retracementTicks: number; reason: 'REVERSAL_TWO_CANDLES_M5'; demoCandidateOnly: true };

const M5 = 300_000;
const MAX_QUOTE_AGE = 5000;
const EPS = 1e-7;
const reject = (reason: string): ReversalResult560 => ({signal: 'NONE', reason});
const direction = (c: Candle560): Side560 | 'NONE' =>
  c.close > c.open ? 'BUY' : c.close < c.open ? 'SELL' : 'NONE';

function validClosed(c: Candle560): boolean {
  return Boolean(c?.sourceConfirmed && typeof c.pair === 'string' && c.pair.trim() &&
    [c.startMs,c.endMs,c.open,c.high,c.low,c.close].every(Number.isFinite) &&
    c.endMs - c.startMs === M5 && c.startMs % M5 === 0 && c.low > 0 && c.high > c.low &&
    c.high >= Math.max(c.open,c.close) && c.low <= Math.min(c.open,c.close));
}

export function evaluateLocalReversal560(input: ReversalInput560): ReversalResult560 {
  if (!input || !Array.isArray(input.before) || input.before.length !== 3 ||
      !validClosed(input.first) || input.before.some(c => !validClosed(c)))
    return reject('Lipsesc patru lumânări M5 complete și confirmate');
  const {before,first,second,priceTickSize:tick,evaluatedAtMs:now} = input;
  if (!second?.sourceConfirmed || typeof second.pair !== 'string' ||
      !Number.isFinite(tick) || tick <= 0 || !Number.isFinite(now) ||
      !Number.isFinite(second.startMs) || !Number.isFinite(second.open) || second.open <= 0)
    return reject('Sursa LIVE, pasul cotației sau timpul nu sunt confirmate');
  const history=[...before,first];
  if (history.some(c=>c.pair !== first.pair) || second.pair !== first.pair ||
      history.some((c,i)=>i>0 && c.startMs !== history[i-1].endMs) ||
      second.startMs !== first.endMs)
    return reject('Lumânările M5 nu sunt consecutive pe aceeași pereche');

  const side=direction(first);
  if (side === 'NONE' || direction(before[2]) === side ||
      direction(before[2]) === 'NONE' ||
      Math.abs(first.close - first.open) + tick*EPS < tick)
    return reject('Lumânarea 1 nu confirmă întoarcerea culorii');
  const isLow=side==='BUY';
  const extreme=isLow
    ? first.low <= Math.min(...before.map(c=>c.low)) + tick*EPS
    : first.high >= Math.max(...before.map(c=>c.high)) - tick*EPS;
  if (!extreme) return reject('Prima lumânare nu este la un minim/maxim local observat');

  const samples=second.samples;
  if (!Array.isArray(samples) || samples.length < 4)
    return reject('Retragerea nu a fost observată LIVE în lumânarea 2');
  for(let i=0;i<samples.length;i++){
    const v=samples[i];
    if(!v || !Number.isFinite(v.timestampMs) || !Number.isFinite(v.price) ||
       v.price<=0 || v.timestampMs<second.startMs ||
       v.timestampMs>=second.startMs+M5 ||
       (i>0 && v.timestampMs<=samples[i-1].timestampMs))
      return reject('Cotațiile lumânării 2 sunt invalide ori în altă ordine');
  }
  const latest=samples[samples.length-1];
  if (now<latest.timestampMs || now-latest.timestampMs>MAX_QUOTE_AGE)
    return reject('Ultima cotație este veche sau din viitor');
  if (isLow && latest.price <= second.open ||
      !isLow && latest.price >= second.open)
    return reject('Lumânarea 2 nu are aceeași culoare');
  // Detect earlier favorable extreme, adverse pullback and a PARTIAL return.
  // No fixed 2m30 gate and no entry at the earlier high/low.
  let maxTicks=0;
  for(let i=0;i<samples.length-2;i++){
    for(let j=i+1;j<samples.length-1;j++){
      const adverse=isLow
        ? samples[i].price - samples[j].price
        : samples[j].price - samples[i].price;
      const bounce=isLow
        ? latest.price - samples[j].price
        : samples[j].price - latest.price;
      if (adverse + tick*EPS >= tick && bounce + tick*EPS >= tick &&
          bounce < adverse - tick*EPS)
        maxTicks=Math.max(maxTicks, adverse/tick);
    }
  }
  if(maxTicks === 0) return reject('Aștept retragere simbolică și revenire parțială');
  return {
    signal:side,localExtreme:isLow?'LOCAL_MINIMUM':'LOCAL_MAXIMUM',
    retracementTicks:Math.floor(maxTicks+EPS),
    reason:'REVERSAL_TWO_CANDLES_M5',demoCandidateOnly:true,
  };
}

/** Prevent duplicate candidates when the same forming M5 is revisited on rotation. */
export class LocalReversalSession560 {
  private emitted=new Set<string>();
  observe(input:ReversalInput560):ReversalResult560 {
    const key=`${input?.second?.pair || ''}|${input?.second?.startMs}`;
    if(this.emitted.has(key))return reject('Semnal deja raportat pentru această lumânare');
    const result=evaluateLocalReversal560(input);
    if(result.signal!=='NONE') this.emitted.add(key);
    return result;
  }
  reset():void {this.emitted.clear();}
}
