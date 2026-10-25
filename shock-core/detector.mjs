// Standalone SHOCK proof-of-concept. Does not read broker data.
export class ShockDetector {
  constructor({minAmplitude=0.005,minRecovery=0.5,maxGapMs=3000}={}) {
    this.minAmplitude=minAmplitude;this.minRecovery=minRecovery;this.maxGapMs=maxGapMs;
    this.reset();
  }
  reset(){this.key=null;this.lastTime=null;this.open=null;this.low=null;this.high=null;this.lastClose=null;this.direction=null;this.emitted=new Set();}
  ingest(s){
    const wait=(reason)=>({state:"WAIT",alert:false,reason});
    if(!s||s.verified!==true||!["M5","M10","M15"].includes(s.timeframe)||!Number.isFinite(s.observedAt)||!Number.isFinite(s.candleStart)||!Number.isFinite(s.open)||!Number.isFinite(s.high)||!Number.isFinite(s.low)||!Number.isFinite(s.close)||s.open<=0||s.low>s.close||s.high<s.close||s.low>s.open||s.high<s.open||s.low>s.high)return wait("invalid");
    const key=[s.market,s.timeframe,s.candleStart].join("|");
    if(this.key!==key){this.key=key;this.lastTime=null;this.open=s.open;this.low=s.low;this.high=s.high;this.lastClose=s.close;this.direction=null;}
    else if(s.observedAt<=this.lastTime||s.observedAt-this.lastTime>this.maxGapMs||s.open!==this.open||s.low>this.low||s.high<this.high){this.key=null;return wait("inconsistent");}
    this.lastTime=s.observedAt;this.low=Math.min(this.low,s.low);this.high=Math.max(this.high,s.high);
    const drop=(this.open-this.low)/this.open;
    const rise=(this.high-this.open)/this.open;
    if(drop>=this.minAmplitude)this.direction="BUY";
    if(rise>=this.minAmplitude&&drop<this.minAmplitude)this.direction="SELL";
    const buy=this.direction==="BUY"&&s.close>this.low&&drop>=this.minAmplitude&&(s.close-this.low)/(this.open-this.low)>=this.minRecovery;
    const sell=this.direction==="SELL"&&s.close<this.high&&rise>=this.minAmplitude&&(this.high-s.close)/(this.high-this.open)>=this.minRecovery;
    this.lastClose=s.close;
    if(!buy&&!sell)return wait("not-confirmed");
    if(this.emitted.has(key))return wait("already-alerted");
    this.emitted.add(key);return {state:buy?"BUY":"SELL",alert:true,recoveryPercent:Math.round(100*(buy?(s.close-this.low)/(this.open-this.low):(this.high-s.close)/(this.high-this.open)))};
  }
}
