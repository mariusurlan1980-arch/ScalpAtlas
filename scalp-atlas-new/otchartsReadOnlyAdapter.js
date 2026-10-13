'use strict';

/**
 * OTCharts read-only Pocket Option data API adapter (unofficial source).
 * Not connected to the original Android APK. A key is required at runtime,
 * never stored in GitHub. All requests use fixed HTTPS host and GET methods.
 */
const ORIGIN = 'https://otcharts.com';
function makeOTChartsClient({ apiKey, fetchImpl = globalThis.fetch } = {}) {
  if (typeof apiKey !== 'string' || apiKey.trim().length < 8 || /[\r\n]/.test(apiKey))
    throw new Error('OTCHARTS_KEY_REQUIRED');
  if (typeof fetchImpl !== 'function') throw new Error('FETCH_REQUIRED');
  const token=apiKey;
  async function get(url, { signal, accept = 'application/json' }={}) {
    if (!(url instanceof URL) || url.origin !== ORIGIN || !url.pathname.startsWith('/v1/'))
      throw new Error('UNAUTHORIZED_DESTINATION');
    const response = await fetchImpl(url.toString(), {
      method:'GET',redirect:'error',signal,
      headers:{ Authorization:'Bearer '+token,Accept:accept,'User-Agent':'ScalpAtlas-ReadOnly-Research/0.1'}
    });
    // Avoid including provider error-body text, which may reflect credential data.
    if (!response.ok) {
      const reason = response.status===401?'KEY_REJECTED'
        : response.status===403?'BOOK_OR_PLAN_UNAVAILABLE'
        : response.status===429?'QUOTA_OR_STREAM_LIMIT'
        : response.status===502?'PROVIDER_OFFLINE':'PROVIDER_HTTP_ERROR';
      throw new Error(reason+':'+response.status);
    }
    return response;
  }
  async function json(url,opts) {
    const res=await get(url,opts);
    const data=await res.json();
    if (!data || typeof data!=='object')throw new Error('PROVIDER_INVALID_JSON');
    return data;
  }
  const endpoint=(route,params={})=>{
    const url=new URL(route,ORIGIN);
    for(const [name,value] of Object.entries(params))url.searchParams.set(name,String(value));
    return url;
  };
  const usage=({signal}={})=>json(endpoint('/v1/usage'),{signal});
  const symbols=({signal}={})=>json(endpoint('/v1/symbols',{venue:'otc'}),{signal});
  async function candles({symbol,timeframeSeconds=300,limit=100,signal}={}) {
    assertSymbol(symbol);
    if (![300,600,900].includes(timeframeSeconds)||!Number.isInteger(limit)||limit<1||limit>1500)
      throw new Error('INVALID_CANDLE_REQUEST');
    const result=await json(endpoint('/v1/candles',{
      venue:'otc',symbol,tf:timeframeSeconds,limit
    }),{signal});
    // Vendor's Pocket Option recorded candle timestamps reportedly UTC+2.
    // Retain RAW provider timestamps until external clock verification.
    if (!Array.isArray(result.candles))throw new Error('BAD_CANDLES_RESPONSE');
    const bars=result.candles;
    for (let i=0;i<bars.length;i++){
      const c=bars[i];
      if (!Number.isSafeInteger(c.time)||![c.open,c.high,c.low,c.close].every(Number.isFinite)||
          c.low<=0||c.low>Math.min(c.open,c.close)||c.high<Math.max(c.open,c.close))
        throw new Error('INVALID_HISTORY_BAR');
      if(i>0&&c.time<=bars[i-1].time)throw new Error('HISTORY_NOT_SORTED');
    }
    const reportedGaps=result.gaps||{};
    const observedGaps=bars.reduce((n,c,i)=>i>0&&c.time-bars[i-1].time!==timeframeSeconds?n+1:n,0);
    return {source:'OTCHARTS_UNVERIFIED',symbol,timeframeSeconds,
      providerTimeUncalibrated:true,hasGap:Boolean(reportedGaps.runs||reportedGaps.missingBars||observedGaps),
      bars:bars.map(x=>({...x,complete:false}))};
  }
  async function *stream({symbols:list,signal}={}) {
    const wanted=Array.isArray(list)?list:[list];
    if (!wanted.length||wanted.length>5||new Set(wanted).size!==wanted.length)
      throw new Error('INVALID_SYMBOL_LIST');
    wanted.forEach(assertSymbol);
    const url=endpoint('/v1/stream',{venue:'otc',symbol:wanted.join(',')});
    const response=await get(url,{signal,accept:'text/event-stream'});
    if (!/text\/event-stream/i.test(response.headers.get('content-type')||''))
      throw new Error('NOT_AN_SSE_STREAM');
    if (!response.body || typeof response.body.getReader!=='function')
      throw new Error('STREAM_BODY_UNAVAILABLE');
    let confirmed=false,authorized=new Set(),buf='',max=200000;
    const decoder=new TextDecoder(),reader=response.body.getReader();
    try {
      while (true) {
        const {done,value}=await reader.read();
        if(done) break;
        buf+=decoder.decode(value,{stream:true}).replace(/\r\n/g,'\n');
        if(buf.length>max)throw new Error('SSE_FRAME_TOO_LARGE');
        let idx;
        while((idx=buf.indexOf('\n\n'))!==-1) {
          const frame=buf.slice(0,idx);buf=buf.slice(idx+2);
          const lines=frame.split('\n');
          const event=lines.find(x=>x.startsWith('event:'))?.slice(6).trim();
          const data=lines.filter(x=>x.startsWith('data:')).map(x=>x.slice(5).trim()).join('\n');
          if(!data||!event)continue;
          let v;
          try { v=JSON.parse(data); } catch { continue; }
          if(event==='connected') {
            if(!Array.isArray(v.symbols))throw new Error('INVALID_SUBSCRIPTION');
            authorized=new Set(v.symbols.filter(x=>wanted.includes(x)));
            confirmed=true;
            if(authorized.size!==wanted.length)throw new Error('INCOMPLETE_SUBSCRIPTION');
            continue;
          }
          if(event==='dropped') {
            if(Array.isArray(v.dropped)&&v.dropped.some(x=>wanted.includes(x)))
              throw new Error('SYMBOL_DROPPED');
            continue;
          }
          if(event!=='tick'||!confirmed||!authorized.has(v.symbol))continue;
          if(Number.isFinite(v.price)&&v.price>0&&Number.isSafeInteger(v.time)) {
            yield {symbol:v.symbol,price:v.price,time:v.time,source:'OTCHARTS_UNVERIFIED'};
          }
        }
      }
      // A broken stream is an outage; never treat EOF as no-price-change.
      throw new Error('STREAM_CLOSED');
    } finally {
      try {await reader.cancel()} catch { /* no-op */ }
      reader.releaseLock();
    }
  }
  return {usage,symbols,candles,stream};
}
function assertSymbol(symbol) {
  if(typeof symbol!=='string'||!/^[A-Z0-9#]{3,24}_otc$/.test(symbol))
    throw new Error('INVALID_POCKET_OTC_SYMBOL');
}
/**
 * Read-only ZERO-BUDGET entitlement check. Read /v1/usage first.
 * Never attempt a paid upgrade, subscribe to a stream or call candles from
 * this function. The API provider has published conflicting free-tier limits;
 * the actual authenticated response is decisive.
 */
function checkFreeOnlyAccess(usage, symbol = 'EURUSD_otc') {
  if(!usage || typeof usage!=='object')return {freeLive:false,reason:'USAGE_NOT_VERIFIED'};
  if(!Array.isArray(usage.books)||!usage.books.includes('otc'))
    return {freeLive:false,reason:'OTC_BOOK_NOT_OPEN'};
  const name=String(usage.plan||usage.planName||'').toLowerCase();
  if(!name.includes('free'))return {freeLive:false,reason:'NOT_FREE_PLAN'};
  if(!usage.streams || !Number.isSafeInteger(usage.streams.limit) ||
     !Number.isSafeInteger(usage.streams.open))
    return {freeLive:false,reason:'STREAM_ENTITLEMENT_UNVERIFIED'};
  if(usage.streams.limit<1)return {freeLive:false,reason:'NO_FREE_STREAM'};
  if(usage.streams.open>=usage.streams.limit)
    return {freeLive:false,reason:'FREE_STREAM_SLOT_BUSY'};
  if(usage.streams.instrumentsPerStream !== null &&
     (!Number.isSafeInteger(usage.streams.instrumentsPerStream)||
      usage.streams.instrumentsPerStream<1))
    return {freeLive:false,reason:'FREE_STREAM_INSTRUMENT_CAP_UNKNOWN'};
  try { assertSymbol(symbol); } catch{return {freeLive:false,reason:'INVALID_SYMBOL'};}
  return {freeLive:true,reason:'FREE_SLOT_AVAILABLE_UNTESTED',
    caveat:'STREAM_STILL_REQUIRES_REAL_PROVIDER_CONFIRMATION_AND_CLOCK_VALIDATION'};
}
module.exports={makeOTChartsClient,checkFreeOnlyAccess};
