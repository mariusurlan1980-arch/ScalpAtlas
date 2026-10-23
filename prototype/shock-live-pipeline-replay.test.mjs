import assert from 'node:assert/strict';
import {ShockLivePipeline} from './shock-live-pipeline.mjs';
const config={minPullbackFraction:.01,minReboundFraction:.003,minPullbackMs:100,maxPullbackMs:5000,minConfirmTicks:2};
function run(prices,{instrument='EUR/TRY OTC',timeframe='M5',candleId='1'}={}){
 const alerts=[];const pipeline=new ShockLivePipeline({detectorOptions:config,onAlert:x=>alerts.push(x)});
 const results=prices.map((price,i)=>pipeline.ingest({instrument,timeframe,candleId,price,timestamp:100000+i*200},100000+i*200));
 return {alerts,results,pipeline};
}
assert.deepEqual(run([100,102,100,98,98.4,98.8]).alerts.map(x=>x.side),['BUY']);
assert.deepEqual(run([100,98,100,102,101.6,101.2]).alerts.map(x=>x.side),['SELL']);
assert.equal(run([100,102,100,98,97,96]).alerts.length,0);
assert.equal(run([100,102,100,98,98.4,98.8,99,99.5]).alerts.length,1);
const a=run([100,102,100,98,98.4,98.8]);
assert.equal(a.pipeline.ingest({broker:'Pocket Option',marketMode:'OTC',instrument:'EUR/TRY OTC',timeframe:'M5',candleId:'1',price:100,timestamp:100200},102000).state,'WAIT');
assert.equal(a.pipeline.ingest({broker:'Pocket Option',marketMode:'OTC',instrument:'EUR/TRY OTC',timeframe:'M5',candleId:'1',price:100,timestamp:105000},110000).state,'WAIT');
console.log('SHOCK LIVE BUY SELL pipeline replay tests passed');
