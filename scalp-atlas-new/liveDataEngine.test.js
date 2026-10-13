'use strict';
const assert=require('node:assert/strict');
const test=require('node:test');
const {createLiveOhlcCollector,createSseDecoder}=require('./liveDataEngine');

function setup(tf=300,offset=0){
 let now=1_800_000_001;
 const feed=createLiveOhlcCollector({symbol:'EURUSD_otc',timeframeSeconds:tf,
   providerToUtcOffsetSeconds:offset,nowSeconds:()=>now,maxStaleSeconds:12});
 return {feed,setNow:n=>{now=n},getNow:()=>now};
}
test('builds actual OHLC values and closes only after next timestamp bucket',()=>{
 const {feed,setNow}=setup(),start=1_800_000_000;
 for(const [sec,p] of [[1,1.11],[18,1.13],[39,1.10],[80,1.12]]){
   setNow(start+sec);
   const result=feed.tick({symbol:'EURUSD_otc',time:start+sec,price:p});
   assert.equal(result.completed,null);
 }
 setNow(start+300);
 const r=feed.tick({symbol:'EURUSD_otc',time:start+300,price:1.14});
 assert.equal(r.completed.open,1.11);
 assert.equal(r.completed.high,1.13);
 assert.equal(r.completed.low,1.10);
 assert.equal(r.completed.close,1.12);
 assert.equal(r.completed.complete,true);
 assert.equal(feed.snapshot().live.complete,false);
 assert.equal(feed.snapshot().status.reason,'INSUFFICIENT_CLOSED_OHLC');
});
test('explicit broker-time offset allows UTC normalization, never auto guessing',()=>{
 const {feed,setNow}=setup(300,-7200);
 setNow(1_800_000_001);
 const r=feed.tick({symbol:'EURUSD_otc',time:1_800_007_201,price:1.2});
 assert.equal(r.accepted,true);
 assert.equal(feed.snapshot().lastTickUtc,1_800_000_001);
 assert.throws(()=>createLiveOhlcCollector({symbol:'EURUSD_otc'}),/CALIBRATION/);
});
test('stale ticks fail closed and heartbeat age makes collector WAIT',()=>{
 const {feed,setNow}=setup();setNow(1_800_000_001);
 assert.equal(feed.tick({symbol:'EURUSD_otc',time:1_799_999_971,price:1.2}).reason,
   'UNVERIFIED_CLOCK_OR_STALE_QUOTE');
 feed.tick({symbol:'EURUSD_otc',time:1_800_000_001,price:1.2});
 setNow(1_800_000_021);
 assert.equal(feed.status().reason,'STALE_FEED');
});
test('other symbols and malformed ticks never contaminate live OHLC',()=>{
 const {feed,setNow}=setup();setNow(1_800_000_001);
 assert.equal(feed.tick({symbol:'GBPUSD_otc',time:1_800_000_001,price:1.2}).reason,'WRONG_SYMBOL');
 assert.equal(feed.tick({symbol:'EURUSD_otc',time:1_800_000_001,price:-1}).reason,'INVALID_QUOTE');
 assert.equal(feed.snapshot().live,null);
});
test('out-of-order quotes rejected, no bar rewrite',()=>{
 const {feed,setNow}=setup();setNow(1_800_000_010);
 feed.tick({symbol:'EURUSD_otc',time:1_800_000_010,price:1.2});
 setNow(1_800_000_011);
 assert.equal(feed.tick({symbol:'EURUSD_otc',time:1_800_000_009,price:1.0}).reason,'OUT_OF_ORDER_TICK');
 assert.equal(feed.snapshot().live.low,1.2);
});
test('missed candle gap invalidates history until 15 contiguous closes',()=>{
 const {feed,setNow}=setup(),start=1_800_000_000;
 const send=i=>{setNow(start+i*300);return feed.tick({symbol:'EURUSD_otc',time:start+i*300,price:1+i/10000})};
 send(0);send(1);
 let r=send(3);
 assert.equal(r.completed,null);
 assert.equal(feed.status().reason,'HISTORY_GAP');
 for(let i=4;i<=18;i++)send(i);
 assert.equal(feed.snapshot().closed.length,15);
 assert.equal(feed.status().state,'READY_FOR_RESEARCH');
});
test('a single tick per minute is insufficient to produce any trade',()=>{
 const {feed,setNow}=setup(),start=1_800_000_000;
 for(let i=0;i<21;i++){
   const t=start+i*300;setNow(t);
   feed.tick({symbol:'EURUSD_otc',time:t,price:1.2+i*.001});
 }
 const snap=feed.snapshot();
 assert.equal(snap.status.state,'READY_FOR_RESEARCH');
 assert.equal('side' in snap,false);
 assert.equal('signal' in snap,false);
 assert.equal('bip' in snap,false);
});
test('SSE parser handles partial chunks and only tick events',()=>{
 const d=createSseDecoder();
 assert.deepEqual(d.push('event: connected\ndata: {"symbols":["EURUSD_otc"]}\n\n:event\n\nevent: ti'),[]);
 const t=d.push('ck\ndata: {"symbol":"EURUSD_otc","price":1.2,"time":1800000000}\n\n');
 assert.deepEqual(t,[{symbol:'EURUSD_otc',price:1.2,time:1800000000}]);
});
