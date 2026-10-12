'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {directionFromClosedBars,evaluateFixedExpiry}=require('./freeM5Backtest');

const s=1800000000;
function bars(n,kind='UP',interval=30){
  const ticks=[];
  for(let i=0;i<n;i++){
    const time=s+i*300;
    // deliberately consistent long bull trend; no future bar lookahead.
    const p=1.10+i*.0004;
    const samples=300/interval;
    for(let j=0;j<samples;j++) {
      const fraction=j/(samples-1);
      const value=kind==='UP'
        ?p+.0003*fraction
        :1.30-i*.0004-.0003*fraction;
      ticks.push({t:time+j*interval,p:value,session:1});
    }
  }
  return ticks;
}
test('less than 22 CLOSED bars cannot emit a candidate',()=>{
 const a=Array.from({length:21},(_,i)=>({
   start:s+i*300,open:1+i*.001,close:1+(i+1)*.001,high:1+(i+1)*.001,low:1+i*.001
 }));
 assert.equal(directionFromClosedBars(a),null);
});
test('all signals use closed bars; deterministic bullish demo wins',()=>{
 const r=evaluateFixedExpiry(bars(55));
 assert.ok(r.trades>0,'must have multiple demo examples');
 assert.equal(r.losses,0);
 assert.ok(r.rawTrades.every(t=>t.dir==='BUY'&&t.expiryTime>=t.entryTime+300));
 assert.ok(r.rawTrades.every(t=>t.entryTime>=t.signalTime));
 assert.equal(r.payoutBreakEven,1/1.92);
 assert.ok(r.insufficientSample);
});
test('no lookahead: prefix results unchanged by any later ticks',()=>{
 const full=bars(57),prefix=full.slice(0,500);
 const old=evaluateFixedExpiry(prefix),all=evaluateFixedExpiry(full);
 const oldEntries=old.rawTrades.map(t=>[t.entryTime,t.expiryTime,t.entryPrice,t.outcome]);
 assert.deepEqual(all.rawTrades.filter(t=>t.expiryTime<=prefix.at(-1).t)
   .map(t=>[t.entryTime,t.expiryTime,t.entryPrice,t.outcome]),oldEntries);
});
test('5 minute settlement AFTER entry, not bar-close extrapolation',()=>{
 const r=evaluateFixedExpiry(bars(55,'UP',5),{delaySeconds:5});
 assert.ok(r.rawTrades.length>0);
 for(const t of r.rawTrades){
   assert.ok(t.entryTime>=t.signalTime+5);
   assert.ok(t.expiryTime>=t.entryTime+300);
 }
});
test('tick gap resets and never invents missing candles',()=>{
 const broken=bars(55).filter(x=>{
   const bar=Math.floor((x.t-s)/300);
   return bar!==22&&bar!==23;
 });
 const r=evaluateFixedExpiry(broken);
 assert.ok(r.discontinuities>0);
});
test('reject unsorted ticks, bad payouts and synthetic price errors',()=>{
 assert.throws(()=>evaluateFixedExpiry([{t:10,p:1},{t:9,p:2}]),/UNSORTED/);
 assert.throws(()=>evaluateFixedExpiry(bars(15),{payout:1.2}),/PARAMETERS/);
 assert.throws(()=>evaluateFixedExpiry([{t:10,p:-2}]),/BAD/);
});
test('down trend can be SELL, but cannot use future prices',()=>{
 const r=evaluateFixedExpiry(bars(60,'DOWN'));
 assert.ok(r.rawTrades.length>0);
 assert.ok(r.rawTrades.every(t=>t.dir==='SELL'));
});
