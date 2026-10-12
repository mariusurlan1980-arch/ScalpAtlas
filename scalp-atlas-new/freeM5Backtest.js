'use strict';
/**
 * Research-only, ZERO COST, reproducible fixed-5m-expiry OTC sample evaluation.
 * Real (unverified) public sample data; no live quotes, no broker session,
 * no credentials, no orders and no signals to the Android app.
 *
 * Entry: FIRST observed tick AFTER 2 closed M5 candles and an EMA9/21 vote.
 * Exit: FIRST observed tick >= entry+300 seconds, within 10 seconds.
 * Not P&L on broker: actual execution may differ; payout is a fixed assumption.
 */
const fs=require('node:fs');
const zlib=require('node:zlib');
const crypto=require('node:crypto');

const PUBLISHER='PHCStanton/pocket-option-otc-dataset';
const SAMPLE='data/samples/EURUSD_otc_sample.csv.gz';
const TIMEFRAME=300, EXPIRY=300, ALLOWED_EXIT_LAG=10;
const MIN_CLOSED=22;

function readPublicTicks(file){
  const bytes=fs.readFileSync(file);
  const plain=file.endsWith('.gz') ? zlib.gunzipSync(bytes).toString('utf8') : bytes.toString('utf8');
  const lines=plain.trim().split(/\r?\n/);
  const keys=lines.shift().split(',').map(s=>s.trim().replace(/^"|"$/g,''));
  const ix={time:keys.indexOf('timestamp'),price:keys.indexOf('price'),symbol:keys.indexOf('asset'),session:keys.indexOf('session_id')};
  if(ix.time<0||ix.price<0||ix.symbol<0)throw Error('INPUT_SCHEMA_MISSING_REQUIRED_FIELDS');
  const parsed=[];
  for(const line of lines){
    if(!line.trim())continue;
    const cells=line.split(',');
    const t=Number(cells[ix.time]),p=Number(cells[ix.price]),s=cells[ix.symbol];
    if(!Number.isFinite(t)||t<0||!Number.isFinite(p)||p<=0||s!=='EURUSD_otc')continue;
    parsed.push({t,p,session:ix.session>=0?cells[ix.session]:null});
  }
  return parsed;
}

function ema(values,period){
  if(values.length<period)return NaN;
  const alpha=2/(period+1);
  let val=values[0];
  for(let i=1;i<values.length;i++)val=alpha*values[i]+(1-alpha)*val;
  return val;
}
function median(numbers){
  if(!numbers.length)return NaN;
  const s=[...numbers].sort((a,b)=>a-b);
  return s[Math.floor(s.length/2)];
}
function directionFromClosedBars(closed){
  if(closed.length<MIN_CLOSED)return null;
  const bars=closed.slice(-Math.max(MIN_CLOSED,30));
  // All inputs are ALREADY CLOSED. No active candle or future samples.
  if(bars.some((b,i)=>i>0&&b.start-bars[i-1].start!==TIMEFRAME))return null;
  const last=bars.at(-1),prev=bars.at(-2);
  const sameGreen=last.close>last.open&&prev.close>prev.open;
  const sameRed=last.close<last.open&&prev.close<prev.open;
  if(!sameGreen&&!sameRed)return null;
  const prices=bars.map(b=>b.close);
  const f=ema(prices,9),s=ema(prices,21);
  const direction=sameGreen&&f>s&&last.close>s?'BUY':
    sameRed&&f<s&&last.close<s?'SELL':null;
  if(!direction)return null;
  const baseline=median(bars.slice(-15,-1).map(b=>Math.abs(b.close-b.open)));
  const body=Math.abs(last.close-last.open);
  // Avoid zero-volatility and obvious one-candle impulse exhaustion.
  if(baseline<=0||body>2.5*baseline)return null;
  return direction;
}

/**
 * We only evaluate on a tick STARTING A NEW UTC M5 bucket.
 * The previous bar has just closed. The entry price is the new real tick,
 * never the previous close and never the signal bar's future close.
 */
function evaluateFixedExpiry(ticks,{payout=.92,delaySeconds=0}={}){
  if(!Number.isFinite(payout)||payout<0||payout>1||
     !Number.isFinite(delaySeconds)||delaySeconds<0||delaySeconds>10)
    throw Error('INVALID_BACKTEST_PARAMETERS');
  const rows=[...ticks];
  if(rows.some((x,i)=>!Number.isFinite(x.t)||!Number.isFinite(x.p)||x.p<=0||
     i>0&&rows[i-1].t>x.t))throw Error('BAD_OR_UNSORTED_TICK_INPUT');
  const closed=[], trades=[];
  let live=null,lastTick=null,pending=null,position=null,periods=0,gaps=0,skip=0;
  for(const tick of rows){
    const stamp=Math.floor(tick.t/TIMEFRAME)*TIMEFRAME;
    const gap=lastTick!==null&&(
      tick.t-lastTick.t>60 || (tick.session!==null&&lastTick.session!==null&&tick.session!==lastTick.session)
    );
    if(gap){
      gaps++;closed.length=0;live=null;pending=null;position=null;
    }
    // Existing position settlement at first actual quote at or after expiry.
    if(position&&tick.t>=position.entryTime+EXPIRY){
      const lag=tick.t-(position.entryTime+EXPIRY);
      if(lag<=ALLOWED_EXIT_LAG){
        const side=position.dir==='BUY'?1:-1,move=side*(tick.p-position.entryPrice);
        // Equality (tie) is not counted as a win or a paid outcome.
        const outcome=move>0?'WIN':move<0?'LOSS':'TIE';
        trades.push({...position,expiryTime:tick.t,expiryPrice:tick.p,
          expiryLagSeconds:lag,outcome,netUnits:outcome==='WIN'?payout:outcome==='LOSS'?-1:0});
      }else skip++;
      position=null;
    }
    if(!live){
      live={start:stamp,open:tick.p,high:tick.p,low:tick.p,close:tick.p};
    }else if(stamp!==live.start){
      if(stamp<live.start)throw Error('BAR_TIME_MOVED_BACKWARD');
      if(stamp-live.start!==TIMEFRAME){
        gaps++;closed.length=0;pending=null;
      }else{
        closed.push(Object.freeze({...live}));
        if(closed.length>60)closed.shift();
        periods++;
        // Compute decision from closed data only. The open quote of this
        // bucket is used exclusively for the entry, not the trend decision.
        pending=directionFromClosedBars(closed);
      }
      live={start:stamp,open:tick.p,high:tick.p,low:tick.p,close:tick.p};
      if(pending&&!position){
        // Fill delayed entries only on an observed tick after the chosen delay.
        // If first available tick is too late, do not manufacture a fill.
        position={dir:pending,signalTime:stamp,entryTime:null,entryPrice:null};
      }
      pending=null;
    }else{
      live.high=Math.max(live.high,tick.p);
      live.low=Math.min(live.low,tick.p);
      live.close=tick.p;
    }
    if(position&&position.entryTime===null&&tick.t>=position.signalTime+delaySeconds){
      const fillLag=tick.t-(position.signalTime+delaySeconds);
      if(fillLag<=10){position.entryTime=tick.t;position.entryPrice=tick.p;position.fillLagSeconds=fillLag;}
      else{position=null;skip++;}
    }
    lastTick=tick;
  }
  const wins=trades.filter(x=>x.outcome==='WIN').length,
    losses=trades.filter(x=>x.outcome==='LOSS').length,
    ties=trades.filter(x=>x.outcome==='TIE').length;
  const decisive=wins+losses,rate=decisive?wins/decisive:null,
    payoutBreakEven=1/(1+payout);
  return {source:'UNVERIFIED_PUBLIC_OTC_SAMPLE',symbol:'EURUSD_otc',
    timeFrameSeconds:TIMEFRAME,tradeExpirySeconds:EXPIRY,payoutAssumed:payout,
    payoutBreakEven,trades:trades.length,wins,losses,ties,unsettledOrSkipped:skip,
    observedCompleteM5:periods,discontinuities:gaps,
    winRateExcludingTies:rate,
    observedNetUnits:trades.reduce((v,x)=>v+x.netUnits,0),
    expectancyUnitsPerTrade:trades.length?trades.reduce((v,x)=>v+x.netUnits,0)/trades.length:null,
    insufficientSample:trades.length<200,
    dataRangeUtc:rows.length?[new Date(rows[0].t*1000).toISOString(),new Date(rows.at(-1).t*1000).toISOString()]:null,
    ticks:rows.length,rawTrades:trades};
}

if(require.main===module){
  const file=process.argv[2];
  if(!file){process.stderr.write('Usage: node freeM5Backtest.js <public_sample.csv.gz>\n');process.exit(2);}
  const buf=fs.readFileSync(file);
  const result=evaluateFixedExpiry(readPublicTicks(file));
  const {rawTrades,...summary}=result;
  process.stdout.write(JSON.stringify({...summary,sha256:crypto.createHash('sha256').update(buf).digest('hex'),
    originalRepo:PUBLISHER,originalPath:SAMPLE,benchmark:'unvalidated_public_sample_not_a_live_feed',
    caveat:'No claim of broker price equivalence or future winning signals'},null,2)+'\n');
}
module.exports={readPublicTicks,directionFromClosedBars,evaluateFixedExpiry};
