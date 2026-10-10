// Scalp Atlas v1.0.50 synthetic *unit tests*, not performance backtesting.
// Verifies consistent engineering behaviour only; no broker candles or prices.
const fs=require('fs');
const file=fs.readFileSync('scalp-atlas-new/analysisEngine.ts','utf8');
const begin=file.indexOf('  function linReg(');
const end=file.indexOf('  function expiryFor(',begin);
if(begin<0||end<begin)throw new Error('Cannot extract image-based signal engine');
const source=file.slice(begin,end);
const classify=new Function(source+'; return classify;')();
function chart(kind,active,closes){
  const pts=[],h=520,w=420;
  for(let i=0;i<58;i++){
    const trend=kind==='BUY'?-.63*i:kind==='SELL'?.63*i:kind==='FLAT'?0:i<40?-.8*i:-.8*40+1.2*(i-40);
    const y=260+trend+4.4*Math.sin(i*.95)+2.0*Math.cos(i*.43);
    pts.push({x:50+i*5.4,y,lo:y-8,hi:y+8,span:16,n:12});
  }
  return {pts,h,w,quality:.89,spanCoverage:.70,anchor:pts.at(-1),
    recentCandleColors:{activeColor:active,
      closedColors:closes,lastClosedBodyPixels:18,recentBodyReference:18}};
}
let checks=0;
function verify(label,curve,want){
 const x=classify(curve);
 const result=x.clear?x.dir:'NONE';
 if(result!==want)throw new Error(label+': expected '+want+' got '+result+' reason='+x.reason);
 if(want!=='NONE'&&curve.previewDirection!==want)throw new Error(label+': preview mismatch');
 console.log('PASS',label,result,x.reason||'confirmed');checks++;
}
verify('Uptrend multifactor BUY',chart('BUY','GREEN',['GREEN','GREEN']),'BUY');
verify('Downtrend multifactor SELL',chart('SELL','RED',['RED','RED']),'SELL');
verify('Flat market MUST WAIT',chart('FLAT','GREEN',['GREEN','RED']),'NONE');
verify('Recent reversal MUST WAIT',chart('WHIP','GREEN',['GREEN','GREEN']),'NONE');
verify('BUY with contradictory live candle MUST WAIT',chart('BUY','RED',['GREEN','GREEN']),'NONE');
verify('SELL with contradictory live candle MUST WAIT',chart('SELL','GREEN',['RED','RED']),'NONE');
verify('BUY not dependent solely on two same-color closes',chart('BUY','GREEN',['GREEN','RED']),'BUY');
verify('SELL not dependent solely on two same-color closes',chart('SELL','RED',['RED','GREEN']),'SELL');
const low=chart('BUY','GREEN',['GREEN','GREEN']);low.quality=.23;
verify('Low-resolution chart MUST WAIT',low,'NONE');
console.log('Verified',checks,'synthetic cases (NO profitability conclusions)');
