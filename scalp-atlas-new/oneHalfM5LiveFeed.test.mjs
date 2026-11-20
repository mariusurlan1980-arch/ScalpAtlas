import assert from 'node:assert/strict';
import test from 'node:test';
import { OneHalfM5LiveFeed } from './oneHalfM5LiveFeed.ts';

const start = 1_710_000_000_000;
const closed = { pair: 'EUR/USD OTC', startMs: start - 300_000, endMs: start,
  open: 1.1000, close: 1.1010, sourceConfirmed: true };
const tick = (i, price, extra={}) => ({
  pair: closed.pair, timeframeMinutes: 5, candleStartMs: start, candleOpen: 1.1010,
  timestampMs: start + [10_000,60_000,100_000,150_000][i],
  receivedAtMs: start + [10_000,60_000,100_000,150_000][i] + 200,
  price, sourceConfirmed: true, ...extra,
});
const sample = [1.1012,1.1017,1.1011,1.1014];
const newFeed = () => {const feed=new OneHalfM5LiveFeed(); assert.equal(feed.arm(closed, 0.0001),true); return feed;};
const pushAll = (feed) => sample.map((p,i)=>feed.push(tick(i,p)));

test('BUY on live M5 only at 2:30 with confirmed candle',()=>{
 const results=pushAll(newFeed()); assert.equal(results[2].signal,'NONE');assert.equal(results[3].signal,'BUY');
 assert.equal(results[3].elapsedPercent,50);assert.equal(results[3].simulationOnly,true);
});
test('no duplicate signal within same candle',()=>{
 const f=newFeed();pushAll(f);
 assert.equal(f.push(tick(3,1.1015,{timestampMs:start+151_000,receivedAtMs:start+151_100})).signal,'NONE');
});
test('no duplicate after re-arming same candle (pair rotation)',()=>{
 const f=newFeed();pushAll(f); f.arm(closed,0.0001);
 assert.equal(pushAll(f)[3].signal,'NONE');
});
test('rejects unverified prior M5 bar',()=>{
 const f=new OneHalfM5LiveFeed(); assert.equal(f.arm({...closed, sourceConfirmed:false}, 0.0001),false);
 assert.equal(f.push(tick(0,1.1012)).signal,'NONE');
});
test('rejects invalid tick size',()=>assert.equal(new OneHalfM5LiveFeed().arm(closed,0),false));
test('invalid timeframe disarms and cannot resume on same stream',()=>{
 const f=newFeed();assert.equal(f.push(tick(0,1.1012,{timeframeMinutes:10})).signal,'NONE');
 assert.match(f.push(tick(1,1.1017)).reason,/Aștept/);
});
test('pair change resets, no cross-pair contamination',()=>{
 const f=newFeed();f.push(tick(0,1.1012));f.push(tick(1,1.1017));
 assert.equal(f.push(tick(2,1.1011,{pair:'AUD/CHF OTC'})).signal,'NONE');
 assert.match(f.push(tick(3,1.1014)).reason,/Aștept/);
});
test('rejects out-of-order sample, then valid continuation still works',()=>{
 const f=newFeed();f.push(tick(0,1.1012));f.push(tick(1,1.1017));
 assert.equal(f.push(tick(1,1.1017)).signal,'NONE');
 assert.equal(f.push(tick(2,1.1011)).signal,'NONE');assert.equal(f.push(tick(3,1.1014)).signal,'BUY');
});
test('rejects stale quotes but preserves feed for fresh updates',()=>{
 const f=newFeed();assert.equal(f.push(tick(0,1.1012,{receivedAtMs:start+18_000})).signal,'NONE');
 assert.equal(pushAll(f)[3].signal,'BUY');
});
test('rejects wrong candle start and requires rearm',()=>{
 const f=newFeed();assert.equal(f.push(tick(0,1.1012,{candleStartMs:start+300_000})).signal,'NONE');
 assert.match(f.push(tick(1,1.1017)).reason,/Aștept/);
});
test('SELL signal for two red candles',()=>{
 const f=new OneHalfM5LiveFeed();f.arm({...closed,open:1.102,close:1.101},0.0001);
 const prices=[1.1008,1.1003,1.1009,1.1006];
 const updates=prices.map((p,i)=>f.push(tick(i,p)));assert.equal(updates[3].signal,'SELL');
});
test('rejects changed opening price mid-candle',()=>{
 const f=newFeed();f.push(tick(0,1.1012));
 assert.match(f.push(tick(1,1.1017,{candleOpen:1.102})).reason,/deschidere/);
});
test('disarm prevents further signal',()=>{
 const f=newFeed();f.push(tick(0,1.1012)); f.disarm();assert.equal(f.push(tick(1,1.1017)).signal,'NONE');
});
