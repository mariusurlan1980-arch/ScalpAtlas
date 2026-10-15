// Synthetic, deterministic image/curve tests for the three supported LIVE
// M10 DEMO setups. This does NOT measure broker performance or WIN rate.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync('.github/templates/ScalpAtlasAnalysisEngineV0416.ts','utf8');
const native=fs.readFileSync('.github/native-overlay/ScalpOverlayService.kt','utf8');
const first=source.indexOf('  function linReg(arr){');
const last=source.indexOf('  function classify(curve){',first);
assert.ok(first>=0&&last>first,'three optical setups exist');
const functions=source.slice(first,last);
const W=420,H=240;

function scene(sequence,ys=null){
  const pixels=new Uint8ClampedArray(W*H*4);
  for(let i=0;i<pixels.length;i+=4){
    pixels[i]=14;pixels[i+1]=22;pixels[i+2]=35;pixels[i+3]=255;
  }
  sequence.forEach((colour,j)=>{
    const [r,g,b]=colour==='BUY'?[20,220,90]:[218,42,44];
    const x=70+j*30,y=75+(j%3)*4;
    for(let xx=x;xx<x+8;xx++)for(let yy=y;yy<y+20;yy++){
      const k=(yy*W+xx)*4;
      pixels[k]=r;pixels[k+1]=g;pixels[k+2]=b;
    }
  });
  const ctx={getImageData(){return {data:pixels};}};
  const fn=vm.runInNewContext(functions+
    ';({candleEvidence,trendPullbackEvidence,simpleScalpContext,extremeReversalEvidence})',{ctx});
  const values=ys||Array.from({length:18},(_,i)=>120-i*2);
  const pts=values.map((y,i)=>({x:50+i*18,y,lo:y-5,hi:y+5,span:10,n:9}));
  const curve={w:W,h:H,pts,quality:.8,
    spanCoverage:(pts.at(-1).x-pts[0].x)/W,anchor:pts.at(-1)};
  function trend(dir){
    const bars=fn.candleEvidence(curve,dir);
    return fn.trendPullbackEvidence(curve,dir,bars);
  }
  function extreme(dir){
    const bars=fn.candleEvidence(curve,dir);
    return fn.extremeReversalEvidence(curve,dir,bars,fn.simpleScalpContext(curve));
  }
  return {trend,extreme};
}

const buyPullback=scene(['BUY','BUY','BUY','SELL','BUY','BUY','BUY']);
assert.equal(buyPullback.trend('BUY').ok,true,'BUY pullback has two agreeing closed bars');
assert.match(buyPullback.trend('BUY').pattern,/Retragere BUY/);
assert.equal(buyPullback.trend('SELL').ok,false,'BUY setup never turns into SELL');
const sellPullback=scene(['SELL','SELL','SELL','BUY','SELL','SELL','SELL']);
assert.equal(sellPullback.trend('SELL').ok,true,'SELL pullback confirmed');
const scalpTrend=scene(['SELL','BUY','BUY','BUY','BUY','BUY','BUY']);
assert.equal(scalpTrend.trend('BUY').ok,true,'scalp trend continuation confirmed');
assert.match(scalpTrend.trend('BUY').pattern,/Continuare trend BUY/);
const mixed=scene(['BUY','BUY','SELL','BUY','BUY','SELL','BUY']);
assert.equal(mixed.trend('BUY').ok,false,'mixed closed bar colours block entry');
assert.equal(scene([]).trend('SELL').ok,false,'empty chart cannot signal');
assert.equal(scene(['BUY','BUY','BUY']).trend('BUY').ok,false,'short chart cannot signal');

const buyPrices=[92,94,96,99,104,110,116,121,126,132,140,134,124,113,105,98,92,88];
const sellPrices=[145,143,141,135,130,125,117,112,106,100,94,99,109,118,126,133,140,144];
const lows=scene(['SELL','SELL','SELL','SELL','BUY','BUY','BUY'],buyPrices);
const highs=scene(['BUY','BUY','BUY','BUY','SELL','SELL','SELL'],sellPrices);
assert.equal(lows.extreme('BUY').ok,true,'minimum followed by confirmed rebound allows BUY');
assert.match(lows.extreme('BUY').pattern,/Minim local/);
assert.equal(lows.extreme('SELL').ok,false,'minimum cannot be SELL');
assert.equal(highs.extreme('SELL').ok,true,'maximum followed by confirmed descent allows SELL');
assert.match(highs.extreme('SELL').pattern,/Maxim local/);
assert.equal(highs.extreme('BUY').ok,false,'maximum cannot be BUY');
const noTurn=scene(['SELL','SELL','SELL','SELL','BUY','BUY','BUY'],
  Array.from({length:18},(_,i)=>150-i*3));
assert.equal(noTurn.extreme('BUY').ok,false,'no turning point, no reversal signal');

assert.doesNotMatch(source,/const base=classify\(curve\)/,
  'legacy 70 pattern classifier is not used by live signals');
assert.match(source,/const context=simpleScalpContext\(curve\)/,
  'only simplified live regime is used');
assert.match(source,/marketRegime=chosenExtreme\?'REVERSARE'/,
  'extrema are tagged separately from trend continuation');
assert.match(source,/opticalCandleGate:!!evidence.ok&&clear/,
  'a signal needs valid optical candles');
assert.match(source,/trendPullbackGate:!!clear&&setup===chosenTrend/,
  'trend setup gated separately');
assert.match(source,/extremeReversalGate:!!clear&&setup===chosenExtreme/,
  'reversal setup gated separately');
assert.match(source,/expiry:clear\?\(String\(timeframe\)==='M10'\?10/,
  'M10 expiration is ten minutes');
assert.match(native,/\(extremeGate && regime == "REVERSARE"\)/,
  'Kotlin permits only explicit verified extrema');
assert.match(native,/val allowedSetup =/,
  'native audio remains gated');
assert.doesNotMatch(native,/dispatchGesture|placeDemoOrder|performGlobalAction/,
  'no automated broker trades');
console.log('PASS: 3 DEMO setups, two closed candles, direction gates, extrema turning and negative cases.');
