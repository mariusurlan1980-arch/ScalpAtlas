/** Scalp Atlas SHOCK LIVE — pure detector prototype, DEMO only. */
export class ShockLiveDetector {
  constructor({minPullbackFraction=0.001, minReboundFraction=0.00025, minPullbackMs=150, maxPullbackMs=15000, minConfirmTicks=2}={}) {
    Object.assign(this,{minPullbackFraction,minReboundFraction,minPullbackMs,maxPullbackMs,minConfirmTicks});
    this.reset();
  }
  reset(){this.candle=null;this.high=null;this.low=null;this.highAt=null;this.lowAt=null;this.mode='observe';this.confirm=0;this.fired=false;this.lastPrice=null;this.lastTime=null;this.anchor=null;this.extreme=null;}
  update({candleId,price,timestamp}){
    if(!Number.isFinite(price)||price<=0||!Number.isFinite(timestamp)) return null;
    if(this.candle!==candleId){this.reset();this.candle=candleId;}
    if(this.lastTime!==null&&timestamp<=this.lastTime)return null;
    const previous=this.lastPrice;
    this.lastPrice=price;this.lastTime=timestamp;
    if(this.high===null){this.high=this.low=price;this.highAt=this.lowAt=timestamp;return null;}
    if(price>this.high){this.high=price;this.highAt=timestamp;}
    if(price<this.low){this.low=price;this.lowAt=timestamp;}
    if(this.fired)return null;
    // A candidate begins only after a measured, rapid pullback from a prior intrabar extreme.
    if(this.mode==='observe'){
      if(this.highAt<timestamp && (this.high-price)/this.high>=this.minPullbackFraction && timestamp-this.highAt>=this.minPullbackMs && timestamp-this.highAt<=this.maxPullbackMs){this.mode='buy-rebound';this.extreme=price;this.confirm=0;}
      else if(this.lowAt<timestamp && (price-this.low)/this.low>=this.minPullbackFraction && timestamp-this.lowAt>=this.minPullbackMs && timestamp-this.lowAt<=this.maxPullbackMs){this.mode='sell-rejection';this.extreme=price;this.confirm=0;}
      return null;
    }
    if(this.mode==='buy-rebound'){
      if(price<this.extreme){this.extreme=price;this.confirm=0;}
      else if(previous!==null&&price>previous)this.confirm++;
      else this.confirm=0;
      if(this.confirm>=this.minConfirmTicks&&(price-this.extreme)/this.extreme>=this.minReboundFraction){this.fired=true;return {side:'BUY',timestamp,candleId,price};}
    }else{
      if(price>this.extreme){this.extreme=price;this.confirm=0;}
      else if(previous!==null&&price<previous)this.confirm++;
      else this.confirm=0;
      if(this.confirm>=this.minConfirmTicks&&(this.extreme-price)/this.extreme>=this.minReboundFraction){this.fired=true;return {side:'SELL',timestamp,candleId,price};}
    }
    return null;
  }
}
