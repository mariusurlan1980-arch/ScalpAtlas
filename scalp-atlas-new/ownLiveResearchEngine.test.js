'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {ownNumericObservation,assessSignalRelease}=require('./ownLiveResearchEngine');
const sym='EURUSD_otc',base=1800000000;
function input(dir='BUY'){
  const bars=[];
  for(let i=0;i<34;i++){
    const d=dir==='BUY'?1:-1;
    const open=1.1+d*i*.0002;
    const close=open+d*.00011;
    const hi=Math.max(open,close)+.00012;
    const lo=Math.min(open,close)-.00012;
    bars.push({symbol:sym,time:base+i*300,open,high:hi,low:lo,close,complete:true});
  }
  // A prior wick remains distinctly beyond the latest closes: not chasing
  // the very highest/lowest candle of the sampled interval.
  if(dir==='BUY') bars.at(-7).high+=.0013;
  if(dir==='SELL') bars.at(-7).low-=.0013;
  const last=bars.at(-1);
  const lastTick={symbol:sym,time:last.time+305,price:last.close};
  return {symbol:sym,bars,lastTick,nowSeconds:lastTick.time,timeframeSeconds:300};
}
test('Bullish two closes produces non-actionable research observation',()=>{
 const x=ownNumericObservation(input('BUY'));
 assert.equal(x.state,'LAB_OBSERVATION_ONLY');
 assert.equal(x.observation,'BUY');
 assert.equal(x.beepAllowed,false);
 assert.equal(x.orderAllowed,false);
 assert.equal(x.suggestTrade,false);
 assert.equal(x.predictedWinProbability,null);
});
test('Bearish two closes produces non-actionable research observation',()=>{
 const x=ownNumericObservation(input('SELL'));
 assert.equal(x.state,'LAB_OBSERVATION_ONLY');
 assert.equal(x.observation,'SELL');
 assert.equal(x.beepAllowed,false);
});
test('Missing M5 candle results in WAIT, never beep',()=>{
 const f=input();f.bars.splice(-8,1);
 const x=ownNumericObservation(f);
 assert.equal(x.state,'WAIT');assert.equal(x.beepAllowed,false);
 assert.equal(x.reason,'INVALID_OR_MISSING_CLOSED_OHLC');
});
test('No actual tick or stale stream does not generate trade',()=>{
 const f=input();f.nowSeconds+=15;
 const x=ownNumericObservation(f);
 assert.equal(x.reason,'LIVE_NUMERIC_TICK_MISSING_OR_STALE');
 assert.equal(x.observation,'NONE');
});
test('No 32 completed OHLC bars means wait',()=>{
 const f=input();f.bars=f.bars.slice(-18);
 assert.equal(ownNumericObservation(f).reason,'NEED_32_CLOSED_M5_CANDLES');
});
test('Reject a current contradictory green rebound on SELL',()=>{
 const f=input('SELL');f.lastTick.price+=.0007;
 const x=ownNumericObservation(f);
 assert.equal(x.reason,'SELL_OPPOSED_BY_CURRENT_TICK');
});
test('Reject a current contradictory red fall on BUY',()=>{
 const f=input('BUY');f.lastTick.price-=.0007;
 const x=ownNumericObservation(f);
 assert.equal(x.reason,'BUY_OPPOSED_BY_CURRENT_TICK');
});
test('Reject near-low SELL and near-high BUY exhaustion',()=>{
 const f=input('SELL');
 f.bars.at(-7).low=f.bars.at(-7).open-0.00012;
 assert.equal(ownNumericObservation(f).reason,'SELL_TOO_CLOSE_TO_RECENT_LOW');
 const g=input('BUY');
 g.bars.at(-7).high=g.bars.at(-7).close+.00012;
 assert.equal(ownNumericObservation(g).reason,'BUY_TOO_CLOSE_TO_RECENT_HIGH');
});
test('Reject active current bar treated as a confirmed closed candle',()=>{
 const f=input();f.bars.at(-1).complete=false;
 assert.equal(ownNumericObservation(f).reason,'INVALID_OR_MISSING_CLOSED_OHLC');
});
test('Only M5 allowed in this research strategy',()=>{
 const f=input();f.timeframeSeconds=600;
 assert.equal(ownNumericObservation(f).reason,'SYMBOL_OR_M5_TIMEFRAME_REQUIRED');
});
test('No numeric source or no independently confirmed broker match means blocked',()=>{
 const r=assessSignalRelease({demoSettledTrades:Array.from({length:250},()=>({outcome:'WIN',verifiedDemo:true}))});
 assert.equal(r.state,'BLOCKED');
 assert.equal(r.beepAllowed,false);
});
test('200 records cannot bypass measured live source and validation gates',()=>{
 const sample=Array.from({length:200},(_,i)=>({outcome:i%2?'LOSS':'WIN',verifiedDemo:true}));
 const r=assessSignalRelease({feedMatchesBroker:true,sourceAuthorized:true,demoSettledTrades:sample});
 assert.equal(r.state,'RESEARCH_METRICS_ONLY');
 assert.equal(r.winRate,.5);
 assert.equal(r.samples,200);
 assert.equal(r.expectedNetPerUnitRisk,-.04);
 assert.equal(r.beepAllowed,false);
});
test('Fewer than 200 verified Demo settlements blocks readiness',()=>{
 const sample=Array.from({length:200},()=>({outcome:'WIN',verifiedDemo:false}));
 const r=assessSignalRelease({feedMatchesBroker:true,sourceAuthorized:true,demoSettledTrades:sample});
 assert.equal(r.state,'BLOCKED');
 assert.equal(r.samples,0);
 assert.equal(r.beepAllowed,false);
});
