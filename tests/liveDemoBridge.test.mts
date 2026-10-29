import test from 'node:test';
import assert from 'node:assert/strict';
import { AutoDemoEngine } from '../scalp-atlas-new/autoDemoEngine.ts';
import { submitLiveSignalToDemo } from '../scalp-atlas-new/liveDemoBridge.ts';

const event = { market:'EUR/USD OTC', timeframe:'M10', signal:'BUY', state:'SIGNAL', probability:90, observedAt:1_000_000, price:1.1, chartValid:true };
test('confirmed LIVE event starts simulated trade',()=>{
 const engine=new AutoDemoEngine(()=>1_000_000);
 const result=submitLiveSignalToDemo(engine,event);
 assert.equal(result.accepted,true);
 assert.equal(engine.getHistory().length,1);
});
test('no verified quote prevents simulated trade',()=>{
 const engine=new AutoDemoEngine(()=>1_000_000);
 assert.equal(submitLiveSignalToDemo(engine,{...event,price:null}).accepted,false);
 assert.equal(engine.getHistory().length,0);
});
test('unsupported timeframe and unconfirmed state are rejected',()=>{
 const engine=new AutoDemoEngine(()=>1_000_000);
 assert.equal(submitLiveSignalToDemo(engine,{...event,timeframe:'M1'}).accepted,false);
 assert.equal(submitLiveSignalToDemo(engine,{...event,state:'WAIT'}).accepted,false);
});
