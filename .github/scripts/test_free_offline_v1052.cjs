// v1.0.52 engineering checks: NO profitability claims, NO broker data.
const fs=require('fs');
const f=fs.readFileSync('scalp-atlas-new/analysisEngine.ts','utf8');
const start=f.indexOf('  function linReg(');
const end=f.indexOf('  function expiryFor(',start);
if(start<0||end<=start)throw Error('Signal engine missing');
const classify=new Function(f.slice(start,end)+';return classify;')();
if(!f.includes('FREE OFFLINE STRATEGY ENSEMBLE v1.0.52') ||
   !f.includes("const model='OFFLINE • '")||
   !f.includes("const breakoutBuy=")||!f.includes("const pullbackSell="))throw Error('Offline strategies absent');
function chart(kind,active,closes){
  const pts=[],h=520,w=420;
  for(let i=0;i<58;i++){
    const trend=kind==='BUY'?-.63*i:kind==='SELL'?.63*i:kind==='FLAT'?0:i<40?-.8*i:-.8*40+1.2*(i-40);
    const y=260+trend+4.4*Math.sin(i*.95)+2*Math.cos(i*.43);
    pts.push({x:50+i*5.4,y,lo:y-8,hi:y+8,span:16,n:12});
  }
  return {pts,h,w,quality:.89,spanCoverage:.70,anchor:pts.at(-1),
    recentCandleColors:{activeColor:active,closedColors:closes,lastClosedBodyPixels:18,recentBodyReference:18}};
}
let checked=0;
function check(label,curve,expect){
  const answer=classify(curve);
  const dir=answer.clear?answer.dir:'NONE';
  if(dir!==expect)throw Error(label+' expected '+expect+' got '+dir+': '+answer.reason);
  if(dir!=='NONE'&&(!answer.atlas.startsWith('OFFLINE •')||curve.previewDirection!==dir))throw Error(label+': false offline signal');
  console.log('PASS',label,dir,answer.atlas,answer.reason);checked++;
}
check('Clear rising structure',chart('BUY','GREEN',['GREEN','GREEN']),'BUY');
check('Clear falling structure',chart('SELL','RED',['RED','RED']),'SELL');
check('Sideways means WAIT',chart('FLAT','GREEN',['GREEN','RED']),'NONE');
check('Recent trend reversal means WAIT',chart('WHIP','GREEN',['GREEN','GREEN']),'NONE');
check('Active candle contradicts BUY',chart('BUY','RED',['GREEN','GREEN']),'NONE');
check('Active candle contradicts SELL',chart('SELL','GREEN',['RED','RED']),'NONE');
check('No simplistic two same-color candles requirement for BUY',chart('BUY','GREEN',['RED','GREEN']),'BUY');
check('No simplistic two same-color candles requirement for SELL',chart('SELL','RED',['GREEN','RED']),'SELL');
const low=chart('BUY','GREEN',['GREEN','GREEN']);low.quality=.18;
check('Unreadable chart blocks signals',low,'NONE');
console.log('Validated',checked,'SYNTHETIC consistency cases. Real demo forward-testing required.');
