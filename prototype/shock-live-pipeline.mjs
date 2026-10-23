import {ShockLiveDetector} from './shock-live-detector.mjs';
import {ShockSampleGate} from './shock-sample-gate.mjs';
/** Prototype coordinator. Input MUST be a validated, timestamped numeric quote feed. */
export class ShockLivePipeline {
 constructor({detectorOptions={},gateOptions={},onAlert=()=>{}}={}){
  this.detector=new ShockLiveDetector(detectorOptions);
  this.gate=new ShockSampleGate(gateOptions);
  this.onAlert=onAlert;
  this.context=null;
 }
 ingest(sample,now=Date.now()){
  const context=sample && typeof sample.instrument==='string' && typeof sample.timeframe==='string' ? sample.instrument+'|'+sample.timeframe : null;
  if(context!==this.context){this.context=context;this.detector.reset();this.gate.reset();}
  const valid=this.gate.accept(sample,now);
  if(!valid){this.detector.reset();return {state:'WAIT',reason:'invalid_or_stale_quote'};}
  const signal=this.detector.update(valid);
  if(!signal)return {state:'WAIT',reason:'observing'};
  const alert={...signal,instrument:sample.instrument,timeframe:sample.timeframe};
  this.onAlert(alert);
  return {state:'SIGNAL',alert};
 }
}
