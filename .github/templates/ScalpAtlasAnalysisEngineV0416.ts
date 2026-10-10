import { SCALP_ATLAS_MODELS } from './atlas';

const atlasJson = JSON.stringify(SCALP_ATLAS_MODELS);

export const ANALYSIS_ENGINE_HTML = `<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>html,body{margin:0;background:#000}canvas{display:none}</style></head>
<body><canvas id="analysisCanvas"></canvas><script>
(function(){
  const ENGINE_VERSION='0.3.7-free-local-neural-filter';
  const ATLAS=${atlasJson};
  const canvas=document.getElementById('analysisCanvas');
  const ctx=canvas.getContext('2d',{willReadFrequently:true});
  const TF_MIN={M1:1,M2:2,M3:3,M5:5,M10:10,M15:15,M30:30,H1:60};

  function send(payload){try{const data=JSON.stringify(payload);if(window.ReactNativeWebView&&window.ReactNativeWebView.postMessage){window.ReactNativeWebView.postMessage(data);}else if(window.AndroidBridge&&window.AndroidBridge.postMessage){window.AndroidBridge.postMessage(data);}else if(window.parent&&window.parent!==window){window.parent.postMessage(data,'*');}}catch(e){}}

  function linReg(arr){
    const n=arr.length;if(n<2)return {slope:0,intercept:0,resid:999};
    const mx=arr.reduce((s,p)=>s+p.x,0)/n,my=arr.reduce((s,p)=>s+p.y,0)/n;
    let num=0,den=0;
    arr.forEach(p=>{num+=(p.x-mx)*(p.y-my);den+=(p.x-mx)*(p.x-mx);});
    const slope=num/(den||1),intercept=my-slope*mx;
    const resid=Math.sqrt(arr.reduce((s,p)=>s+(p.y-(slope*p.x+intercept))**2,0)/n);
    return {slope,intercept,resid};
  }

  function median(values){
    if(!values.length)return 0;
    const a=[...values].sort((x,y)=>x-y),m=Math.floor(a.length/2);
    return a.length%2?a[m]:(a[m-1]+a[m])/2;
  }

  function pivots(pts,h){
    if(pts.length<7)return [];
    const out=[],gap=Math.max(2,Math.floor(pts.length/18));
    for(let i=2;i<pts.length-2;i++){
      const y=pts[i].y,left=pts.slice(i-2,i).map(p=>p.y),right=pts.slice(i+1,i+3).map(p=>p.y);
      const high=y<Math.min(...left,...right)-h*.006;
      const low=y>Math.max(...left,...right)+h*.006;
      if(high||low){
        const type=high?'H':'L';
        if(!out.length||out[out.length-1].type!==type||i-out[out.length-1].i>gap)out.push({i,type,x:pts[i].x,y});
        else if((type==='H'&&y<out[out.length-1].y)||(type==='L'&&y>out[out.length-1].y))out[out.length-1]={i,type,x:pts[i].x,y};
      }
    }
    return out.slice(-9);
  }

  function candleTone(r,g,b){
    const mx=Math.max(r,g,b),mn=Math.min(r,g,b),sat=mx-mn;
    const greenish=(g>80&&g>r*1.10&&g>b*.84&&sat>30)||(g>115&&b>80&&r<125&&sat>28);
    const reddish=(r>105&&r>g*1.08&&r>b*1.03&&sat>30)||(r>155&&g>45&&g<155&&b<135);
    if(greenish&&!reddish)return 'GREEN';
    if(reddish&&!greenish)return 'RED';
    return null;
  }

  function isCandleColor(r,g,b){
    return candleTone(r,g,b)!==null;
  }

  function detectRecentCandleColors(data,w,h,x0,x1,y0,y1){
    // CLOSED CANDLE GUARD v0.3.2:
    // Ultima bară VIZIBILĂ dintr-un grafic live este considerată în formare,
    // deci NU participă la vot. Două scanări ale unui singur cadru nu sunt
    // echivalente cu două lumânări închise. Dacă nu putem delimita trei
    // corpuri distincte (2 închise + 1 activ), nu emitem semnal.
    const startX=Math.floor(x0+(x1-x0)*.42);
    const minPixels=Math.max(5,Math.floor((y1-y0)*.008));
    const labels=[];

    for(let x=startX;x<x1;x++){
      let green=0,red=0;
      for(let y=y0;y<y1;y+=2){
        const i=(y*w+x)*4;
        const tone=candleTone(data[i],data[i+1],data[i+2]);
        if(tone==='GREEN')green++;
        else if(tone==='RED')red++;
      }
      const best=Math.max(green,red);
      const tone=best>=minPixels
        ? (green>red*1.18?'GREEN':red>green*1.18?'RED':null)
        : null;
      labels.push({x,tone,count:best});
    }

    const runs=[];
    let run=null;
    for(const item of labels){
      if(item.tone){
        if(run&&run.tone===item.tone&&item.x===run.x2+1){
          run.x2=item.x;
          run.columns+=1;
          run.pixels+=item.count;
        }else{
          if(run)runs.push(run);
          run={tone:item.tone,x1:item.x,x2:item.x,columns:1,pixels:item.count};
        }
      }else if(run){
        runs.push(run);
        run=null;
      }
    }
    if(run)runs.push(run);

    const bodies=runs
      .filter(r=>r.columns>=2&&r.pixels>=minPixels*2)
      .sort((a,b)=>a.x2-b.x2);
    if(bodies.length<3)return null;

    // Respinge segmente late/unite (două lumânări apropiate ori text UI),
    // precum și spațieri neregulate sau o bară tăiată de marginea capturii.
    const trio=bodies.slice(-3);
    const maxBodyWidth=Math.max(8,Math.round(w*.024));
    if(trio.some(r=>r.columns>maxBodyWidth))return null;
    if(trio[2].x2>=x1-2)return null;

    const center=r=>(r.x1+r.x2)/2;
    const d1=center(trio[1])-center(trio[0]);
    const d2=center(trio[2])-center(trio[1]);
    if(d1<3||d2<3||Math.max(d1,d2)>Math.min(d1,d2)*1.85)return null;

    // A treia (ultima din dreapta) poate fi încă în formare: o excludem.
    // Dacă imaginea nu permite identificarea certă a corpurilor, returnăm
    // lista goală => AȘTEAPTĂ, niciodată BUY/SELL forțat.
    return {
      closedColors:[trio[0].tone,trio[1].tone],
      activeColor:trio[2].tone,
      // Corpsul activ este citit separat; NIMIC nu autorizează intrarea
      // când acesta s-a întors împotriva direcției semnalului.
      lastClosedBodyPixels:trio[1].pixels/Math.max(1,trio[1].columns),
      recentBodyReference:median(bodies.slice(-Math.min(10,bodies.length))
        .map(r=>r.pixels/Math.max(1,r.columns)))
    };
  }

  function buildPriceCurve(img){
    const iw=img.naturalWidth,ih=img.naturalHeight;
    if(!iw||!ih)return null;

    const maxW=720,scale=Math.min(1,maxW/iw);
    const w=Math.max(320,Math.round(iw*scale)),h=Math.max(240,Math.round(ih*scale));
    canvas.width=w;canvas.height=h;ctx.clearRect(0,0,w,h);ctx.drawImage(img,0,0,w,h);

    const data=ctx.getImageData(0,0,w,h).data;
    // Exclude bottom trading buttons and the far-right action/price panel.
    // Cropul Android a eliminat deja butoanele. Menținem ultimele lumânări
    // chiar când prețul a coborât spre limita de jos a graficului.
    const x0=Math.floor(w*.02),x1=Math.floor(w*.84),y0=Math.floor(h*.12),y1=Math.floor(h*.97);
    const recentCandleColors=detectRecentCandleColors(data,w,h,x0,x1,y0,y1);
    const bins=64,binW=(x1-x0)/bins,pts=[];
    const minSpan=Math.max(3,h*.008),clusterGap=Math.max(4,h*.014);

    for(let b=0;b<bins;b++){
      const bx0=Math.floor(x0+b*binW),bx1=Math.floor(x0+(b+1)*binW),ys=[];
      for(let x=bx0;x<bx1;x+=2){
        for(let y=y0;y<y1;y+=2){
          const i=(y*w+x)*4;
          if(isCandleColor(data[i],data[i+1],data[i+2]))ys.push(y);
        }
      }
      if(ys.length<4)continue;
      ys.sort((a,b)=>a-b);

      const clusters=[];let current=[ys[0]];
      for(let i=1;i<ys.length;i++){
        if(ys[i]-current[current.length-1]<=clusterGap)current.push(ys[i]);
        else{clusters.push(current);current=[ys[i]];}
      }
      clusters.push(current);

      let best=null,bestScore=-Infinity;
      for(const c of clusters){
        const span=c[c.length-1]-c[0];
        if(c.length<3||span<minSpan)continue;
        const center=median(c);
        // Prefer candle-shaped vertical clusters; penalize lower UI elements.
        const score=span*1.3+Math.min(c.length,30)*.8-Math.max(0,center-h*.70)*.25;
        if(score>bestScore){bestScore=score;best=c;}
      }
      if(!best)continue;
      pts.push({
        x:(bx0+bx1)/2,
        y:median(best),
        lo:best[0],
        hi:best[best.length-1],
        span:best[best.length-1]-best[0],
        n:best.length
      });
    }

    if(pts.length<10)return {pts,w,h,quality:0,anchor:null,recentCandleColors};

    // Remove isolated labels, icons and horizontal UI fragments.
    const cleaned=[];
    for(let i=0;i<pts.length;i++){
      const local=pts.slice(Math.max(0,i-2),Math.min(pts.length,i+3)).map(p=>p.y);
      if(Math.abs(pts[i].y-median(local))<h*.16)cleaned.push(pts[i]);
    }

    // Keep one coherent run, preferring the run nearest the most recent candles.
    const runs=[];let run=[];const maxGap=binW*2.4;
    for(const p of cleaned){
      if(!run.length||p.x-run[run.length-1].x<=maxGap)run.push(p);
      else{runs.push(run);run=[p];}
    }
    if(run.length)runs.push(run);
    const validRuns=runs.filter(r=>r.length>=8);
    let main=cleaned;
    if(validRuns.length){
      main=[...validRuns].sort((a,b)=>(b[b.length-1].x+b.length*binW*.2)-(a[a.length-1].x+a.length*binW*.2))[0];
    }
    if(main.length<8)return {pts:main,w,h,quality:0,anchor:null,recentCandleColors};

    const sm=main.map((p,i)=>{
      const local=main.slice(Math.max(0,i-1),Math.min(main.length,i+2)).map(q=>q.y);
      return {...p,y:median(local)};
    });

    const coverage=sm.length/bins;
    const density=sm.reduce((s,p)=>s+p.n,0)/(sm.length||1);
    const quality=Math.min(1,coverage*1.15+Math.min(1,density/14)*.2);
    const anchor=sm[sm.length-1]||null;
    const spanCoverage=sm.length>1?(sm[sm.length-1].x-sm[0].x)/w:0;
    return {pts:sm,w,h,quality,anchor,spanCoverage,recentCandleColors};
  }

  // v1.0.50 MULTI-FACTOR SCALP: estimated from chart PIXELS, not a broker OHLC feed.
  // EMA 9/21 and RSI 14 below operate on rasterized chart samples: they are
  // *proxies*, not certified indicator values calculated from true candle closes.
  // Signals remain EXPERIMENTAL and must be evaluated without trading.
  function emaOnSamples(values,period){
    if(!values.length)return 0;
    const alpha=2/(period+1);
    let value=values[0];
    for(let i=1;i<values.length;i++)value=alpha*values[i]+(1-alpha)*value;
    return value;
  }

  function rsiOnSamples(values,period){
    const n=Math.min(period,values.length-1);
    if(n<8)return 50;
    let gains=0,losses=0;
    for(let i=values.length-n;i<values.length;i++){
      const delta=values[i]-values[i-1];
      gains+=Math.max(0,delta);
      losses+=Math.max(0,-delta);
    }
    if(gains+losses<.00001)return 50;
    return 100*gains/(gains+losses);
  }

  function classify(curve){
    const {pts,w,h,quality}=curve;
    const wait=(reason,estimate,score,consensus)=>({
      clear:false,dir:'NONE',atlas:'Confluență neconfirmată',idx:50,
      score:Math.max(0,Math.min(.69,score||0)),
      trendStrength:0,recentStrength:0,microStrength:0,
      consensus:consensus||0,volatility:0,reason
    });

    if(pts.length<24||quality<.42||(curve.spanCoverage||0)<.28){
      return wait('Grafic insuficient de clar pentru 4 verificări independente • NU INTRA',null,0,0);
    }
    const values=pts.map(p=>(h-p.y)/h);
    const end=values[values.length-1];
    const fast=emaOnSamples(values,9);
    const slow=emaOnSamples(values,21);
    const avgPrevious=emaOnSamples(values.slice(0,-4),9);
    const slopeRecent=-linReg(pts.slice(-16)).slope*w/h;
    const slopeFull=-linReg(pts.slice(-Math.min(43,pts.length))).slope*w/h;
    const rsi=rsiOnSamples(values,14);
    const left=values.slice(-28,-14);
    const right=values.slice(-14);
    const risingStructure=Math.min(...right)>Math.min(...left)+.0025
      &&Math.max(...right)>Math.max(...left)+.0025;
    const fallingStructure=Math.min(...right)<Math.min(...left)-.0025
      &&Math.max(...right)<Math.max(...left)-.0025;
    const candle=curve.recentCandleColors;
    const closes=candle&&Array.isArray(candle.closedColors)?candle.closedColors:[];
    const closedGreen=closes.length===2&&closes[0]==='GREEN'&&closes[1]==='GREEN';
    const closedRed=closes.length===2&&closes[0]==='RED'&&closes[1]==='RED';

    // Five evidence groups: EMA position, slope, momentum (pixel-RSI),
    // price-action structure, closed candle colors. The last is optional:
    // the previous 2-color-only strategy was not independently reliable.
    const factorsBuy=[
      fast>slow+.002&&end>slow,
      slopeRecent>.022&&slopeFull>.012,
      rsi>=52&&rsi<=81&&fast>avgPrevious+.0005,
      risingStructure,
      closedGreen
    ];
    const factorsSell=[
      fast<slow-.002&&end<slow,
      slopeRecent<-.022&&slopeFull<-.012,
      rsi<=48&&rsi>=19&&fast<avgPrevious-.0005,
      fallingStructure,
      closedRed
    ];
    const buy=factorsBuy.filter(Boolean).length;
    const sell=factorsSell.filter(Boolean).length;
    const best=Math.max(buy,sell);

    // FREE OFFLINE STRATEGY ENSEMBLE v1.0.52.
    // Visual EMA/RSI are PIXEL PROXIES; no live OHLC or paid/cloud AI is used.
    // Strategies are complementary heuristics, not proven predictive systems.
    const previousBand=values.slice(-30,-8);
    const recentBand=values.slice(-8);
    const previousHigh=Math.max(...previousBand);
    const previousLow=Math.min(...previousBand);
    const localLow=Math.min(...recentBand);
    const localHigh=Math.max(...recentBand);
    const lastSix=values.slice(-7);
    const recentGain=end-values[values.length-7];
    const trendBuy=buy>=4&&factorsBuy[0]&&factorsBuy[1]&&factorsBuy[2];
    const trendSell=sell>=4&&factorsSell[0]&&factorsSell[1]&&factorsSell[2];
    const breakoutBuy=fast>slow+.002&&slopeRecent>.028&&
      end>previousHigh+.004&&recentGain>.007&&rsi>54&&rsi<79;
    const breakoutSell=fast<slow-.002&&slopeRecent<-.028&&
      end<previousLow-.004&&recentGain<-.007&&rsi<46&&rsi>21;
    const pullbackBuy=fast>slow+.002&&slopeFull>.018&&
      localLow<fast+.010&&end>fast+.003&&
      recentGain>.006&&rsi>=50&&rsi<78;
    const pullbackSell=fast<slow-.002&&slopeFull<-.018&&
      localHigh>fast-.010&&end<fast-.003&&
      recentGain<-.006&&rsi<=50&&rsi>22;

    const buySetups=[
      trendBuy?'EMA + impuls':null,
      breakoutBuy?'Breakout confirmat':null,
      pullbackBuy?'Pullback în tendință':null
    ].filter(Boolean);
    const sellSetups=[
      trendSell?'EMA + impuls':null,
      breakoutSell?'Breakout confirmat':null,
      pullbackSell?'Pullback în tendință':null
    ].filter(Boolean);
    const strategyBuy=buySetups.length, strategySell=sellSetups.length;
    const dominant=buy>sell?'BUY':'SELL';
    // Conflicting setups mean ABSTAIN, regardless of candle colors.
    const opposedSetups=strategyBuy>0&&strategySell>0;
    const winningSetups=dominant==='BUY'?buySetups:sellSetups;
    const strongEvidence=winningSetups.length>=1 && best>=4 &&
      (dominant==='BUY'?factorsBuy[0]&&factorsBuy[1]:factorsSell[0]&&factorsSell[1]);

    // Do not provide a candidate from one noisy vote or a tied vote.
    if(best>=3&&Math.abs(buy-sell)>=2&&!opposedSetups&&
      (dominant==='BUY'?strategyBuy>0:strategySell>0)){
      curve.previewDirection=dominant;
    }else{
      curve.previewDirection='NONE';
    }

    const confidence=best/5;
    const score=Math.min(.84,.46+best*.065+quality*.08+Math.min(.05,Math.abs(slopeRecent)*.14));
    if(curve.previewDirection==='NONE'){
      return wait('Strategiile gratuite nu sunt aliniate • AȘTEAPTĂ',null,score,confidence);
    }
    const dir=curve.previewDirection;
    const buySide=dir==='BUY';
    const factors=buySide?factorsBuy:factorsSell;
    const activeExpected=buySide?'GREEN':'RED';
    const active=candle?candle.activeColor:null;
    const conflicts=!strongEvidence || factors.filter(Boolean).length<4 ||
      opposedSetups || (buySide?sell>=2:buy>=2);
    if(conflicts){
      return wait('CANDIDAT '+(buySide?'BUY':'SELL')+' • lipsesc confirmări independente',dir,score,confidence);
    }

    // Do not issue sound when the current candle contradicts the vote,
    // or when the active candle is not discernible from the screenshot.
    if(active!==activeExpected){
      return wait('Lumânarea activă nu confirmă direcția • NU INTRA',dir,score,confidence);
    }
    const recentSteps=values.slice(1).map((v,i)=>Math.abs(v-values[i]));
    const baseStep=Math.max(.001,median(recentSteps.slice(-25,-1)));
    const lastStep=recentSteps[recentSteps.length-1]||0;
    if(lastStep>baseStep*4.5+.006){
      return wait('Impuls brusc posibil epuizat • NU INTRA',dir,score,confidence);
    }
    const lastBody=Number(candle&&candle.lastClosedBodyPixels)||0;
    const referenceBody=Number(candle&&candle.recentBodyReference)||0;
    if(referenceBody>0&&lastBody/referenceBody>2.6){
      return wait('Lumânare mare față de precedente • așteaptă',dir,score,confidence);
    }
    // RSI proxy extremes are a risk veto, not evidence of an automatic reversal.
    if((buySide&&rsi>79)||( !buySide&&rsi<21 )){
      return wait('Impuls aproape de epuizare conform oscilatorului estimat',dir,score,confidence);
    }

    const model='OFFLINE • '+winningSetups.join(' + ');
    return {
      clear:true,dir,atlas:model,idx:50,score,
      trendStrength:Math.min(1,Math.abs(slopeFull)/.28),
      recentStrength:Math.min(1,Math.abs(slopeRecent)/.35),
      microStrength:Math.min(1,Math.abs(fast-slow)/.045),
      consensus:confidence,
      volatility:Math.min(1,median(recentSteps)/.035),
      reason:''
    };
  }

  function expiryFor(tf,score){
    // M10 este timeframe-ul fix de analiză. Expirarea trebuie să aibă suficient timp
    // pentru ca direcția confirmată să se dezvolte, fără a coborî la zgomot de 1–3 minute.
    // Scalare conservatoare: semnal foarte puternic = 5 min, mediu = 6 min, minim acceptat = 7 min.
    if(tf==='M10'){
      if(score>=.84)return 5;
      if(score>=.78)return 6;
      return 7;
    }

    const base=TF_MIN[tf]||15;
    let mult=score>=.82?1:score>=.72?1.25:1.5;
    let mins=Math.max(1,Math.round(base*mult));
    if(tf==='H1')mins=Math.round(mins/5)*5;
    return mins;
  }

  function directionDurationFor(tf,result,curve){
    const base=TF_MIN[tf]||15;
    const trend=Math.max(0,Math.min(1,result.trendStrength||0));
    const recent=Math.max(0,Math.min(1,result.recentStrength||0));
    const micro=Math.max(0,Math.min(1,result.microStrength||0));
    const consensus=Math.max(0,Math.min(1,result.consensus||0));
    const volatility=Math.max(0,Math.min(1,result.volatility||0));
    const quality=Math.max(0,Math.min(1,curve.quality||0));
    const score=Math.max(0,Math.min(1,result.score||0));

    // Fereastra reprezintă aproximativ 1–3 lumânări, ajustată după stabilitatea structurii.
    // Trendul și consensul o extind; volatilitatea mare și breakout-urile o scurtează.
    const stability=.34*score+.22*trend+.18*recent+.08*micro+.10*consensus+.08*quality;
    const normalized=Math.max(0,Math.min(1,(stability-.52)/.38));
    let candles=1+normalized*2;
    candles*=1-Math.min(.22,volatility*.18);
    if(String(result.atlas||'').includes('Breakout'))candles*=.90;
    candles=Math.max(.85,Math.min(3,candles));

    const roundMinutes=(value)=>{
      if(value>=20)return Math.max(5,Math.round(value/5)*5);
      return Math.max(1,Math.round(value));
    };
    let min=roundMinutes(base*Math.max(.75,candles*.70));
    let max=roundMinutes(base*Math.min(3.5,candles*1.30));
    if(max<=min)max=min+(base>=30?5:Math.max(1,Math.round(base*.5)));

    return {min,max,trendStrength:trend,volatility};
  }

  function trendLinesFor(curve,result){
    const pv=pivots(curve.pts,curve.h);
    const highs=pv.filter(p=>p.type==='H').slice(-2),lows=pv.filter(p=>p.type==='L').slice(-2);
    const lines=[];
    const addExtended=(items,kind,envelopeKey)=>{
      let a,b;
      if(items.length>=2){a=items[0];b=items[1];}
      else{
        const sample=curve.pts.slice(-Math.max(10,Math.floor(curve.pts.length*.48))).map(p=>({x:p.x,y:p[envelopeKey]}));
        if(sample.length<2)return;
        const reg=linReg(sample),first=sample[0];
        a={x:first.x,y:reg.slope*first.x+reg.intercept};
        b={x:sample[sample.length-1].x,y:reg.slope*sample[sample.length-1].x+reg.intercept};
      }
      const endX=Math.min(curve.w*.94,Math.max(b.x+curve.w*.10,b.x));
      const endY=b.y+(endX-b.x)*(b.y-a.y)/Math.max(1,b.x-a.x);
      lines.push({kind,x1:a.x/curve.w,y1:Math.max(0,Math.min(1,a.y/curve.h)),x2:endX/curve.w,y2:Math.max(0,Math.min(1,endY/curve.h))});
    };
    addExtended(lows,'support','hi');
    addExtended(highs,'resistance','lo');
    const anchor=curve.anchor;
    if(anchor){
      const y=result.clear?(result.dir==='BUY'?Math.max(0,anchor.lo-curve.h*.018):Math.min(curve.h,anchor.hi+curve.h*.018)):((anchor.lo+anchor.hi)/2);
      lines.push({kind:'confirmation',x1:Math.max(0,anchor.x-curve.w*.13)/curve.w,y1:y/curve.h,x2:Math.min(curve.w,anchor.x+curve.w*.09)/curve.w,y2:y/curve.h});
    }
    return lines;
  }

  // LOCAL NEURAL AI v1.0.53 (no service, no subscription, no internet).
  // The weights were trained on SYNTHETIC chart-like price traces to classify
  // the currently visible trend, not future market returns. The neural classifier
  // is an extra abstention filter ONLY. It never invents BUY or SELL.
  const OFFLINE_AI_WEIGHTS=__SCALP_ATLAS_OFFLINE_MODEL_V1053__;
  function chartFeaturesForAi(curve){
    const pts=curve&&curve.pts;
    if(!pts||pts.length<28||!Number.isFinite(curve.h)||curve.h<=0)return null;
    const n=pts.length;
    const raw=pts.map(p=>(curve.h-p.y)/curve.h);
    if(raw.some(v=>!Number.isFinite(v)))return null;
    const values=[];
    for(let j=0;j<40;j++){
      const pos=(n-1)*j/39,lo=Math.floor(pos),hi=Math.min(n-1,lo+1),mix=pos-lo;
      values.push(raw[lo]*(1-mix)+raw[hi]*mix);
    }
    const span=Math.max(1e-6,Math.max(...values)-Math.min(...values));
    if(span<.003)return null;
    const v=values.map(z=>(z-values[0])/span);
    const d=v.slice(1).map((x,i)=>x-v[i]);
    const slope=(series)=>{
      const count=series.length,mean=(count-1)/2,meanY=series.reduce((a,b)=>a+b,0)/count;
      let num=0,den=0;
      series.forEach((y,i)=>{num+=(i-mean)*(y-meanY);den+=(i-mean)**2;});
      return den?num/den*(count-1):0;
    };
    const up=(xs)=>2*xs.filter(x=>x>0).length/xs.length-1;
    const net=v[39];
    const movement=d.reduce((a,b)=>a+Math.abs(b),0);
    const f=[
      slope(v),slope(v.slice(-20)),slope(v.slice(-10)),net,
      v[39]-v[26],v[26]-v[12],
      up(d),up(d.slice(-14)),
      Math.min(5,median(d.map(Math.abs))*10),
      Math.log1p(movement/Math.max(Math.abs(net),.04))
    ];
    return f.every(Number.isFinite)?f:null;
  }
  function localNeuralVote(curve){
    const x=chartFeaturesForAi(curve),m=OFFLINE_AI_WEIGHTS;
    if(!x||!m||m.inputMean.length!==10||m.w1.length!==16||m.w2.length!==3)
      return {direction:'WAIT',confidence:0,margin:0};
    const scaled=x.map((v,i)=>(v-m.inputMean[i])/Math.max(.001,m.inputStd[i]));
    const h=m.w1.map((row,j)=>Math.tanh(row.reduce((a,w,i)=>a+w*scaled[i],m.b1[j])));
    const logits=m.w2.map((row,k)=>row.reduce((a,w,i)=>a+w*h[i],m.b2[k]));
    const hi=Math.max(...logits),exp=logits.map(v=>Math.exp(v-hi)),sum=exp.reduce((a,b)=>a+b,0);
    const p=exp.map(v=>v/sum);
    const k=p.indexOf(Math.max(...p));
    const other=Math.max(...p.filter((_,i)=>i!==k));
    return {direction:m.labels[k]||'WAIT',confidence:p[k],margin:p[k]-other};
  }
  function applyLocalNeuralGate(curve,r){
    const ml=localNeuralVote(curve);
    const agrees=r&&r.clear&&ml.direction===r.dir&&ml.confidence>=.80&&ml.margin>=.50;
    if(r&&r.clear&&!agrees){
      // Always fail closed if neural weights, pixels or decision are uncertain.
      curve.previewDirection='NONE';
      return {...r,clear:false,dir:'NONE',score:Math.min(.69,r.score),
        reason:'AI local neconfirmat sau nesigur • FĂRĂ BIP'};
    }
    if(r&&r.clear&&agrees){
      return {...r,atlas:r.atlas+' + AI LOCAL'};
    }
    // A non-trade is NEVER upgraded to a trade by machine learning.
    if(ml.direction!==curve.previewDirection)curve.previewDirection='NONE';
    return r;
  }

  function run(dataUrl,timeframe){
    const img=new Image();
    img.onload=function(){
      try{
        const curve=buildPriceCurve(img);
        if(!curve){send({type:'ERROR',message:'Imaginea nu a putut fi citită.'});return;}
        const baseline=classify(curve),r=applyLocalNeuralGate(curve,baseline),anchor=curve.anchor;
        const duration=r.clear?directionDurationFor(timeframe,r,curve):null;
        send({
          type:'RESULT',
          result:{
            signal:r.clear?r.dir:'NONE',
            // Diagnostic only; candidate can be present while signal=NONE.
            candidateDirection:(curve.previewDirection==='BUY'||curve.previewDirection==='SELL')
              ?curve.previewDirection:'NONE',
            candidateConfirmed:!!r.clear,
            pattern:r.atlas,
            probability:Math.round(r.score*100),
            expiry:r.clear?expiryFor(timeframe,r.score):null,
            directionMin:duration?duration.min:null,
            directionMax:duration?duration.max:null,
            trendStrength:duration?Math.round(duration.trendStrength*100):null,
            volatility:duration?Math.round(duration.volatility*100):null,
            reason:r.reason||'',
            atlasCount:ATLAS.length,
            anchorX:anchor?anchor.x/curve.w:null,
            anchorY:anchor?((anchor.lo+anchor.hi)/2)/curve.h:null,
            quality:Math.round(curve.quality*100),
            trendLines:trendLinesFor(curve,r),
            engineVersion:ENGINE_VERSION
          }
        });
      }catch(e){
        send({type:'ERROR',message:e&&e.message?e.message:String(e)});
      }
    };
    img.onerror=function(){send({type:'ERROR',message:'Fotografia nu a putut fi încărcată în motorul de analiză.'});};
    img.src=dataUrl;
  }

  function onMessage(event){
    try{
      const msg=JSON.parse(event.data||'{}');
      if(msg.type==='ANALYZE'&&msg.dataUrl)run(msg.dataUrl,msg.timeframe||'M15');
    }catch(e){
      send({type:'ERROR',message:'Mesaj de analiză invalid.'});
    }
  }

  // Native overlay can call the analyzer directly. This avoids large MessageEvent
  // payloads and reduces latency / dropped frames on Android WebView.
  window.ScalpAtlasAnalyze=function(dataUrl,timeframe){run(dataUrl,timeframe||'M10');};
  window.ScalpAtlasPing=function(){send({type:'READY',atlasCount:ATLAS.length,engineVersion:ENGINE_VERSION});};
  document.addEventListener('message',onMessage);
  window.addEventListener('message',onMessage);
  window.ScalpAtlasPing();
})();
</script></body></html>`;
