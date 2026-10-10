// Scalp Atlas v1.0.53 FREE neural network engineering unit tests.
// Synthetic scenario tests only. NO backtesting or profit statistics.
const fs=require('fs');
const body=fs.readFileSync('scalp-atlas-new/analysisEngine.ts','utf8');
if(body.includes('__SCALP_ATLAS_OFFLINE_MODEL_V1053__'))throw Error('AI weights not embedded in build');
if(!body.includes('LOCAL NEURAL AI v1.0.53')||!body.includes('applyLocalNeuralGate(curve,baseline)'))throw Error('Model or BIP gate missing');
const from=body.indexOf('  function linReg(');
const to=body.indexOf('  function run(dataUrl,timeframe)',from);
if(from<0||to<from)throw Error('Cannot find trained local neural filter');
const {classify,applyLocalNeuralGate,localNeuralVote}=new Function(body.slice(from,to)+';return {classify,applyLocalNeuralGate,localNeuralVote};')();
function chart(kind,active,closes){
 const pts=[],w=420,h=520;
 for(let i=0;i<58;i++){
  const trend=kind==='BUY'?-.63*i:kind==='SELL'?.63*i:kind==='FLAT'?0:i<40?-.8*i:-.8*40+(i-40)*1.2;
  const y=260+trend+4.4*Math.sin(i*.95)+2*Math.cos(i*.43);
  pts.push({x:50+i*5.4,y,lo:y-8,hi:y+8,span:16,n:12});
 }
 return {pts,h,w,quality:.89,spanCoverage:.70,anchor:pts.at(-1),
    recentCandleColors:{activeColor:active,closedColors:closes,lastClosedBodyPixels:18,recentBodyReference:18}};
}
let count=0;
function verify(name,curve,expected){
 const ml=localNeuralVote(curve),base=classify(curve),after=applyLocalNeuralGate(curve,base);
 const result=after.clear?after.dir:'NONE';
 if(result!==expected)throw Error(name+' expected '+expected+' got '+result+' ML '+ml.direction+' '+ml.confidence+' '+after.reason);
 if(after.clear && !after.atlas.includes('AI LOCAL'))throw Error('Confirmation did not include local neural net');
 console.log('PASS',name,result,'ML:',ml.direction,ml.confidence.toFixed(3),'reason:',after.reason||'confirmed');
 count++;
}
verify('Uptrend offline BUY',chart('BUY','GREEN',['GREEN','GREEN']),'BUY');
verify('Downtrend offline SELL',chart('SELL','RED',['RED','RED']),'SELL');
verify('Flat market abstain',chart('FLAT','GREEN',['GREEN','RED']),'NONE');
verify('Reversal market abstain',chart('WHIP','RED',['RED','RED']),'NONE');
verify('BUY active candle opposes',chart('BUY','RED',['GREEN','GREEN']),'NONE');
verify('SELL active candle opposes',chart('SELL','GREEN',['RED','RED']),'NONE');
const chk=chart('BUY','GREEN',['GREEN','GREEN']);
const wrong={...classify(chk),clear:true,dir:'SELL',atlas:'manual synthetic override',score:.90};
const gated=applyLocalNeuralGate(chk,wrong);
if(gated.clear || gated.dir!=='NONE')throw Error('Opposite ML direction did not prevent BIP');
console.log('PASS Machine-learning veto: no opposite BUY/SELL trade');
count++;
const manual=chart('BUY','GREEN',['GREEN','GREEN']);
const wait={...classify(manual),clear:false,dir:'NONE',reason:'quality not verified'};
const afterWait=applyLocalNeuralGate(manual,wait);
if(afterWait.clear||afterWait.dir!=='NONE')throw Error('ML invented trade without technical confirmation');
console.log('PASS ML never upgrades WAIT into trade');count++;
const broken=chart('BUY','GREEN',['GREEN','GREEN']);broken.pts=broken.pts.slice(0,16);
const noData=localNeuralVote(broken);
if(noData.direction!=='WAIT')throw Error('Insufficient pixels should fail closed');
console.log('PASS Local model abstains when screenshot incomplete');count++;
console.log('v1.0.53:',count,'synthetic logic checks; never claim real market accuracy');
