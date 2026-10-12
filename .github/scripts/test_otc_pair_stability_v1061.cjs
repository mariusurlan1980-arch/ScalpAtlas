// v1.0.61 white-box static safeguards + deterministic OCR event simulations.
// This is NOT a device test or proof of OTC numeric data/strategy performance.
const fs=require('node:fs'),assert=require('node:assert/strict');
const native=fs.readFileSync('.github/native-overlay/ScalpOverlayService.kt','utf8');
const n=needle=>{assert.ok(native.includes(needle),'Missing Kotlin safety gate: '+needle);};
n('OTC OCR IDENTITY v1.0.61');
n('SAFE MARKET SWITCH v1.0.61');
n('detectedPair == currentPair.removeSuffix(" OTC")');
n('if (pairSwitchReads >= 2)');
n('pairSwitchCandidate != null');
n('resetSignalStateForMarketChange()');
n('directionConsistencyBlock(now, previewDir, rawSignal)');
n('isFreshLiveFrameResponse(responseFrameId)');
n('m5EntryTimingRejection(now)');
n('playBip()');

// A tiny independent reference model for the Kotlin pair-candidate state.
// Actual Kotlin still requires a successful Android compilation and Demo trial.
function create(initial='—'){
  let current=initial,pending=null,reads=0,resets=0;
  return {
    onRead(detected){
      const partial=detected!==null&&current.endsWith(' OTC')&&detected===current.slice(0,-4);
      if(detected!==null&&detected!==current&&!partial){
        if(pending===detected)reads=Math.min(2,reads+1);
        else {pending=detected;reads=1;}
        if(reads>=2){current=detected;pending=null;reads=0;resets++;}
      }else{pending=null;reads=0;}
      return {pair:current,pending,reads,resets,beepAllowed:pending===null};
    }
  };
}
function eq(title,a,b){assert.deepEqual(a,b,title);console.log('PASS '+title)}
{
  const m=create('EUR/RUB OTC');
  for(let i=0;i<12;i++){
    let r=m.onRead(i%2===0?'EUR/RUB':'EUR/RUB OTC');
    eq('same EUR/RUB OTC despite incomplete OCR '+i,[r.pair,r.pending,r.resets],['EUR/RUB OTC',null,0]);
  }
}
{
  const m=create('EUR/RUB OTC');
  let r=m.onRead('GBP/USD OTC');
  eq('1 of 2 GBP/USD reads cannot reset existing pair',[r.pair,r.pending,r.resets,r.beepAllowed],
    ['EUR/RUB OTC','GBP/USD OTC',0,false]);
  r=m.onRead('GBP/USD OTC');
  eq('2 of 2 new pair triggers exactly one reset',[r.pair,r.pending,r.resets],
    ['GBP/USD OTC',null,1]);
  r=m.onRead('GBP/USD OTC');
  eq('same pair again does not reset',[r.pair,r.pending,r.resets],
    ['GBP/USD OTC',null,1]);
}
{
  const m=create('EUR/RUB OTC');
  m.onRead('GBP/USD OTC');
  let r=m.onRead('EUR/RUB');
  eq('OCR recovers old pair, so pending market switch cleared',[r.pending,r.resets],
    [null,0]);
}
{
  const m=create('EUR/RUB');
  let r=m.onRead('EUR/RUB OTC');
  eq('newly recognized OTC suffix is treated as a venue change until second read',[r.pending,r.beepAllowed],
    ['EUR/RUB OTC',false]);
  r=m.onRead('EUR/RUB OTC');
  eq('OTC suffix upgrade commits with reset',[r.pair,r.resets],['EUR/RUB OTC',1]);
}
console.log('v1.0.61: static integration + deterministic pair OCR stability checks passed');
