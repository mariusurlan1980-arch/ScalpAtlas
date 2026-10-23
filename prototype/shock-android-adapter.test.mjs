import assert from 'node:assert/strict';
import {createShockLiveAdapter} from './shock-android-adapter.mjs';
const beeps=[];
const adapter=createShockLiveAdapter({onAlert:({side})=>beeps.push(side),detectorOptions:{minPullbackFraction:.01,minReboundFraction:.003,minPullbackMs:100,maxPullbackMs:5000,minConfirmTicks:2}});
const prices=[100,102,100,98,98.4,98.8,99];
prices.forEach((price,i)=>adapter.onQuote({instrument:'EUR/TRY OTC',timeframe:'M5',candleId:'c1',price,timestamp:100000+i*200}));
// Old data should not beep, and invalid data should reset the candidate.
assert.deepEqual(beeps,[],'stale test quotes should not generate alerts');
const now=Date.now();
prices.forEach((price,i)=>adapter.onQuote({instrument:'EUR/TRY OTC',timeframe:'M5',candleId:'c2',price,timestamp:now-1200+i*200}));
assert.deepEqual(beeps,['BUY']);
console.log('Android adapter callback test passed');
