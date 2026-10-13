'use strict';
/**
 * NUMERIC-TO-NUMERIC feed comparison. Never reads screenshots or emits signals.
 * Reference quotes must be independently sourced from the REAL broker for the
 * exact same OTC instrument, not forex spot or the same OTCharts stream copied.
 *
 * This is a research metric, not proof a broker API exists or that an
 * instrument can be profitably predicted.
 */
function verifyNumericQuoteAlignment({
  vendorTicks, brokerTicks, symbol, maxLagSeconds=3,
  maxAbsoluteDifference=0.00002, minComparisons=30,
  maxMismatchFraction=0.02, minObservedSeconds=120
}={}) {
  const wait=(reason,details={})=>({state:'NOT_VERIFIED',reason,
    safeForTrading:false,beepAllowed:false,...details});
  if(!/^[A-Z0-9#]{3,24}_otc$/.test(symbol||''))return wait('INVALID_OTC_SYMBOL');
  if(!Array.isArray(vendorTicks)||!Array.isArray(brokerTicks)||vendorTicks.length<minComparisons||
     brokerTicks.length<minComparisons)return wait('INSUFFICIENT_INDEPENDENT_QUOTES');
  if(!Number.isFinite(maxLagSeconds)||maxLagSeconds<=0||maxLagSeconds>10||
    !Number.isFinite(maxAbsoluteDifference)||maxAbsoluteDifference<=0||
    !Number.isInteger(minComparisons)||minComparisons<30||
    !Number.isFinite(maxMismatchFraction)||maxMismatchFraction<0||maxMismatchFraction>.15||
    !Number.isFinite(minObservedSeconds)||minObservedSeconds<120)
    return wait('INVALID_VALIDATION_PARAMETERS');
  function clean(ticks) {
    let last=-Infinity;
    for(const item of ticks){
      if(!item||item.symbol!==symbol||!Number.isSafeInteger(item.time)||
        !Number.isFinite(item.price)||item.price<=0||item.time<last)
        return false;
      last=item.time;
    }
    return true;
  }
  if(!clean(vendorTicks)||!clean(brokerTicks))return wait('UNSAFE_OR_NON_OTC_PRICE_SAMPLES');
  if(vendorTicks[0].sourceId === undefined || brokerTicks[0].sourceId===undefined ||
    vendorTicks[0].sourceId === brokerTicks[0].sourceId ||
    vendorTicks.some(x=>x.sourceId!==vendorTicks[0].sourceId)||
    brokerTicks.some(x=>x.sourceId!==brokerTicks[0].sourceId))
    return wait('SOURCE_INDEPENDENCE_NOT_ESTABLISHED');
  // We cannot certify provenance from in-memory sourceId strings: the caller
  // must independently inspect broker feed transport and timestamp clocks.
  let i=0,j=0,matches=0,mismatches=0,lagged=0,errors=[],lags=[];
  while(i<vendorTicks.length && j<brokerTicks.length){
    const v=vendorTicks[i],b=brokerTicks[j];
    const lag=v.time-b.time;
    if(Math.abs(lag)>maxLagSeconds) {
      if(lag<0)i++;else j++;
      lagged++;
      continue;
    }
    const err=Math.abs(v.price-b.price);
    errors.push(err);lags.push(Math.abs(lag));
    if(err<=maxAbsoluteDifference)matches++;else mismatches++;
    // Greedy monotone pairing: a tick must never be reused.
    i++;j++;
  }
  const checked=matches+mismatches;
  const observedSeconds=Math.min(
    vendorTicks.at(-1).time-vendorTicks[0].time,
    brokerTicks.at(-1).time-brokerTicks[0].time
  );
  const result={checked,matching:matches,mismatching:mismatches,
    unmatchedOrLate:lagged,observedSeconds,
    mismatchFraction:checked?mismatches/checked:null,
    maxObservedLagSeconds:lags.length?Math.max(...lags):null,
    maxObservedPriceDifference:errors.length?Math.max(...errors):null,
    safeForTrading:false,beepAllowed:false};
  if(observedSeconds<minObservedSeconds||checked<minComparisons)return wait('TOO_FEW_TIME_ALIGNED_QUOTES',result);
  if(result.mismatchFraction>maxMismatchFraction)return wait('BROKER_PRICE_MISMATCH',result);
  // Conservative edge-coverage check: aligning two dense but shifted tick
  // sequences at their overlapping interior may falsely imply quote equality.
  if(lagged>Math.max(2,Math.ceil(Math.min(vendorTicks.length,brokerTicks.length)*.05)))
    return wait('EXCESSIVE_QUOTE_TIMING_GAPS',result);
  // A passing matching sample is NOT a real-time authenticated broker feed,
  // and cannot by itself authorize BUY/SELL, probabilities or sound.
  return {...result,state:'PRELIMINARY_NUMERIC_MATCH_ONLY',
    reason:'PROVENANCE_AND_LIVE_AUTHORIZATION_NOT_VERIFIED'};
}
module.exports={verifyNumericQuoteAlignment};
