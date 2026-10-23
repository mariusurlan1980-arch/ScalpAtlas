/** Validated SHOCK LIVE sample adapter (prototype; not wired to Android). */
export class ShockSampleGate {
  constructor({maxAgeMs=2500,maxGapMs=3000}={}) {this.maxAgeMs=maxAgeMs;this.maxGapMs=maxGapMs;this.last=null;}
  reset(){this.last=null;}
  accept(sample,now=Date.now()){
    if(!sample || typeof sample.instrument!=='string'||!sample.instrument.trim() || typeof sample.timeframe!=='string'||!/^M(1|2|3|5|10|15|30)$|^H1$/.test(sample.timeframe)||typeof sample.candleId!=='string'||!sample.candleId.trim()||!Number.isFinite(sample.price)||sample.price<=0||!Number.isFinite(sample.timestamp))return null;
    if(sample.timestamp>now+250 || now-sample.timestamp>this.maxAgeMs)return null;
    if(this.last){
      if(this.last.instrument!==sample.instrument||this.last.timeframe!==sample.timeframe){this.reset();return null;}
      if(sample.timestamp<=this.last.timestamp || sample.timestamp-this.last.timestamp>this.maxGapMs){this.reset();return null;}
    }
    this.last={instrument:sample.instrument,timeframe:sample.timeframe,timestamp:sample.timestamp};
    return {candleId:sample.instrument+'|'+sample.timeframe+'|'+sample.candleId,price:sample.price,timestamp:sample.timestamp};
  }
}
