'use strict';
/**
 * SCALP ATLAS - OWN NUMERIC LIVE RESEARCH ENGINE, v0.1
 *
 * Broker-independent computations over NUMERIC OHLC values, not pixels.
 * Crucial: NO authorized, verified Pocket Option OTC numeric LIVE feed is
 * connected today. This is a stand-alone RESEARCH observation module.
 * NEVER wire its output directly to the overlay bip or to a trade API.
 *
 * Candle timestamps must be true UTC bucket opens; no guessed vendor offset.
 */
const TF=300,MIN_BARS=32;
function abstain(reason,more={}) {
  return {state:'WAIT',reason,observation:'NONE',suggestTrade:false,
    beepAllowed:false,orderAllowed:false,predictedWinProbability:null,...more};
}
function ema(values,n) {
  const alpha=2/(n+1);let result=values[0];
  for(let i=1;i<values.length;i++) result=alpha*values[i]+(1-alpha)*result;
  return result;
}
function median(numbers) {
  const s=[...numbers].sort((a,b)=>a-b);
  return s[Math.floor(s.length/2)];
}
function ownNumericObservation({symbol,bars,lastTick,nowSeconds,timeframeSeconds=TF}={}) {
  if(!/^[A-Z0-9#]{3,24}_otc$/.test(symbol||'')||timeframeSeconds!==TF)
    return abstain('SYMBOL_OR_M5_TIMEFRAME_REQUIRED');
  if(!Array.isArray(bars)||bars.length<MIN_BARS)
    return abstain('NEED_32_CLOSED_M5_CANDLES');
  if(!Number.isSafeInteger(nowSeconds)||!lastTick||
     lastTick.symbol!==symbol||!Number.isSafeInteger(lastTick.time)||
     !Number.isFinite(lastTick.price)||lastTick.price<=0||
     lastTick.time>nowSeconds+2||nowSeconds-lastTick.time>12)
    return abstain('LIVE_NUMERIC_TICK_MISSING_OR_STALE');
  const rows=bars.slice(-MIN_BARS);
  let before=null;
  for (const b of rows) {
    if(!b||b.symbol!==symbol||b.complete!==true||!Number.isSafeInteger(b.time)||
       b.time%TF!==0||![b.open,b.high,b.low,b.close].every(x=>Number.isFinite(x)&&x>0)||
       b.high<Math.max(b.open,b.close)||b.low>Math.min(b.open,b.close)||
       (before&&b.time-before.time!==TF))
      return abstain('INVALID_OR_MISSING_CLOSED_OHLC');
    before=b;
  }
  const last=rows.at(-1),second=rows.at(-2),activeBucket=Math.floor(lastTick.time/TF)*TF;
  if (activeBucket!==last.time+TF || nowSeconds-lastTick.time>12)
    return abstain('CANDLES_AND_LIVE_TICK_NOT_ALIGNED');
  // Never use an active candle as a closed strategy input.
  const values=rows.map(b=>b.close),f=ema(values,9),s=ema(values,21);
  const body=median(rows.slice(-16,-2).map(b=>Math.abs(b.close-b.open)));
  const tr=rows.map((b,i)=>Math.max(b.high-b.low,
    Math.abs(b.high-(i?rows[i-1].close:b.open)),
    Math.abs(b.low-(i?rows[i-1].close:b.open))));
  const atr=median(tr.slice(-15,-1));
  if(!Number.isFinite(atr)||atr<=0||body<=0)
    return abstain('NO_MEANINGFUL_VOLATILITY');
  const buy=last.close>last.open&&second.close>second.open&&f>s&&last.close>s;
  const sell=last.close<last.open&&second.close<second.open&&f<s&&last.close<s;
  if(!buy&&!sell)return abstain('DIRECTION_NOT_CONFIRMED_BY_TWO_CLOSED_CANDLES');
  const dir=buy?'BUY':'SELL';
  // Avoid a large last candle and extrapolating an exhausted impulse.
  if(Math.abs(last.close-last.open)>2.3*body)
    return abstain('OVERSIZED_LAST_CLOSED_CANDLE');
  const recent=rows.slice(-12),high=Math.max(...recent.map(b=>b.high)),
    low=Math.min(...recent.map(b=>b.low));
  if (dir==='SELL' && (last.close-low)<=atr*.55)
    return abstain('SELL_TOO_CLOSE_TO_RECENT_LOW');
  if (dir==='BUY' && (high-last.close)<=atr*.55)
    return abstain('BUY_TOO_CLOSE_TO_RECENT_HIGH');
  // A contradictory movement since the last close may be an actual rebound.
  if(dir==='SELL' && lastTick.price>last.close+atr*.35)
    return abstain('SELL_OPPOSED_BY_CURRENT_TICK');
  if(dir==='BUY' && lastTick.price<last.close-atr*.35)
    return abstain('BUY_OPPOSED_BY_CURRENT_TICK');
  return {state:'LAB_OBSERVATION_ONLY',observation:dir,
    reason:'UNCALIBRATED_NUMERIC_M5_ENSEMBLE_REQUIRES_REAL_FEED_VERIFICATION',
    timeframeSeconds:TF,calculatedFromClosedBars:MIN_BARS,
    atrProxy:atr,ema9:f,ema21:s,lastClosedBarTime:last.time,
    lastLiveTickTime:lastTick.time,
    suggestTrade:false,beepAllowed:false,orderAllowed:false,
    predictedWinProbability:null};
}
function assessSignalRelease({feedMatchesBroker=false,sourceAuthorized=false,
  demoSettledTrades=[],payout=0.92}={}) {
  // This stage CANNOT generate a bip. It only measures readiness for future
  // independently reviewed development and leaves all trading features OFF.
  if(!sourceAuthorized||!feedMatchesBroker)
    return {state:'BLOCKED',reason:'LIVE_SOURCE_NOT_PROVEN_COMPATIBLE',beepAllowed:false};
  if(!Number.isFinite(payout)||payout<=0||payout>1)
    return {state:'BLOCKED',reason:'INVALID_PAYOUT',beepAllowed:false};
  const usable=demoSettledTrades.filter(x=>x&&['WIN','LOSS'].includes(x.outcome)&&
    x.verifiedDemo===true);
  if(usable.length<200)
    return {state:'BLOCKED',reason:'LESS_THAN_200_VERIFIED_DEMO_SETTLEMENTS',
      samples:usable.length,breakEvenWinRate:1/(1+payout),beepAllowed:false};
  const wins=usable.filter(x=>x.outcome==='WIN').length;
  const loss=usable.length-wins,winRate=wins/usable.length,expectedNet=winRate*payout-(1-winRate);
  return {state:'RESEARCH_METRICS_ONLY',reason:'REVIEW_OUT_OF_SAMPLE_AND_QUOTE_PROVENANCE',
    samples:usable.length,wins,loss,winRate,payout,breakEvenWinRate:1/(1+payout),
    expectedNetPerUnitRisk:expectedNet,beepAllowed:false};
}
module.exports={ownNumericObservation,assessSignalRelease};
