// Scalp Atlas v1.0.58: test the safety veto with generated pixel-price curves.
// NOT a backtest, real OTC feed, wick measurement, or profitability validation.
const fs=require('fs');
const assert=require('node:assert/strict');
const s=fs.readFileSync('scalp-atlas-new/analysisEngine.ts','utf8');
const start=s.indexOf('  // EXTREMUM ENTRY GUARD v1.0.58');
const end=s.indexOf('  function classify(curve){',start);
assert.ok(start>0&&end>start,'v1.0.58 guard missing');
const localExtremumRisk=new Function(s.slice(start,end)+';return localExtremumRisk;')();
function curve(kind,quality=.9){
  const h=520,pts=[];
  for(let i=0;i<58;i++){
    let y;
    if(kind==='BOUNCE_FROM_LOW') y=i<=48?160+i*4.3:366.4-(i-48)*4.6;
    else if(kind==='REJECT_FROM_HIGH') y=i<=48?370-i*4.3:163.6+(i-48)*4.6;
    else if(kind==='SELL_MOMENTUM') y=160+i*3.2;
    else if(kind==='BUY_MOMENTUM') y=360-i*3.2;
    else if(kind==='SIDEWAYS') y=260+2*Math.sin(i/5);
    else if(kind==='FAR_FROM_LOW') y=i<36?340-i*2:i<46?270+(i-36)*8:350-(i-46)*7;
    else throw Error('Unknown fixture');
    pts.push({x:35+i*5.4,y,lo:y-5,hi:y+5,span:10,n:12});
  }
  return {pts,w:420,h,quality,spanCoverage:.74,
    recentCandleColors:{closedColors:['RED','RED'],activeColor:'RED'}};
}
let count=0;
function check(name,condition){assert.ok(condition,name);console.log('PASS',name);count++;}
check('SELL is blocked near a recent minimum after a rebound',
  String(localExtremumRisk(curve('BOUNCE_FROM_LOW'),'SELL')).includes('FĂRĂ BIP'));
check('BUY is blocked near a recent maximum after rejection',
  String(localExtremumRisk(curve('REJECT_FROM_HIGH'),'BUY')).includes('FĂRĂ BIP'));
check('Do not invent opposite side risk on low rebound',
  localExtremumRisk(curve('BOUNCE_FROM_LOW'),'BUY')===null);
check('Do not invent opposite side risk on high rejection',
  localExtremumRisk(curve('REJECT_FROM_HIGH'),'SELL')===null);
check('A smooth SELL trend without rebound is not automatically stopped',
  localExtremumRisk(curve('SELL_MOMENTUM'),'SELL')===null);
check('A smooth BUY trend without rejection is not automatically stopped',
  localExtremumRisk(curve('BUY_MOMENTUM'),'BUY')===null);
check('Sideways tiny motion is not classified as a support bounce',
  localExtremumRisk(curve('SIDEWAYS'),'SELL')===null);
check('Do not claim a guard decision on poor image quality',
  localExtremumRisk(curve('BOUNCE_FROM_LOW',.25),'SELL')===null);
check('Confirmed classification must explicitly invoke the veto',
  s.includes("const extremeRisk=localExtremumRisk(curve,dir);")&&
  s.includes("if(extremeRisk)return wait('CANDIDAT '+dir+' NEVALIDAT • '+extremeRisk"));
console.log('v1.0.58: '+count+' checks; outcomes on real markets remain unknown.');
