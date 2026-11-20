import assert from 'node:assert/strict';
import test from 'node:test';
import { evaluateLocalReversal560, LocalReversalSession560 } from './localReversalM5_560.ts';
const M=300_000, base=1_710_000_000_000;
const mk=(n,open,high,low,close,pair='EUR/USD OTC')=>({
 pair,startMs:base+n*M,endMs:base+(n+1)*M,open,high,low,close,sourceConfirmed:true
});
const before=[
 mk(-4,1.104,1.1045,1.1025,1.103),
 mk(-3,1.103,1.1035,1.1015,1.102),
 mk(-2,1.102,1.1025,1.1005,1.101),
];
const first=mk(-1,1.1009,1.1017,1.1003,1.1015);
const second={
 pair:'EUR/USD OTC',startMs:base,open:1.1015,sourceConfirmed:true,
 samples:[
  {timestampMs:base+1000,price:1.1017},
  {timestampMs:base+4000,price:1.1021},
  {timestampMs:base+7000,price:1.1017},
  {timestampMs:base+9000,price:1.1019},
 ]
};
const settings={priceTickSize:0.0001,evaluatedAtMs:base+9100};
const input=(overrides={})=>({
 before,first,second,...settings,...overrides
});
const run=(overrides={})=>evaluateLocalReversal560(input(overrides));
const sellBefore=[
 mk(-4,1.0970,1.0985,1.0968,1.0980),
 mk(-3,1.0980,1.0994,1.0976,1.0990),
 mk(-2,1.0990,1.1004,1.0986,1.1000),
];
const sellFirst=mk(-1,1.1001,1.1006,1.0992,1.0995);
const sellSecond={
 ...second,open:1.0995,samples:[
  {timestampMs:base+1000,price:1.0993},
  {timestampMs:base+4000,price:1.0989},
  {timestampMs:base+7000,price:1.0993},
  {timestampMs:base+9000,price:1.0991},
 ]
};
test('BUY after observed local minimum, first green closed, second green and small pullback',()=>{
 const r=run();assert.equal(r.signal,'BUY');
 assert.equal(r.localExtreme,'LOCAL_MINIMUM');
 assert.equal(r.demoCandidateOnly,true);
 assert.ok(r.retracementTicks>=3);
});
test('SELL after observed local maximum, first red closed, second red and small pullback',()=>{
 const r=run({before:sellBefore,first:sellFirst,second:sellSecond});
 assert.equal(r.signal,'SELL');assert.equal(r.localExtreme,'LOCAL_MAXIMUM');
});
test('no mandatory 2m30 wait: candidate at 9 seconds',()=>assert.equal(run().signal,'BUY'));
test('rejects a first green candle that does not touch the prior local minimum',()=>{
 assert.equal(run({first:{...first,low:1.1008}}).signal,'NONE');
});
test('rejects a first red candle that is not near a prior local maximum',()=>{
 assert.equal(run({before:sellBefore,first:{...sellFirst,high:1.1002},second:sellSecond}).signal,'NONE');
});
test('rejects a first candle with no color reversal from prior candle',()=>{
 assert.equal(run({before:[before[0],before[1],{...before[2],open:1.1007,close:1.101}]}).signal,'NONE');
});
test('rejects the second candle when its color differs from first',()=>{
 assert.equal(run({second:{...second,samples:[...second.samples.slice(0,3),{timestampMs:base+9000,price:1.1011}]}}).signal,'NONE');
});
test('two consecutive green candles WITHOUT a pullback do not trigger',()=>{
 const prices=[1.1016,1.1017,1.1018,1.1019];
 assert.equal(run({second:{...second,samples:second.samples.map((s,i)=>({...s,price:prices[i]}))}}).signal,'NONE');
});
test('rejects a pullback without any partial recovery',()=>{
 const prices=[1.1017,1.1021,1.1018,1.1016];
 assert.equal(run({second:{...second,samples:second.samples.map((s,i)=>({...s,price:prices[i]}))}}).signal,'NONE');
});
test('rejects chasing the earlier candle maximum',()=>{
 const samples=[...second.samples.slice(0,3),{timestampMs:base+9000,price:1.1021}];
 assert.equal(run({second:{...second,samples}}).signal,'NONE');
});
test('rejects a stale quote',()=>{
 assert.equal(run({evaluatedAtMs:base+16000}).signal,'NONE');
});
test('rejects quote samples from the future',()=>{
 assert.equal(run({evaluatedAtMs:base+8000}).signal,'NONE');
});
test('rejects missing or incomplete candle history',()=>assert.equal(run({before:before.slice(1)}).signal,'NONE'));
test('rejects a non-consecutive prior candle',()=>{
 assert.equal(run({before:[before[0],{...before[1],startMs:base-850000},before[2]]}).signal,'NONE');
});
test('rejects another currency pair without re-arming',()=>{
 assert.equal(run({second:{...second,pair:'AUD/CHF OTC'}}).signal,'NONE');
});
test('rejects unconfirmed historical data',()=>{
 assert.equal(run({first:{...first,sourceConfirmed:false}}).signal,'NONE');
});
test('rejects unconfirmed second-candle feed',()=>{
 assert.equal(run({second:{...second,sourceConfirmed:false}}).signal,'NONE');
});
test('rejects a missing tick calibration',()=>{
 assert.equal(run({priceTickSize:0}).signal,'NONE');
});
test('rejects duplicate or disordered samples',()=>{
 const samples=second.samples.map((s,i)=>i===3?{...s,timestampMs:base+4000}:s);
 assert.equal(run({second:{...second,samples}}).signal,'NONE');
});
test('does not issue two candidates on same pair and second candle',()=>{
 const session=new LocalReversalSession560();
 assert.equal(session.observe(input()).signal,'BUY');
 assert.equal(session.observe(input()).signal,'NONE');
});
test('never produces a broker order, only a DEMO candidate',()=>{
 const result=run();
 assert.equal(result.demoCandidateOnly,true);
 assert.equal(Object.hasOwn(result,'submitOrder'),false);
});
