// Actual LIVE HTML gate, evaluated with synthetic chart pixels only.
// These tests verify detection and refusal, not success rates or OHLC accuracy.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync('.github/templates/ScalpAtlasAnalysisEngineV0416.ts','utf8');
const kotlin=fs.readFileSync('.github/native-overlay/ScalpOverlayService.kt','utf8');
const first=source.indexOf('  function candleEvidence(curve,wantedDirection){');
const last=source.indexOf('  function classify(curve){',first);
assert.ok(first>=0&&last>first,'live optical functions available');
const functions=source.slice(first,last);
const W=420,H=240;
const colors={BUY:[20,220,90],SELL:[218,42,44]};
function screen(bars){
  const px=new Uint8ClampedArray(W*H*4);
  for(let i=0;i<px.length;i+=4){px[i]=14;px[i+1]=22;px[i+2]=35;px[i+3]=255;}
  const write=(x,y,color)=>{
    if(x<0||x>=W||y<0||y>=H)return;
    const i=(y*W+x)*4,rgb=colors[color];
    px[i]=rgb[0];px[i+1]=rgb[1];px[i+2]=rgb[2];
  };
  bars.forEach((b,j)=>{
    const x=100+j*30;
    for(let xx=x;xx<x+8;xx++)for(let y=b.top;y<=b.bottom;y++)write(xx,y,b.color);
    if(b.wickBelow!=null)for(let y=b.bottom+1;y<=b.wickBelow;y++)write(x+3,y,b.color);
    if(b.wickAbove!=null)for(let y=b.wickAbove;y<b.top;y++)write(x+3,y,b.color);
  });
  const ctx={getImageData(){return {data:px};}};
  const fn=vm.runInNewContext(functions+';({candleEvidence,wickRejectionEvidence})',{ctx});
  return direction=>fn.wickRejectionEvidence(
    {w:W,h:H},direction,fn.candleEvidence({w:W,h:H},direction));
}
const bullish=[
  {color:'BUY',top:111,bottom:126},{color:'BUY',top:108,bottom:123},
  {color:'BUY',top:105,bottom:122},{color:'BUY',top:102,bottom:120},
  {color:'BUY',top:99,bottom:112,wickBelow:143},
  {color:'BUY',top:93,bottom:106},{color:'BUY',top:90,bottom:103}
];
const bearish=[
  {color:'SELL',top:84,bottom:99},{color:'SELL',top:80,bottom:95},
  {color:'SELL',top:82,bottom:96},{color:'SELL',top:79,bottom:94},
  {color:'SELL',top:92,bottom:106,wickAbove:62},
  {color:'SELL',top:100,bottom:115},{color:'SELL',top:104,bottom:119}
];
assert.equal(screen(bullish)('BUY').ok,true,'lower-wick BUY with two closed matching candles');
assert.equal(screen(bearish)('SELL').ok,true,'upper-wick SELL with two closed matching candles');
assert.equal(screen(bullish.map((b,i)=>i===4?{color:'BUY',top:99,bottom:112}:b))('BUY').ok,false,
  'no wick = no BUY');
assert.equal(screen(bearish.map((b,i)=>i===5?{...b,color:'BUY'}:b))('SELL').ok,false,
  'two opposite closed bodies = no SELL');
assert.equal(screen(bullish.slice(0,4))('BUY').ok,false,'not enough candles = no signal');
assert.match(source,/marketRegime==='TENDINTA'/,'mixed markets must be blocked');
assert.match(source,/wickRejectionGate:!!clear&&!!wick/,'native gate gets optical rejection flag');
assert.ok(source.includes('expiry:clear?5:null'),'expiry fixed at five minutes for demo');
assert.match(kotlin,/wickGate && readableTrend/,'native bip must require optical wick');
assert.ok(source.includes("signal:clear?r.dir:'NONE'"),'live bridge shape unchanged');
console.log('PASS: 5 synthetic optical scenarios and 5 LIVE safety invariants');
