// Synthetic pixel regression for DEMO trend/pullback gating, not trading performance.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync('.github/templates/ScalpAtlasAnalysisEngineV0416.ts','utf8');
const native=fs.readFileSync('.github/native-overlay/ScalpOverlayService.kt','utf8');
const first=source.indexOf('  function candleEvidence(curve,wantedDirection){');
const last=source.indexOf('  function classify(curve){',first);
assert.ok(first>=0&&last>first,'optical candle and trend functions present');
const definitions=source.slice(first,last);
const W=420,H=240;
const colors={BUY:[20,220,90],SELL:[218,42,44]};
function testFrame(sequence){
  const px=new Uint8ClampedArray(W*H*4);
  for(let i=0;i<px.length;i+=4){px[i]=14;px[i+1]=22;px[i+2]=35;px[i+3]=255;}
  sequence.forEach((color,j)=>{
    const rgb=colors[color],x=70+j*30,y=75+j%3*4;
    for(let xx=x;xx<x+8;xx++)for(let yy=y;yy<y+20;yy++){
      const i=(yy*W+xx)*4;
      px[i]=rgb[0];px[i+1]=rgb[1];px[i+2]=rgb[2];
    }
  });
  const ctx={getImageData(){return {data:px};}};
  const functions=vm.runInNewContext(definitions+';({candleEvidence,trendPullbackEvidence})',{ctx});
  return direction=>functions.trendPullbackEvidence(
    {w:W,h:H},direction,functions.candleEvidence({w:W,h:H},direction));
}
const buyPullback=testFrame(['BUY','BUY','BUY','SELL','BUY','BUY','BUY']);
assert.equal(buyPullback('BUY').ok,true,'BUY pullback confirmed by two closed BUY candles');
assert.equal(buyPullback('SELL').ok,false,'BUY frame never confirms SELL');
assert.match(buyPullback('BUY').pattern,/Retragere BUY/);
const sellPullback=testFrame(['SELL','SELL','SELL','BUY','SELL','SELL','SELL']);
assert.equal(sellPullback('SELL').ok,true,'SELL pullback confirmed');
assert.equal(sellPullback('BUY').ok,false,'SELL frame never confirms BUY');
const continuation=testFrame(['SELL','BUY','BUY','BUY','BUY','BUY','BUY']);
assert.equal(continuation('BUY').ok,true,'uninterrupted confirmed trend is allowed');
assert.match(continuation('BUY').pattern,/Continuare trend BUY/);
const conflicting=testFrame(['BUY','BUY','SELL','BUY','BUY','SELL','BUY']);
assert.equal(conflicting('BUY').ok,false,'different closed colours reject');
assert.equal(testFrame([])('SELL').ok,false,'blank screen rejects');
assert.equal(testFrame(['BUY','BUY','BUY'])('BUY').ok,false,'too few candles reject');
assert.match(source,/marketRegime==='TENDINTA'/,'mixed, flat and uncertain charts rejected');
assert.match(source,/opticalCandleGate:!!evidence.ok&&clear/,'optical confirmation still required');
assert.match(source,/trendPullbackGate:!!clear&&!!trendSetup/,'trend requires final classifier');
assert.match(source,/expiry:clear\?\(String\(timeframe\)==='M10'\?10/,'M10 demo expiry exactly 10 minutes');
assert.match(native,/\(wickGate \|\| trendGate\) && readableTrend/,'native audio requires trend AND optical evidence');
assert.match(native,/if \(expiry in 5\.\.15\) expiry else 10/,'native lock respects M10');
assert.doesNotMatch(native,/dispatchGesture|placeDemoOrder|performGlobalAction/,'no automatic trading');
console.log('PASS: synthetic BUY/SELL pullback, trend continuation, invalid frames, and M10 native guard.');
