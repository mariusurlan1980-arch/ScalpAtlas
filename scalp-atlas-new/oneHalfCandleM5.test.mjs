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
const settings = {priceTickSize:0.0001};
const evaluate = (prev={}, curr={}, s={}) => evaluateOneHalfM5({...previous,...prev},{...current,...curr},{...settings,...s});

test('BUY as soon as second green M5 has a timed retreat and partial recovery', () => {
  const r=evaluate();assert.equal(r.signal,'BUY');assert.equal(r.elapsedPercent,50);
});
test('early entry before 50% is allowed once the same-color pullback and recovery exist',()=>{
 const samples=current.samples.map((s,i)=>({...s,timestampMs:base+[1000,9000,14000,18000][i]}));
 const r=evaluate({}, {samples});assert.equal(r.signal,'BUY');assert.equal(r.elapsedPercent,6);
});
test('not when candle two is red',()=>assert.equal(evaluate({}, {samples:current.samples.slice(0,-1).concat({timestampMs:base+150_000,price:1.1009})}).signal,'NONE'));
test('not with adjacent candle missing',()=>assert.equal(evaluate({endMs:base-300_000}).signal,'NONE'));
test('not with different pairs',()=>assert.equal(evaluate({}, {pair:'AUD/CHF OTC'}).signal,'NONE'));
test('not without confirmed feed',()=>assert.equal(evaluate({sourceConfirmed:false}).signal,'NONE'));
test('not without a verified tick size',()=>assert.equal(evaluate({}, {}, {priceTickSize:0}).signal,'NONE'));
test('not if retreat is smaller than one quoted tick',()=>assert.equal(evaluate({}, {}, {priceTickSize:0.001}).signal,'NONE'));
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

test('symbolic two-tick retreat and one-tick partial recovery is valid with no M5 midpoint requirement', () => {
  const tinyRetreat = current.samples.slice(0, -3).concat([
    {timestampMs:base+60_000, price:1.1015},
    {timestampMs:base+100_000, price:1.1013},
    {timestampMs:base+150_000, price:1.1014},
  ]);
  assert.equal(evaluate({}, {samples:tinyRetreat}).signal, 'BUY');
});
test('one tick back to former peak is still rejected as chasing the peak', () => {
  const chasePeak = [
    {timestampMs:base+10_000, price:1.1012},
    {timestampMs:base+60_000, price:1.1015},
    {timestampMs:base+100_000, price:1.1014},
    {timestampMs:base+150_000, price:1.1015},
  ];
  assert.equal(evaluate({}, {samples:chasePeak}).signal, 'NONE');
});
test('rejects an unverified negative tick size', () => {
  assert.equal(evaluate({}, {}, {priceTickSize:-0.0001}).signal, 'NONE');
});

test('two green candles alone do not trigger without actual observed retracement',()=>{
 const samples=[
  {timestampMs:base+1000,price:1.1011},
  {timestampMs:base+3000,price:1.1012},
  {timestampMs:base+6000,price:1.1013},
  {timestampMs:base+9000,price:1.1014},
 ];
 assert.equal(evaluate({}, {samples}).signal,'NONE');
});
test('different candle colors are blocked even with the retracement shape',()=>{
 assert.equal(evaluate({open:1.102,close:1.101}).signal,'NONE');
});
test('no signal with fewer than four timestamped price samples',()=>{
 assert.equal(evaluate({}, {samples:current.samples.slice(0,3)}).signal,'NONE');
});
test('early SELL when both M5 candles are red',()=>{
 const samples=[
  {timestampMs:base+1000,price:1.1008},
  {timestampMs:base+3000,price:1.1003},
  {timestampMs:base+6000,price:1.1009},
  {timestampMs:base+9000,price:1.1006},
 ];
 const r=evaluate({open:1.102,close:1.101},{samples});
 assert.equal(r.signal,'SELL');assert.equal(r.elapsedPercent,3);
});
