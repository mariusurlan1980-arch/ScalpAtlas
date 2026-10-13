'use strict';

/**
 * SCALP ATLAS — independent research core for REAL QUOTE DATA, not screenshots.
 * It has NO order API, sound trigger, direction prediction, credentials or
 * screen capture. An authorized third-party stream must be connected separately.
 *
 * Provider timestamps may use a broker-local clock. REQUIRE a previously
 * verified UTC offset; do not guess or silently use the phone's local time.
 */
function createLiveOhlcCollector({
  symbol, timeframeSeconds = 300, providerToUtcOffsetSeconds,
  nowSeconds = () => Math.floor(Date.now() / 1000),
  maxStaleSeconds = 12, historyBars = 100
}) {
  if (typeof symbol !== 'string' || !symbol ||
      !Number.isInteger(timeframeSeconds) || ![300, 600, 900].includes(timeframeSeconds) ||
      !Number.isInteger(providerToUtcOffsetSeconds) ||
      Math.abs(providerToUtcOffsetSeconds) > 86400) {
    throw new Error('SYMBOL_TIMEFRAME_OR_CLOCK_CALIBRATION_REQUIRED');
  }
  let live = null, lastTime = null, lastReceived = null, gap = false;
  const closed = [];

  function status() {
    if (lastReceived === null) return {state:'WAIT',reason:'NO_TICKS'};
    if (nowSeconds() - lastReceived > maxStaleSeconds)
      return {state:'WAIT',reason:'STALE_FEED'};
    if (gap) return {state:'WAIT',reason:'HISTORY_GAP'};
    if (closed.length < 15) return {state:'WAIT',reason:'INSUFFICIENT_CLOSED_OHLC'};
    return {state:'READY_FOR_RESEARCH',reason:'REAL_DATA_UNVALIDATED_FOR_TRADING'};
  }

  function tick(input) {
    if (!input || input.symbol !== symbol) return {accepted:false,reason:'WRONG_SYMBOL'};
    const {price,time} = input;
    if (!Number.isFinite(price) || price <= 0 || !Number.isSafeInteger(time))
      return {accepted:false,reason:'INVALID_QUOTE'};
    const utc = time + providerToUtcOffsetSeconds;
    const localNow = nowSeconds();
    if (!Number.isSafeInteger(utc) || utc > localNow + 3 ||
        localNow - utc > maxStaleSeconds)
      return {accepted:false,reason:'UNVERIFIED_CLOCK_OR_STALE_QUOTE'};
    if (lastTime !== null && utc < lastTime)
      return {accepted:false,reason:'OUT_OF_ORDER_TICK'};
    const begin = Math.floor(utc / timeframeSeconds) * timeframeSeconds;
    let completed = null;
    if (live && begin < live.time)
      return {accepted:false,reason:'BAR_REGRESSION'};
    if (live && begin !== live.time) {
      if (begin - live.time !== timeframeSeconds) {
        // A missing bar invalidates ALL unbroken historical context. Never
        // stitch two non-consecutive candles into a fictitious strategy setup.
        gap = true; closed.length = 0;
      } else {
        completed = {...live,complete:true};
        closed.push(completed);
        if (closed.length > historyBars) closed.shift();
        // Gap is cleared only after a fresh contiguous sequence has formed.
        if (gap && closed.length >= 15) gap = false;
      }
      live = null;
    }
    if (!live) live = {symbol,time:begin,open:price,high:price,low:price,close:price,complete:false};
    else {
      live.high = Math.max(live.high,price);
      live.low = Math.min(live.low,price);
      live.close = price;
    }
    lastTime = utc;
    lastReceived = localNow;
    return {accepted:true,completed,bar:{...live},status:status()};
  }
  function snapshot() {
    return {symbol,timeframeSeconds,status:status(),lastTickUtc:lastTime,
      live:live?{...live}:null,closed:closed.map(b=>({...b}))};
  }
  function reset() {
    live=null;lastTime=null;lastReceived=null;gap=false;closed.length=0;
  }
  return {tick,status,snapshot,reset};
}

function createSseDecoder() {
  let buffer='';
  return {
    push(chunk) {
      if (typeof chunk !== 'string') throw new TypeError('SSE chunk must be text');
      buffer += chunk.replace(/\r\n/g,'\n');
      if (buffer.length > 200_000) throw new Error('SSE_FRAME_TOO_LARGE');
      const events=[];
      while (buffer.includes('\n\n')) {
        const idx=buffer.indexOf('\n\n');
        const frame=buffer.slice(0,idx);
        buffer=buffer.slice(idx+2);
        const lines=frame.split('\n').filter(x=>x&&!x.startsWith(':'));
        const kind=lines.find(x=>x.startsWith('event:'))?.slice(6).trim();
        const data=lines.filter(x=>x.startsWith('data:')).map(x=>x.slice(5).trim()).join('\n');
        if (kind==='tick' && data) {
          try {
            const obj=JSON.parse(data);
            if (obj && typeof obj==='object') events.push(obj);
          } catch { /* invalid event is ignored, NEVER traded */ }
        }
      }
      return events;
    }
  };
}

module.exports={createLiveOhlcCollector,createSseDecoder};
