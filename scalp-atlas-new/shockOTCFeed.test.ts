import { validateLiveTick,normalizeCompletedOTCCandles,OTC_CLOCK_OFFSET_SECONDS } from './shockOTCFeed';
const now=1780000000000;
const ok=validateLiveTick({symbol:'EURUSD_otc',price:1.12345,time:now/1000},'EURUSD_otc',now,10);
if(!ok.ok||ok.tick.price!==1.12345)throw new Error('tick valid');
if(validateLiveTick({symbol:'EURUSD_otc',price:1.12345,time:now/1000-10},'EURUSD_otc',now,10).ok)throw new Error('stale');
if(validateLiveTick({symbol:'GBPUSD_otc',price:1.12345,time:now/1000},'EURUSD_otc',now,10).ok)throw new Error('wrong market');
if(validateLiveTick({symbol:'EURUSD_otc',price:NaN,time:now/1000},'EURUSD_otc',now,10).ok)throw new Error('invalid');
const aligned=Math.floor(now/(10*60000))*(10*60000);
const history=normalizeCompletedOTCCandles({candles:[
 {time:(aligned-1200000)/1000+OTC_CLOCK_OFFSET_SECONDS,open:1,high:1.2,low:0.9,close:1.1},
 {time:(aligned-600000)/1000+OTC_CLOCK_OFFSET_SECONDS,open:1.1,high:1.3,low:1,close:1.2},
 {time:aligned/1000+OTC_CLOCK_OFFSET_SECONDS,open:1.2,high:1.3,low:1,close:1.15},
]},now,10);
if(history.length!==2||history[0].startMs!==aligned-1200000||history[1].startMs!==aligned-600000) throw new Error('historical complete bars only');
console.log('OTC third-party feed parser checks OK');
