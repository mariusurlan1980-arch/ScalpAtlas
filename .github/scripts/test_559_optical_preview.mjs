import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';

// Exercise the exact JS implementation embedded in the native optical engine.
const source = readFileSync(new URL('../../scalp-atlas-new/shockNativeEngine.ts', import.meta.url), 'utf8');
const beginning = source.indexOf('  function sameColorSecondPullbackPreview559(');
const ending = source.indexOf('  function send(obj)', beginning);
assert.ok(beginning >= 0 && ending > beginning, '559 optical function missing');
const fn = vm.runInNewContext(source.slice(beginning, ending) + '\n sameColorSecondPullbackPreview559;');
const t = 20_000;
const green = {dir:'BUY', previousCandleDirection:'BUY', previousBodyHeight:10, opticalQuality:85, x:200};
const red = {dir:'SELL',previousCandleDirection:'SELL',previousBodyHeight:10,opticalQuality:85,x:200};
const sample = (ys, dir='BUY', starts=10_000) => ys.map((y,i)=>({y,t:starts+i*1_000,dir,x:200}));
const check=(c,s,now=13_000)=>fn(c,s,now,7);

test('early BUY: green+green, small pullback and rebound at 3 seconds',()=>{
 const result=check(green,sample([100,100,105,102]));
 assert.equal(result.direction,'BUY'); assert.equal(result.retreatPixels,5);
 assert.equal(result.recoveryPixels,3);
});
test('early SELL: red+red and small rebound',()=>{
 const result=check(red,sample([100,100,95,98],'SELL'));
 assert.equal(result.direction,'SELL');assert.equal(result.retreatPixels,5);
});
test('opposite colors do not pass',()=>assert.equal(check({...green,previousCandleDirection:'SELL'},sample([100,100,105,102])),null));
test('red forming second with green prior does not pass',()=>assert.equal(check({...green,dir:'SELL'},sample([100,100,95,98],'SELL')),null));
test('no signal if movement goes in one direction only',()=>assert.equal(check(green,sample([105,104,103,102])),null));
test('no signal without rebound',()=>assert.equal(check(green,sample([100,101,105,105])),null));
test('no signal when price returns to previous extreme',()=>assert.equal(check(green,sample([100,100,105,100])),null));
test('retreat of fewer than 3 optical pixels rejected',()=>assert.equal(check(green,sample([100,100,102,101])),null));
test('insufficient verified screen observations rejected',()=>assert.equal(check(green,sample([100,105,102])),null));
test('wrong or unconfirmed optical quality rejected',()=>assert.equal(check({...green,opticalQuality:70},sample([100,100,105,102])),null));
test('different live candle X rejected',()=>{
 const s=sample([100,100,105,102]);s[2].x=300;assert.equal(check(green,s),null);
});
test('stale frames are rejected',()=>assert.equal(check(green,sample([100,100,105,102], 'BUY',0),30_000),null));
test('candidate field never replaces the existing order strategy',()=>{
 assert.ok(source.includes('secondSameColorPreview559:sameColorPreview559!==null'));
 assert.ok(!source.includes("strategy:sameColorPreview559"));
 const kt=readFileSync(new URL('../native-overlay/ScalpOverlayService.kt', import.meta.url),'utf8');
 assert.ok(kt.includes('val previewSecond559 ='));
 assert.ok(kt.includes('TEST FĂRĂ ORDIN'));
 assert.ok(!kt.includes('confirmedSignal = if (previewSecond559'));
});
