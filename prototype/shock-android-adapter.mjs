/** SHOCK LIVE Android-facing adapter (safe, DEMO-only).
 * Only feed real timestamped broker quotes. Never infer numeric prices from uncalibrated photos.
 * In the Android component, pass onAlert: ({side}) => playConfirmedAlert(side).
 */
import {ShockLivePipeline} from './shock-live-pipeline.mjs';
export function createShockLiveAdapter({onAlert,detectorOptions,gateOptions}={}){
 const pipeline=new ShockLivePipeline({onAlert:typeof onAlert==='function'?onAlert:()=>{},detectorOptions,gateOptions});
 return {
  onQuote(quote, now=Date.now()){return pipeline.ingest(quote,now);},
  reset(){pipeline.detector.reset();pipeline.gate.reset();pipeline.context=null;},
 };
}
