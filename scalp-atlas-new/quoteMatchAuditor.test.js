'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {verifyNumericQuoteAlignment:check}=require('./quoteMatchAuditor');
const symbol='EURUSD_otc';
function fixture({count=45,shift=0,spread=.000001,brokerSource='broker-independent',vendorSource='OTCharts-quote',lag=1}={}){
  const t=1800000000,vendorTicks=[],brokerTicks=[];
  for(let i=0;i<count;i++){
    const price=1.15000+i*.000006;
    vendorTicks.push({symbol,time:t+i*3,price,sourceId:vendorSource});
    brokerTicks.push({symbol,time:t+i*3+lag,price:price+spread+shift,sourceId:brokerSource});
  }
  return {symbol,vendorTicks,brokerTicks};
}
test('No actual independent quotes means no verification and no bip',()=>{
 const r=check({symbol});
 assert.equal(r.state,'NOT_VERIFIED');
 assert.equal(r.reason,'INSUFFICIENT_INDEPENDENT_QUOTES');
 assert.equal(r.beepAllowed,false);
});
test('Distinct numerical samples can only yield provisional agreement, never trading',()=>{
 const r=check(fixture());
 assert.equal(r.state,'PRELIMINARY_NUMERIC_MATCH_ONLY');
 assert.equal(r.checked,45);
 assert.equal(r.mismatching,0);
 assert.equal(r.safeForTrading,false);
 assert.equal(r.beepAllowed,false);
});
test('Refuse cloned vendor samples masquerading as two independent sources',()=>{
 const r=check(fixture({brokerSource:'same',vendorSource:'same'}));
 assert.equal(r.reason,'SOURCE_INDEPENDENCE_NOT_ESTABLISHED');
});
test('Fail closed when >2% quotes disagree on price',()=>{
 const r=check(fixture({shift:.0001}));
 assert.equal(r.state,'NOT_VERIFIED');
 assert.equal(r.reason,'BROKER_PRICE_MISMATCH');
 assert.ok(r.mismatchFraction>.02);
});
test('Do not silently compare ordinary spot Forex instruments to OTC',()=>{
 const x=fixture();x.brokerTicks[10].symbol='EURUSD';
 assert.equal(check(x).reason,'UNSAFE_OR_NON_OTC_PRICE_SAMPLES');
});
test('Do not match quotes separated by 20s as if simultaneous',()=>{
 const r=check(fixture({lag:20}));
 assert.equal(r.state,'NOT_VERIFIED');
 assert.equal(r.state,'NOT_VERIFIED');
 assert.equal(r.beepAllowed,false);
 assert.ok(['EXCESSIVE_QUOTE_TIMING_GAPS','TOO_FEW_TIME_ALIGNED_QUOTES','BROKER_PRICE_MISMATCH'].includes(r.reason));
});
test('Too short independent sample must not allow signals',()=>{
 const r=check(fixture({count:35}));
 assert.equal(r.reason,'TOO_FEW_TIME_ALIGNED_QUOTES');
 assert.equal(r.beepAllowed,false);
});
test('Bad or out-of-order quote must fail closed',()=>{
 const f=fixture();f.vendorTicks[20].time=f.vendorTicks[18].time;
 assert.equal(check(f).reason,'UNSAFE_OR_NON_OTC_PRICE_SAMPLES');
});
test('Minimum 30 genuinely matched quotes required',()=>{
 const r=check({...fixture(),minComparisons:100});
 assert.equal(r.reason,'INSUFFICIENT_INDEPENDENT_QUOTES');
});
