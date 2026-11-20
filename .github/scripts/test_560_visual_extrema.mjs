import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

const src=readFileSync(new URL('../../scalp-atlas-new/shockNativeEngine.ts',import.meta.url),'utf8');
const start=src.indexOf('  function visualLocalExtremeHint560(');
const end=src.indexOf('  function colorBodyBounds560(',start);
assert.ok(start>0 && end>start,'560 optical hint missing');
const hint=vm.runInNewContext(src.slice(start,end)+'\nvisualLocalExtremeHint560;');
const olderLow=[
 {dir:'SELL',top:90,bottom:110},
 {dir:'SELL',top:100,bottom:120},
 {dir:'SELL',top:110,bottom:130}
];
const olderHigh=[
 {dir:'BUY',top:80,bottom:100},
 {dir:'BUY',top:70,bottom:90},
 {dir:'BUY',top:60,bottom:80}
];
test('BUY hint only at a local LOW (larger screen Y) after red -> green',()=>{
 assert.equal(hint(olderLow,{dir:'BUY',top:115,bottom:135},'BUY'),'LOCAL_MIN_HINT');
});
test('SELL hint only at a local HIGH (smaller screen Y) after green -> red',()=>{
 assert.equal(hint(olderHigh,{dir:'SELL',top:56,bottom:75},'SELL'),'LOCAL_MAX_HINT');
});
test('no BUY hint if first green is not near recent lowest body',()=>{
 assert.equal(hint(olderLow,{dir:'BUY',top:105,bottom:120},'BUY'),'NONE');
});
test('no SELL hint if first red is not near recent highest body',()=>{
 assert.equal(hint(olderHigh,{dir:'SELL',top:75,bottom:90},'SELL'),'NONE');
});
test('must have three prior bars',()=>{
 assert.equal(hint(olderLow.slice(1),{dir:'BUY',top:115,bottom:135},'BUY'),'NONE');
});
test('the bar immediately before the green reversal must be red',()=>{
 assert.equal(hint([...olderLow.slice(0,2),{dir:'BUY',top:110,bottom:130}],{dir:'BUY',top:115,bottom:135},'BUY'),'NONE');
});
test('need at least two opposite-color prior bars',()=>{
 const mixed=[olderLow[0],{dir:'BUY',top:100,bottom:120},olderLow[2]];
 assert.equal(hint(mixed,{dir:'BUY',top:115,bottom:135},'BUY'),'LOCAL_MIN_HINT');
 const insufficient=[{dir:'BUY',top:90,bottom:110},{dir:'BUY',top:100,bottom:120},olderLow[2]];
 assert.equal(hint(insufficient,{dir:'BUY',top:115,bottom:135},'BUY'),'NONE');
});
test('rejects unconfirmed/minuscule body pixel geometry',()=>{
 assert.equal(hint(olderLow,{dir:'BUY',top:135,bottom:136},'BUY'),'NONE');
});
test('candle color must match intended side',()=>{
 assert.equal(hint(olderLow,{dir:'BUY',top:115,bottom:135},'SELL'),'NONE');
});
test('this optical hint remains READ-ONLY and cannot become order strategy',()=>{
 assert.ok(src.includes('localReversalPreview560:localReversalPreview560'));
 assert.ok(src.includes('var localReversalPreview560=sameColorPreview559!==null'));
 assert.ok(!src.includes("strategy:localReversalPreview560"));
 const android=readFileSync(new URL('../native-overlay/ScalpOverlayService.kt',import.meta.url),'utf8');
 assert.ok(android.includes('val localReversalPreview560 = previewSecond559'));
 assert.ok(android.includes('TEST FĂRĂ ORDIN'));
 assert.ok(!android.includes('confirmedSignal = if (localReversalPreview560'));
 assert.ok(!android.includes('eligibleSignal547 = eligibleSignal547 || localReversalPreview560'));
});
