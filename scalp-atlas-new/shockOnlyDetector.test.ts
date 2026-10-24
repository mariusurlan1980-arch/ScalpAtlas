import { ShockOnlyDetector } from './shockOnlyDetector';

// Deterministic replay test; run with a TypeScript-capable test runner.
// Validates: one alert per candle, no alert on first frame, BUY and SELL reversal.
const detector = new ShockOnlyDetector({minimumRangeFraction:0.0001,recoveryFraction:0.6,minAgeMs:1000});
const base={timeframeMinutes:10 as const,sourceConfirmed:true,marketId:'EURUSD',open:100};
const assert=(condition:boolean,message:string)=>{if(!condition)throw new Error(message);};
assert(detector.observe({...base,candleId:'buy',timestampMs:0,high:100,low:100,close:100})===null,'initial frame');
assert(detector.observe({...base,candleId:'buy',timestampMs:1000,high:100,low:99,close:99.2})===null,'fall first');
const buy=detector.observe({...base,candleId:'buy',timestampMs:2200,high:100.2,low:99,close:100.1});
assert(buy?.direction==='BUY','buy reversal');
assert(detector.observe({...base,candleId:'buy',timestampMs:3300,high:100.3,low:99,close:100.2})===null,'no repeated beep');
assert(detector.observe({...base,candleId:'sell',timestampMs:4000,high:100,low:100,close:100})===null,'new candle');
assert(detector.observe({...base,candleId:'sell',timestampMs:5000,high:101,low:100,close:100.8})===null,'rise first');
const sell=detector.observe({...base,candleId:'sell',timestampMs:6300,high:101,low:99.8,close:99.9});
assert(sell?.direction==='SELL','sell reversal');

assert(detector.observe({...base,marketId:'GBPUSD',candleId:'sell',timestampMs:7000,high:100,low:100,close:100})===null,'market change must reset');
