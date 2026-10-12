// Engineering unit tests for VISUAL PREVIEW ONLY. Not market validation.
const fs=require('fs');
const assert=require('node:assert/strict');
const body=fs.readFileSync('scalp-atlas-new/analysisEngine.ts','utf8');
const regStart=body.indexOf('  function linReg('),medianStart=body.indexOf('  function median(');
const helperStart=body.indexOf('  // EXTREME REJECTION WATCH v1.0.57');
const runStart=body.indexOf('  function run(dataUrl,timeframe,frameId)');
assert.ok(regStart>0&&medianStart>regStart&&helperStart>medianStart&&runStart>helperStart,'engine functions must exist');
const source=body.slice(regStart,medianStart)+body.slice(helperStart,runStart);
const {detectExtremeRejectionWatch,addExtremeRejectionPreview}=
  new Function(source+';return {detectExtremeRejectionWatch,addExtremeRejectionPreview};')();
function curve(kind,colors=['RED','RED'],quality=.90,active=null){
  const w=420,h=520,pts=[];
  for(let i=0;i<58;i++){
    let y;
    if(kind==='SELL')y=i<=50?300-i*2.0:200+(i-50)*5.5;
    else if(kind==='BUY')y=i<=50?220+i*2.0:320-(i-50)*5.5;
    else if(kind==='STALE_SELL')y=i<=43?300-i*2.0:214+(i-43)*5.5;
    else if(kind==='STALE_BUY')y=i<=43?220+i*2.0:306-(i-43)*5.5;
    else if(kind==='FLAT')y=250+2*Math.sin(i/4);
    else if(kind==='CONTINUATION')y=320-i*1.5;
    else if(kind==='WEAK')y=i<=43?260-i*.12:254.84+(i-43)*.25;
    else throw Error('unknown fixture kind');
    pts.push({x:35+i*5.4,y,lo:y-6,hi:y+6,span:12,n:11});
  }
  return {pts,h,w,quality,spanCoverage:.70,
    recentCandleColors:{closedColors:colors,activeColor:active||(kind==='BUY'||kind==='STALE_BUY'?'GREEN':'RED')}};
}
let count=0;
function check(desc,condition){assert.ok(condition,desc);console.log('PASS',desc);count++;}
const sell=curve('SELL');
const obsS=detectExtremeRejectionWatch(sell);
check('red after rally at recent max -> diagnostic SELL',obsS?.direction==='SELL');
const updated=addExtremeRejectionPreview(sell,{clear:false,dir:'NONE',score:.58,reason:'AȘTEAPTĂ',expiry:null});
check('preview is visible but always non-tradable',updated.clear===false&&updated.dir==='NONE'&&updated.expiry===null&&sell.previewDirection==='SELL'&&updated.reason.includes('FĂRĂ BIP'));
const buy=curve('BUY',['GREEN','GREEN']);
check('green bounce at recent min -> diagnostic BUY',detectExtremeRejectionWatch(buy)?.direction==='BUY');
check('missing green color cannot invent bullish wick reversal',detectExtremeRejectionWatch(curve('BUY',['RED','RED']))===null);
check('missing red color cannot invent bearish rejection',detectExtremeRejectionWatch(curve('SELL',['GREEN','GREEN']))===null);
check('flat chart -> no candidate',detectExtremeRejectionWatch(curve('FLAT'))===null);
check('continuing trend -> no reversal candidate',detectExtremeRejectionWatch(curve('CONTINUATION'))===null);
check('tiny fluctuation -> no reversal candidate',detectExtremeRejectionWatch(curve('WEAK'))===null);
check('low chart quality -> no candidate',detectExtremeRejectionWatch(curve('SELL',['RED','RED'],.2))===null);
check('old maximum is not a current SELL setup',detectExtremeRejectionWatch(curve('STALE_SELL'))===null);
check('old minimum is not a current BUY setup',detectExtremeRejectionWatch(curve('STALE_BUY',['GREEN','GREEN']))===null);
check('current green bar blocks a SELL watch',detectExtremeRejectionWatch(curve('SELL',['RED','RED'],.90,'GREEN'))===null);
check('current red bar blocks a BUY watch',detectExtremeRejectionWatch(curve('BUY',['GREEN','GREEN'],.90,'RED'))===null);

const already={...sell,previewDirection:'BUY'};
const initial={clear:false,dir:'NONE',score:.5,reason:'original'};
check('never overwrite another existing candidate',addExtremeRejectionPreview(already,initial)===initial&&already.previewDirection==='BUY');
const confirmed={clear:true,dir:'BUY',score:.9,expiry:5,reason:''};
const blank={...sell,previewDirection:'NONE'};
check('never override confirmed trades',addExtremeRejectionPreview(blank,confirmed)===confirmed&&blank.previewDirection==='NONE');
console.log('v1.0.57 '+count+' synthetic checks. No execution signal, no accuracy claim.');
