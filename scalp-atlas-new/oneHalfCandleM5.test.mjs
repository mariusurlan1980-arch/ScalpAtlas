import assert from 'node:assert/strict';
import test from 'node:test';
import { evaluateOneHalfM5, OneHalfM5Session } from './oneHalfCandleM5.ts';

const base = 1_710_000_000_000;
const DURATION = 300_000;
const previous = { pair: 'EUR/USD OTC', startMs: base-DURATION, endMs: base, open: 1.1000, close: 1.1010, sourceConfirmed: true };
const current = {
  pair: previous.pair, startMs: base, open: 1.1010, sourceConfirmed: true,
  samples: [
    {timestampMs:base+10_000,price:1.1012},
    {timestampMs:base+60_000,price:1.1017},
    {timestampMs:base+100_000,price:1.1011},
    {timestampMs:base+150_000,price:1.1014},
  ],
};
const settings = {minimumRetracementPrice:0.0003};
const evaluate = (prev={}, curr={}, s={}) => evaluateOneHalfM5({...previous,...prev},{...current,...curr},{...settings,...s});

test('BUY only after >= 50% of second green M5 with a timed retreat and partial recovery', () => {
  const r=evaluate();assert.equal(r.signal,'BUY');assert.equal(r.elapsedPercent,50);
});
test('not before the 50% mark',()=>assert.equal(evaluate({}, {samples:current.samples.map((s,i)=>i===3?{...s,timestampMs:base+149_999}:s)}).signal,'NONE'));
test('not when candle two is red',()=>assert.equal(evaluate({}, {samples:current.samples.slice(0,-1).concat({timestampMs:base+150_000,price:1.1009})}).signal,'NONE'));
test('not with adjacent candle missing',()=>assert.equal(evaluate({endMs:base-300_000}).signal,'NONE'));
test('not with different pairs',()=>assert.equal(evaluate({}, {pair:'AUD/CHF OTC'}).signal,'NONE'));
test('not without confirmed feed',()=>assert.equal(evaluate({sourceConfirmed:false}).signal,'NONE'));
test('not without calibrated minimum price retreat',()=>assert.equal(evaluate({}, {}, {minimumRetracementPrice:0}).signal,'NONE'));
test('not if retreat is smaller than configured threshold',()=>assert.equal(evaluate({}, {}, {minimumRetracementPrice:0.001}).signal,'NONE'));
test('not when price has already returned to the previous peak',()=>assert.equal(evaluate({}, {samples:current.samples.slice(0,-1).concat({timestampMs:base+150_000,price:1.1017})}).signal,'NONE'));
test('not on unordered data',()=>assert.equal(evaluate({}, {samples:current.samples.slice(0,-1).concat({timestampMs:base+50_000,price:1.1014})}).signal,'NONE'));
test('SELL on two red candles and spike/pullback/recovery',()=>{
  const sellPrev={open:1.1020,close:1.1010};
  const sellCurrent={open:1.1010,samples:[
    {timestampMs:base+10_000,price:1.1008},
    {timestampMs:base+60_000,price:1.1003},
    {timestampMs:base+100_000,price:1.1009},
    {timestampMs:base+150_000,price:1.1006},
  ]}; assert.equal(evaluate(sellPrev,sellCurrent).signal,'SELL');
});
test('one signal only for each second candle, even after further observations',()=>{
 const session=new OneHalfM5Session();assert.equal(session.observe(previous,current,settings).signal,'BUY');
 assert.equal(session.observe(previous,current,settings).signal,'NONE');
});
