import { ShockOnlyDetector } from './shockOnlyDetector';

// Deterministic replay test; run with a TypeScript-capable test runner.
// Validates: one alert per candle, no alert on first frame, BUY and SELL reversal.
const detector = new ShockOnlyDetector({minimumRangeFraction:0.0001,recoveryFraction:0.6,minAgeMs:1000});
const base={timeframeMinutes:10 as const,sourceConfirmed:true,marketId:'EURUSD',open:100};
const assert=(condition:boolean,message:string)=>{if(!condition)throw new Error(message);};
assert(detector.observe({...base,candleId:'buy',timestampMs:100000,high:100,low:100,close:100})===null,'initial frame');
assert(detector.observe({...base,candleId:'buy',timestampMs:101000,high:100,low:99,close:99.2})===null,'fall first');
const buy=detector.observe({...base,candleId:'buy',timestampMs:102200,high:100.2,low:99,close:100.1});
assert(buy?.direction==='BUY','buy reversal');
assert(detector.observe({...base,candleId:'buy',timestampMs:103300,high:100.3,low:99,close:100.2})===null,'no repeated beep');
assert(detector.observe({...base,candleId:'sell',timestampMs:104000,high:100,low:100,close:100})===null,'new candle');
assert(detector.observe({...base,candleId:'sell',timestampMs:105000,high:101,low:100,close:100.8})===null,'rise first');
const sell=detector.observe({...base,candleId:'sell',timestampMs:106300,high:101,low:99.8,close:99.9});
assert(sell?.direction==='SELL','sell reversal');

assert(detector.observe({...base,marketId:'GBPUSD',candleId:'sell',timestampMs:107000,high:100,low:100,close:100})===null,'market change must reset');

const live = new ShockOnlyDetector({minimumRangeFraction:0.0001,recoveryFraction:0.6,minAgeMs:1000});
const initial=live.observeLive({...base,candleId:'live',timestampMs:110000,high:100,low:100,close:100});
assert(initial.intensityPercent===0 && initial.signal===null,'initial live percentage');
live.observeLive({...base,candleId:'live',timestampMs:111000,high:100,low:99,close:99.2});
const recovery=live.observeLive({...base,candleId:'live',timestampMs:112300,high:100.2,low:99,close:100.1});
assert(recovery.phase==='RECOVERING_BUY','live buy phase');
assert(recovery.intensityPercent>0 && recovery.intensityPercent<=100,'live recovery percent bounded');
assert(recovery.signal?.direction==='BUY','live signal');
const duplicate=live.observeLive({...base,candleId:'live',timestampMs:113500,high:100.3,low:99,close:100.2});
assert(duplicate.signal===null,'only one live alert per candle');
