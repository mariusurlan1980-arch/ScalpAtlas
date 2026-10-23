import assert from 'node:assert/strict';
import { ShockLiveDetector } from './shock-live-detector.mjs';

const config={minPullbackFraction:0.01,minReboundFraction:0.003,minPullbackMs:100,maxPullbackMs:5000,minConfirmTicks:2};
function replay(prices,candleId='c1'){
 const d=new ShockLiveDetector(config);
 return prices.map((price,i)=>d.update({candleId,price,timestamp:i*200})).filter(Boolean);
}
// The alert occurs on a rebound, not at the presumed bottom.
assert.deepEqual(replay([100,102,100,98,98.4,98.8]).map(x=>x.side),['BUY']);
assert.deepEqual(replay([100,98,100,102,101.6,101.2]).map(x=>x.side),['SELL']);
assert.equal(replay([100,102,100,98,97,96]).length,0,'continued drop must not alert');
assert.equal(replay([100,100.1,100.2,100.1,100.2]).length,0,'noise must not alert');
assert.equal(replay([100,102,100,98,98.4,98.8,99,99.5]).length,1,'no repeated alert');
const d=new ShockLiveDetector(config);
const stream=[
 ['a',100,0],['a',102,200],['a',100,400],['a',98,600],['a',98.4,800],['a',98.8,1000],
 ['b',100,1200],['b',102,1400],['b',100,1600],['b',98,1800],['b',98.4,2000],['b',98.8,2200]
];
assert.equal(stream.map(([candleId,price,timestamp])=>d.update({candleId,price,timestamp})).filter(Boolean).length,2,'reset on next candle');
console.log('SHOCK LIVE synthetic replay tests passed');
