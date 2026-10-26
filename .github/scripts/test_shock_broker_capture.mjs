/**
 * Offline regression of the ACTUAL HTML engine bundled in the Android APK.
 * Screenshots below are synthetic, not evidence of live broker accuracy.
 */
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const html = fs.readFileSync('scalp-atlas-new/android/app/src/main/assets/analysis_engine.html', 'utf8');
const match = html.match(/<script>([\s\S]*?)<\/script>/);
assert.ok(match, 'Native broker analyzer script absent');
const width = 520;
const height = 420;
let current = null;
let now = Date.UTC(2026,9,25,17,0,0);
let frameId = 0;
const results = [];
const colors = {BUY:[39,209,120],SELL:[224,55,64]};

function paintRect(p,x1,y1,x2,y2,color){
  for(let y=Math.max(0,y1);y<=Math.min(height-1,y2);y++){
    for(let x=Math.max(0,x1);x<=Math.min(width-1,x2);x++){
      const i=(y*width+x)*4;
      p[i]=color[0];p[i+1]=color[1];p[i+2]=color[2];p[i+3]=255;
    }
  }
}
function candle(p,x,open,close,dir){
  const color=colors[dir];
  paintRect(p,x,Math.min(open,close),x+8,Math.max(open,close),color);
  paintRect(p,x+4,Math.min(open,close)-8,x+4,Math.max(open,close)+8,color);
}
function screen(close,dir='BUY',verticalShift=0){
  const p=new Uint8ClampedArray(width*height*4);
  for(let i=0;i<p.length;i+=4){p[i]=12;p[i+1]=18;p[i+2]=29;p[i+3]=255;}
  candle(p,322,195,164,'BUY');candle(p,353,150,197,'SELL');
  candle(p,391,(dir==='BUY'?230:165)+verticalShift,close+verticalShift,dir);
  return p;
}
const ctx={
  drawImage(){},
  getImageData(){return {data:current};}
};
const canvas={width:0,height:0,getContext(){return ctx;}};
const hostWindow={};
class FakeImage{
  width=width;
  height=height;
  set src(value){assert.ok(value);if(this.onload)this.onload();}
}
vm.runInNewContext(match[1],{
  window:hostWindow,
  document:{getElementById(){return canvas;}},
  Image:FakeImage,
  AndroidBridge:{postMessage(raw){results.push(JSON.parse(raw));}},
  Date:{now(){return now;}},
  console,
  Uint8ClampedArray,
  Number,
  Math
}, {timeout:5000});
assert.ok(results.some(r=>r.type==='READY'), 'Live WebView analyzer not ready');

function analyze(close,dir='BUY',pair='EUR/USD OTC',epoch=2,tf='M5',verticalShift=0){
  current=screen(close,dir,verticalShift);
  now+=1000;
  const id=++frameId;
  hostWindow.ScalpAtlasAnalyze('synthetic-jpeg',tf,id,pair,epoch);
  const result=results.at(-1);
  assert.equal(result.type,'RESULT');
  assert.equal(result.result.frameId,id);
  assert.equal(result.result.brokerPair,pair);
  assert.equal(result.result.marketEpoch,epoch);
  assert.equal(result.result.source,'ANDROID_SCREEN_CAPTURE');
  return result.result;
}
function assertQuiet(result){
  assert.equal(result.shockDirection,'NONE');
  assert.equal(result.shockOpticalVerified,false);
}
for(let i=0;i<8;i++)assertQuiet(analyze(140,'BUY'));
let buy;
for(const close of [140,146,155,169,155,140,136]){
  buy=analyze(close,'BUY');
}
assert.equal(buy.shockDirection,'BUY','Green candle down retracement + recovery must be recognized');
assert.equal(buy.shockSameCandle,true);
assert.ok(buy.quality>=55);
assert.equal(buy.expiry,5);
// Different asset has identical-looking pixels but must not inherit history.
assertQuiet(analyze(136,'BUY','GBP/USD OTC',3));
assertQuiet(analyze(136,'BUY','GBP/USD OTC',4)); // same pair, new epoch
assertQuiet(analyze(136,'BUY','GBP/USD OTC',4,'M10')); // interval changed
// Synthetic red upward retracement and downward recovery.
let sell;
for(const close of [229,226,211,190,209,233,239])sell=analyze(close,'SELL','GBP/USD OTC',5,'M5');
assert.equal(sell.shockDirection,'SELL','Red candle upward retracement + recovery must be recognized');
assert.equal(sell.shockOpticalVerified,true);
// Loss of optical pixels disables alerts. This also drops old history.
current=new Uint8ClampedArray(width*height*4);
now+=1000;
hostWindow.ScalpAtlasAnalyze('blank','M5',++frameId,'GBP/USD OTC',5);
assertQuiet(results.at(-1).result);
assertQuiet(analyze(239,'SELL','GBP/USD OTC',5,'M5'));
// The actual user's M10 chart placed the last candle below 74% of crop.
let bottom;
for(let i=0;i<8;i++) bottom=analyze(212,'BUY','AUD/NZD OTC',40,'M10',120);
assert.equal(bottom.candleDetected,true);
assert.equal(bottom.observedCandleDirection,'BUY');
assert.ok(bottom.observedCandleX>390);
assert.ok(bottom.opticalQuality>0 && bottom.opticalQuality<=99);
assert.equal(bottom.shockDirection,'NONE','Color and optical percentage are NOT a trade signal');
for(const close of [212,214,228,244,230,211,208])
  bottom=analyze(close,'BUY','AUD/NZD OTC',40,'M10',120);
assert.equal(bottom.shockDirection,'BUY','Latest low M10 candle shock detected');
console.log('PASS: native analyzer BUY/SELL; bottom M10 candle optical quality; stale context and blank frame rejection');
