import {toShockObservation} from './shockChartAdapter';
const assert=(ok:boolean,msg:string)=>{if(!ok)throw new Error(msg);};
const base={marketId:'EUR/USD',timeframeMinutes:10,candleStartMs:600000,observedAtMs:602000,open:100,high:101,low:99,close:100,chartVerified:true,ohlcVerified:true};
assert(toShockObservation(base)?.sourceConfirmed===true,'verified candle accepted');
assert(toShockObservation({...base,ohlcVerified:false})===null,'unverified OCR rejected');
assert(toShockObservation({...base,chartVerified:false})===null,'non-chart rejected');
assert(toShockObservation({...base,timeframeMinutes:30})===null,'unsupported TF rejected');
assert(toShockObservation({...base,observedAtMs:1200000})===null,'closed candle rejected');
assert(toShockObservation({...base,low:102})===null,'invalid candle rejected');
