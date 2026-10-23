// Scalp Atlas SHOCK-only signal detector (isolated test module).
// Requires live OHLC updates for the SAME currently-forming candle.
// A screenshot alone cannot reliably establish an intrabar shock/recovery.
export function createShockDetector({shockFraction=0.65,recoveryFraction=0.55,minRange=0.00001,cooldownMs=300000}={}) {
  const seen=new Map();
  return function detect({symbol,timeframe,candleId,open,high,low,close,previousClose,now=Date.now(),isLive=true}) {
    const nums=[open,high,low,close,previousClose,now];
    if(!isLive||!symbol||!timeframe||candleId==null||!nums.every(Number.isFinite)||high<low||close>high||close<low||open>high||open<low) return {signal:null,reason:"INVALID_OR_STALE"};
    const key=`${symbol}|${timeframe}`;
    const prior=seen.get(key);
    if(prior?.candleId===candleId&&prior?.emitted) return {signal:null,reason:"ALREADY_ALERTED"};
    if(prior?.emitted&&now-prior.lastAlertAt<cooldownMs) return {signal:null,reason:"COOLDOWN"};
    const range=high-low;
    if(range<minRange) return {signal:null,reason:"RANGE_TOO_SMALL"};
    // BUY: candle started bullish relative to prior close, plunged then recovered.
    // SELL: candle started bearish relative to prior close, spiked then retreated.
    const bullish=open>=previousClose;
    const bearish=open<=previousClose;
    const buyShock=(open-low)/range>=shockFraction;
    const sellShock=(high-open)/range>=shockFraction;
    const buyRecovery=(close-low)/range>=recoveryFraction&&close>open;
    const sellRecovery=(high-close)/range>=recoveryFraction&&close<open;
    const signal=bullish&&buyShock&&buyRecovery?"BUY":bearish&&sellShock&&sellRecovery?"SELL":null;
    if(signal) seen.set(key,{candleId,emitted:true,lastAlertAt:now});
    else if(!prior||prior.candleId!==candleId) seen.set(key,{candleId,emitted:false,lastAlertAt:prior?.lastAlertAt??-Infinity});
    return {signal,reason:signal?"CONFIRMED_SHOCK":"NO_CONFIRMED_SHOCK",beep:!!signal};
  };
}
