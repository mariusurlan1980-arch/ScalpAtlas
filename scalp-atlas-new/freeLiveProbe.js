'use strict';

// SCALP ATLAS: one-shot, $0, read-only entitlement and price probe.
// Requires the user's OWN free, separately verified OTCharts API key.
// Never touches a Pocket Option account, broker session, order or payment.
// No API key is ever printed, written to GitHub, or included in an error.
const {makeOTChartsClient,checkFreeOnlyAccess}=require('./otchartsReadOnlyAdapter');

async function probeFreePocketOtc({apiKey,fetchImpl,now=()=>Date.now(),symbol='EURUSD_otc',maxTicks=12,timeoutMs=15000}={}) {
  if(!apiKey) return {status:'NEEDS_FREE_PROVIDER_API_KEY',free:true,connected:false};
  if(!Number.isInteger(maxTicks)||maxTicks<2||maxTicks>30)
    throw new Error('INVALID_MAX_TICKS');
  if(!Number.isInteger(timeoutMs)||timeoutMs<100||timeoutMs>45000)
    throw new Error('INVALID_FREE_PROBE_TIMEOUT');
  const api=makeOTChartsClient({apiKey,fetchImpl});
  let usage;
  try {usage=await api.usage();}
  catch(e) {return {status:'PROVIDER_USAGE_UNAVAILABLE',connected:false,
    message:String(e&&e.message||'').replace(/Bearer\s+\S+/ig,'Bearer [REDACTED]')};}
  const check=checkFreeOnlyAccess(usage,symbol);
  if(!check.freeLive) return {status:'NO_FREE_LIVE_ACCESS',free:true,connected:false,
    reason:check.reason,paidUpgradeAttempted:false};
  // Real SSE connections can silently stall without closing. Abort the
  // read-only probe after a short bound; do NOT call polling endpoints.
  const samples=[];
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),timeoutMs);
  try {
    for await(const tick of api.stream({symbols:[symbol],signal:controller.signal})) {
      if(tick.symbol!==symbol||!Number.isFinite(tick.price)||!Number.isSafeInteger(tick.time))
        continue;
      const seconds=Math.floor(now()/1000);
      samples.push({time:tick.time,price:tick.price,localUtcAtReceipt:seconds,
        rawClockDifferenceSeconds:tick.time-seconds});
      if(samples.length>=maxTicks) break;
    }
  } catch(e) {return {status:controller.signal.aborted?'FREE_LIVE_STREAM_TIMEOUT':'FREE_LIVE_STREAM_FAILED',
      free:true,connected:false,
      reason:controller.signal.aborted?'NO_LIVE_QUOTES_WITHIN_LIMIT':
        String(e&&e.message||'').replace(/Bearer\s+\S+/ig,'Bearer [REDACTED]'),
      sampleCount:samples.length,paidUpgradeAttempted:false};}
  finally {clearTimeout(timer);}
  if(!samples.length) return {status:'FREE_LIVE_STREAM_EMPTY',free:true,connected:false,
    reason:'NO_NUMERIC_TICKS',paidUpgradeAttempted:false};
  const diffs=samples.map(x=>x.rawClockDifferenceSeconds).sort((a,b)=>a-b);
  const medianDifference=diffs[Math.floor(diffs.length/2)];
  const timestampsAreOrdered=samples.every((x,i)=>i===0||samples[i-1].time<=x.time);
  // Clock matching is preliminary. Never infer that numeric prices actually
  // equal Pocket Option OTC quotes without independent matching evidence.
  return {
    status:timestampsAreOrdered?'FREE_PROVIDER_STREAM_PROVISIONAL':'FREE_PROVIDER_CLOCK_ANOMALY',
    free:true,connected:true,source:'OTCHARTS_UNOFFICIAL_UNVERIFIED',
    symbol,sampleCount:samples.length,medianClockDifferenceSeconds:medianDifference,
    firstPrice:samples[0]?.price??null,lastPrice:samples.at(-1)?.price??null,
    clocksVerified:false,quotesMatchedToPocketOption:false,
    brokerHistoricalOutcomesTested:false,
    signalAllowed:false,orderAllowed:false,bipAllowed:false,
    paidUpgradeAttempted:false
  };
}
module.exports={probeFreePocketOtc};

if(require.main===module) {
  probeFreePocketOtc({apiKey:process.env.OTCHARTS_API_KEY})
    .then(x=>{process.stdout.write(JSON.stringify(x,null,2)+'\n');})
    .catch(e=>{
      // Redact even unexpected exceptions. Never dump configuration.
      process.stdout.write(JSON.stringify({status:'PROBE_ERROR',
        name:String(e?.name||'Error'),free:true,paidUpgradeAttempted:false})+'\n');
      process.exitCode=1;
    });
}
