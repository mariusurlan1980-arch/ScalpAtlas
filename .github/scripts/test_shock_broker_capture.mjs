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
function screen(close,dir='BUY',verticalShift=0,stickyWick=false,trendDir=dir){
  const p=new Uint8ClampedArray(width*height*4);
  for(let i=0;i<p.length;i+=4){p[i]=12;p[i+1]=18;p[i+2]=29;p[i+3]=255;}
  // Three prior CLOSED candles must provide a separately measurable trend,
  // never inferred solely from the active candle's color.
  if(trendDir==='BUY'){
    candle(p,314,255,232,'BUY');
    candle(p,342,225,202,'BUY');
    candle(p,369,196,170,'BUY');
  }else if(trendDir==='SELL'){
    candle(p,314,120,145,'SELL');
    candle(p,342,155,178,'SELL');
    candle(p,369,188,214,'SELL');
  }else if(trendDir==='BUY_WEAK'){
    // Genuine BUY direction, but slope below new 30% threshold.
    candle(p,314,262,232,'BUY');
    candle(p,342,258,228,'BUY');
    candle(p,369,254,224,'BUY');
  }else if(trendDir==='BUY_FLEX_428'){
    // 11px progress over 24px bodies = ~31%: now eligible with evidence.
    candle(p,314,256,232,'BUY');
    candle(p,342,250,226,'BUY');
    candle(p,369,245,221,'BUY');
  }else if(trendDir==='SELL_FLEX_428'){
    candle(p,314,120,145,'SELL');
    candle(p,342,125,150,'SELL');
    candle(p,369,131,156,'SELL');
  }else if(trendDir==='BUY_MODERATE'){
    candle(p,314,256,232,'BUY');
    candle(p,342,248,224,'BUY');
    candle(p,369,244,218,'BUY');
  }else if(trendDir==='SELL_MODERATE'){
    candle(p,314,120,145,'SELL');
    candle(p,342,127,152,'SELL');
    candle(p,369,134,159,'SELL');
  }else if(trendDir==='SELL_WEAK'){
    // Genuine SELL direction, but slope below new 30% threshold.
    candle(p,314,115,145,'SELL');
    candle(p,342,119,149,'SELL');
    candle(p,369,123,153,'SELL');
  }
  const open=(dir==='BUY'?230:165)+verticalShift;
  candle(p,391,open,close+verticalShift,dir);
  if(stickyWick){
    // Simulated wick that visibly remains after the candle recovers.
    const tip=dir==='BUY'?Math.min(Math.floor(height*.955),open+60):Math.max(Math.floor(height*.06),open-60);
    paintRect(p,395,Math.min(open,tip),395,Math.max(open,tip),colors[dir]);
  }
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

function analyze(close,dir='BUY',pair='EUR/USD OTC',epoch=2,tf='M5',verticalShift=0,stickyWick=false,trendDir=dir){
  current=screen(close,dir,verticalShift,stickyWick,trendDir);
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
  assert.equal(result.signal,'NONE','No SHOCK or SCALP TREND should be emitted');
  assert.equal(result.strategy,'NONE','No strategy should be emitted');
}
for(let i=0;i<8;i++)assertQuiet(analyze(140,'BUY'));
let buy;
for(const close of [110,128,181,219,211,172,159]){
  buy=analyze(close,'BUY','EUR/USD OTC',2,'M5',0,close===172||close===159);
}
assert.equal(buy.shockBlocker,'ȘOC CONFIRMAT');
assert.equal(buy.trendDirection,'BUY','BUY must match measured 3-closed-candle trend');
assert.equal(buy.trendMeasured,true);
assert.ok(buy.trendVisualPoints.length===3,'Mini trend has three observed closes');
assert.ok(buy.trendStrengthPercent>25 && buy.trendStrengthPercent<=100,'BUY trend >25%');
assert.equal(buy.trendThresholdPercent,25);
assert.ok(buy.trendVisualPoints[2]<buy.trendVisualPoints[0],'BUY mini line rises in price');
assert.equal(buy.shockThresholdPercent,30);
assert.equal(buy.shockObservedDurationMs,buy.shockDropDurationMs,'seconds must come from measured LIVE frames');
assert.ok(buy.shockObservedDurationMs>=300 && buy.shockObservedDurationMs<=18000);
assert.equal(buy.shockDirection,'BUY','Green candle down retracement + recovery must be recognized');
assert.equal(buy.shockSameCandle,true);
assert.ok(buy.quality>=55);
assert.ok(buy.shockRetracementPercent>30 && buy.shockRetracementPercent<=100,'BUY % is measured candle retreat');
assert.ok(buy.shockWickPercent>=15,'BUY must have visible lower wick');
assert.ok(buy.shockRecoveryPercent>=20,'BUY shock must rebound');
assert.ok(buy.shockDropDurationMs<=18000,'BUY must occur in <= 18 sec');
assert.equal(buy.expiry,5);
// 420: A genuine deep pullback can temporarily reverse the forming
// candle's color across its opening price. It must still be associated with
// the SAME live X and must REBOUND into the original trend with a real wick.
// No single-frame color flip is allowed to authorize a signal.
let colorFlipBuy;
for (const [close, direction, wick] of [
  [110, 'BUY', false],
  [128, 'BUY', false],
  [260, 'SELL', false],
  [172, 'BUY', true],
  [159, 'BUY', true]
]) {
  colorFlipBuy = analyze(close, direction,
    'EUR/JPY OTC', 6, 'M5', 0, wick, 'BUY');
}
assert.equal(colorFlipBuy.trendDirection,'BUY');
assert.equal(colorFlipBuy.shockDirection,'BUY',
  'Same-candle retracement crossing the open was incorrectly discarded');
assert.equal(colorFlipBuy.shockSameCandle,true);
assert.ok(colorFlipBuy.shockRecoveryPercent>=20);
assert.ok(colorFlipBuy.shockWickPercent>=15);

// Different asset has identical-looking pixels but must not inherit history.
assertQuiet(analyze(136,'BUY','GBP/USD OTC',3));
assertQuiet(analyze(136,'BUY','GBP/USD OTC',4)); // same pair, new epoch
assertQuiet(analyze(136,'BUY','GBP/USD OTC',4,'M10')); // interval changed
// Synthetic red upward retracement and downward recovery.
let sell;
for(const close of [280,262,215,174,181,220,235])
  sell=analyze(close,'SELL','GBP/USD OTC',5,'M5',0,close===220||close===235);
assert.equal(sell.shockBlocker,'ȘOC CONFIRMAT');
assert.equal(sell.trendDirection,'SELL','SELL must match measured 3-closed-candle trend');
assert.equal(sell.trendMeasured,true);
assert.ok(sell.trendVisualPoints.length===3);
assert.ok(sell.trendStrengthPercent>25 && sell.trendStrengthPercent<=100,'SELL trend >25%');
assert.equal(sell.trendThresholdPercent,25);
assert.ok(sell.trendVisualPoints[2]>sell.trendVisualPoints[0],'SELL mini line falls in price');
assert.ok(sell.shockObservedDurationMs>=300 && sell.shockObservedDurationMs<=18000);
assert.equal(sell.shockDirection,'SELL','Red candle upward retracement + recovery must be recognized');
assert.equal(sell.shockOpticalVerified,true);
assert.ok(sell.shockRetracementPercent>30 && sell.shockRecoveryPercent>=20);
assert.ok(sell.shockDropDurationMs<=18000);
assert.ok(sell.shockWickPercent>=15,'SELL must have upper wick');
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
for(const close of [110,128,181,219,211,172,159])
  bottom=analyze(close,'BUY','AUD/NZD OTC',40,'M10',120,close===172||close===159);
assert.equal(bottom.shockDirection,'BUY','Latest low M10 candle shock detected');
assert.ok(bottom.shockRetracementPercent>30);
assert.ok(bottom.shockRecoveryPercent>=20);
// Monotonic movement without a recovery must not count as SHOCK.
for(let n=0;n<13;n++){
  const gradual=analyze(110+n*8,'BUY','SLOW/TEST OTC',44,'M10');
  assert.equal(gradual.shockDirection,'NONE','Slow descent was incorrectly treated as a shock');
}
// The circle may display image-derived retracement, NEVER OCR-fill quality.
const plain=analyze(140,'BUY','NO-SHOCK OTC',45,'M10');
assert.ok(!plain.shockRetracementPercent,'No fabricated SHOCK percentage');
assert.equal(plain.shockBlocker,'AȘTEAPTĂ ȘOC');
// A long wick by itself, without a rapid down/up sequence, must stay silent.
for(let n=0;n<8;n++){
  const wickOnly=analyze(144,'BUY','WICK-ONLY OTC',47,'M10',0,true);
  assertQuiet(wickOnly);
}
// A real retreat / recovery without a wick must stay silent.
let noWick;
for(const close of [110,128,181,219,211,172,159])
  noWick=analyze(close,'BUY','NO-WICK OTC',50,'M10',0,false);
assertQuiet(noWick);
// Opposite confirmed candle color versus prior measured trend MUST stay silent.
let againstTrend;
for(const close of [110,128,181,219,211,172,159])
  againstTrend=analyze(close,'BUY','COUNTER-TREND OTC',51,'M10',0,close===172||close===159,'SELL');
assert.equal(againstTrend.shockDirection,'BUY',
  'SHOCK SIMPLE does not veto live pullback+rebound because of prior trend');
assert.equal(againstTrend.trendDirection,'SELL');
assert.equal(againstTrend.trendMeasured,true);
assert.equal(againstTrend.trendVisualPoints.length,3);
assert.equal(againstTrend.shockBlocker,'ȘOC CONFIRMAT');
// Even a large retreat cannot signal if trend is below 25%.
 // Both directions have genuine 3-candle slopes below 25%.
let weakBuy;
for(const close of [110,128,181,219,211,172,159])
  weakBuy=analyze(close,'BUY','WEAK-TREND-BUY OTC',60,'M10',0,close===172||close===159,'BUY_WEAK');
assert.equal(weakBuy.trendMeasured,true);
assert.equal(weakBuy.trendDirection,'BUY');
assert.ok(weakBuy.trendStrengthPercent>0 && weakBuy.trendStrengthPercent<=25);
assert.ok(weakBuy.shockRetracementPercent>50);
assert.equal(weakBuy.shockBlocker,'ȘOC CONFIRMAT');
assert.equal(weakBuy.shockDirection,'BUY');
let weakSell;
for(const close of [280,262,215,174,181,220,235])
  weakSell=analyze(close,'SELL','WEAK-TREND-SELL OTC',61,'M10',0,close===220||close===235,'SELL_WEAK');
assert.equal(weakSell.trendMeasured,true);
assert.equal(weakSell.trendDirection,'SELL');
assert.ok(weakSell.trendStrengthPercent>0 && weakSell.trendStrengthPercent<=25);
assert.ok(weakSell.shockRetracementPercent>50);
assert.equal(weakSell.shockBlocker,'ȘOC CONFIRMAT');
assert.equal(weakSell.shockDirection,'SELL');
// A measured slope between 25% and 50% qualifies only with complete
// same-candle shock evidence; weaker trends remain rejected.
let flexBuy;
for(const close of [110,128,181,219,211,172,159])
  flexBuy=analyze(close,'BUY','FLEX-BUY OTC',63,'M10',0,
    close===172||close===159,'BUY_MODERATE');
assert.equal(flexBuy.shockDirection,'BUY');
assert.ok(flexBuy.trendStrengthPercent>25 && flexBuy.trendStrengthPercent<=50);
assert.ok(flexBuy.shockRetracementPercent>30 && flexBuy.shockRecoveryPercent>=20);
let flexSell;
for(const close of [280,262,215,174,181,220,235])
  flexSell=analyze(close,'SELL','FLEX-SELL OTC',64,'M10',0,
    close===220||close===235,'SELL_MODERATE');
assert.equal(flexSell.shockDirection,'SELL');
assert.ok(flexSell.trendStrengthPercent>25 && flexSell.trendStrengthPercent<=50);
assert.ok(flexSell.shockRetracementPercent>30 && flexSell.shockRecoveryPercent>=20);
// FLEX 428: trend strengths between 30% and 35% now qualify
// only when the complete same-candle SHOCK evidence is present.
let newlyAdmittedBuy;
for(const close of [110,128,181,219,211,172,159])
  newlyAdmittedBuy=analyze(close,'BUY','FLEX428-BUY OTC',81,'M5',0,
    close===172||close===159,'BUY_FLEX_428');
assert.ok(newlyAdmittedBuy.trendStrengthPercent>25 &&
  newlyAdmittedBuy.trendStrengthPercent<=35);
assert.equal(newlyAdmittedBuy.shockDirection,'BUY');
assert.equal(newlyAdmittedBuy.shockOpticalVerified,true);
let newlyAdmittedSell;
for(const close of [280,262,215,174,181,220,235])
  newlyAdmittedSell=analyze(close,'SELL','FLEX428-SELL OTC',82,'M5',0,
    close===220||close===235,'SELL_FLEX_428');
assert.ok(newlyAdmittedSell.trendStrengthPercent>25 &&
  newlyAdmittedSell.trendStrengthPercent<=35);
assert.equal(newlyAdmittedSell.shockDirection,'SELL');
assert.equal(newlyAdmittedSell.shockOpticalVerified,true);
// 450 single strategy: a moderate M5 pullback must not activate the
// former secondary SCALP strategy or compete with SHOCK signals.
for(let i=0;i<8;i++) assertQuiet(analyze(155,'BUY','SCALP-BUY OTC',71,'M5'));
for(const close of [148,162,170,166,157,150])
  assertQuiet(analyze(close,'BUY','SCALP-BUY OTC',71,'M5',0,
    close===166||close===157||close===150));
for(let i=0;i<8;i++) assertQuiet(analyze(228,'SELL','SCALP-SELL OTC',72,'M5'));
for(const close of [234,225,215,220,229,235])
  assertQuiet(analyze(close,'SELL','SCALP-SELL OTC',72,'M5',0,
    close===220||close===229||close===235));
// Strong temporal SHOCK may be detected even if prior three candles are
// missing from a cropped broker chart, but never from a static wick alone.
let noPriorTrend;
for(const close of [110,128,181,219,211,172,159])
  noPriorTrend=analyze(close,'BUY','NO-HISTORY OTC',90,'M5',0,
    close===172||close===159,'NONE');
assert.equal(noPriorTrend.trendMeasured,false);
assert.equal(noPriorTrend.shockDirection,'BUY');
assert.equal(noPriorTrend.strategy,'SHOCK');
console.log('PASS DEMO 450: SHOCK only, same-candle retrace/rebound/wick; no prior trend gate or competing SCALP');
