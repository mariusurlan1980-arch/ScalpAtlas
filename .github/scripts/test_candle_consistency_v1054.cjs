// Synthetic engineering checks, not live market accuracy evidence.
const fs=require('fs');
const body=fs.readFileSync('scalp-atlas-new/analysisEngine.ts','utf8');
if(!body.includes('COLOR CONSISTENCY v1.0.54'))throw Error('Strict color guard missing');
const from=body.indexOf('  function linReg(');
const end=body.indexOf('  function expiryFor(',from);
if(from<0||end<0)throw Error('Signal classifier extraction failed');
const classify=new Function(body.slice(from,end)+';return classify;')();
function chart(direction,active,closed){
  const pts=[],w=420,h=520;
  for(let i=0;i<58;i++){
    const trend=direction==='BUY'?-.63*i:.63*i;
    const y=260+trend+4.4*Math.sin(i*.95)+2*Math.cos(i*.43);
    pts.push({x:50+i*5.4,y,lo:y-8,hi:y+8,span:16,n:12});
  }
  return {pts,w,h,quality:.89,spanCoverage:.7,anchor:pts.at(-1),recentCandleColors:{activeColor:active,closedColors:closed,lastClosedBodyPixels:18,recentBodyReference:18}};
}
const cases=[
  ['buy matched',chart('BUY','GREEN',['GREEN','GREEN']),'BUY'],
  ['sell matched',chart('SELL','RED',['RED','RED']),'SELL'],
  ['red latest closed does not produce BUY',chart('BUY','GREEN',['GREEN','RED']),'NONE','BUY'],
  ['red previous closed does not produce BUY',chart('BUY','GREEN',['RED','GREEN']),'NONE','BUY'],
  ['green latest closed does not produce SELL',chart('SELL','RED',['RED','GREEN']),'NONE','SELL'],
  ['green previous closed does not produce SELL',chart('SELL','RED',['GREEN','RED']),'NONE','SELL'],
  ['red active does not produce BUY',chart('BUY','RED',['GREEN','GREEN']),'NONE','BUY'],
  ['green active does not produce SELL',chart('SELL','GREEN',['RED','RED']),'NONE','SELL'],
  ['missing candle recognition means WAIT',chart('BUY',null,['GREEN','GREEN']),'NONE','BUY'],
];
let count=0;
for(const [name,curve,expect,expectedPreview] of cases){
 const result=classify(curve);
 const got=result.clear?result.dir:'NONE';
 if(got!==expect)throw Error(name+': '+got+' expected '+expect);
 if(expectedPreview&&curve.previewDirection!==expectedPreview)throw Error(name+': preview expected '+expectedPreview+' got '+curve.previewDirection);
 if(got==='NONE'&&expectedPreview&&result.clear)throw Error(name+': tentative preview must never become entry');
 console.log('PASS',name,'confirmed='+got,'preview='+curve.previewDirection);
 count++;
}
console.log(count,'synthetic color-consistency checks completed; real market prediction accuracy is unverified');
