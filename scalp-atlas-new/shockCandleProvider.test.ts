import {readVerifiedCandle} from './shockCandleProvider';
const assert=(v:boolean,m:string)=>{if(!v)throw new Error(m);};
async function main(){
 const absent=await readVerifiedCandle(null);
 assert(absent.kind==='unavailable'&&absent.reason==='NO_PROVIDER','camera alone must not produce SHOCK');
 const unverified=await readVerifiedCandle({getCurrentCandle:async()=>({chartVerified:true,ohlcVerified:false})});
 assert(unverified.kind==='unavailable','unverified OCR blocked');
 const sample={marketId:'EUR/USD',timeframeMinutes:10,candleStartMs:600000,observedAtMs:602000,open:100,high:100,low:99,close:99.2,chartVerified:true,ohlcVerified:true};
 const valid=await readVerifiedCandle({getCurrentCandle:async()=>sample});
 assert(valid.kind==='verified','verified OHLC passes provider');
 const failed=await readVerifiedCandle({getCurrentCandle:async()=>{throw new Error('camera unavailable');}});
 assert(failed.kind==='unavailable','provider error must fail closed');
}
main().catch(e=>{throw e;});
