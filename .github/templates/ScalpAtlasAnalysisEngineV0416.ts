import { SCALP_ATLAS_MODELS } from './atlas';

const atlasJson = JSON.stringify(SCALP_ATLAS_MODELS);

export const ANALYSIS_ENGINE_HTML = `<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>html,body{margin:0;background:#000}canvas{display:none}</style></head>
<body><canvas id="analysisCanvas"></canvas><script>
(function(){
  const ENGINE_VERSION='3.2.3-wick-rejection-research';
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

  function isCandleColor(r,g,b){
    const mx=Math.max(r,g,b),mn=Math.min(r,g,b),sat=mx-mn;
    const greenish=(g>80&&g>r*1.10&&g>b*.84&&sat>30)||(g>115&&b>80&&r<125&&sat>28);
    const reddish=(r>105&&r>g*1.08&&r>b*1.03&&sat>30)||(r>155&&g>45&&g<155&&b<135);
    return greenish||reddish;
  }

  function buildPriceCurve(img){
    const iw=img.naturalWidth,ih=img.naturalHeight;
    if(!iw||!ih)return null;

    const maxW=720,scale=Math.min(1,maxW/iw);
    const w=Math.max(320,Math.round(iw*scale)),h=Math.max(240,Math.round(ih*scale));
    canvas.width=w;canvas.height=h;ctx.clearRect(0,0,w,h);ctx.drawImage(img,0,0,w,h);

    const data=ctx.getImageData(0,0,w,h).data;
    // Exclude bottom trading buttons and the far-right action/price panel.
    const x0=Math.floor(w*.02),x1=Math.floor(w*.84),y0=Math.floor(h*.12),y1=Math.floor(h*.73);
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

    if(pts.length<10)return {pts,w,h,quality:0,anchor:null};

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
    if(main.length<8)return {pts:main,w,h,quality:0,anchor:null};

    const sm=main.map((p,i)=>{
      const local=main.slice(Math.max(0,i-1),Math.min(main.length,i+2)).map(q=>q.y);
      return {...p,y:median(local)};
    });

    const coverage=sm.length/bins;
    const density=sm.reduce((s,p)=>s+p.n,0)/(sm.length||1);
    const quality=Math.min(1,coverage*1.15+Math.min(1,density/14)*.2);
    const anchor=sm[sm.length-1]||null;
    const spanCoverage=sm.length>1?(sm[sm.length-1].x-sm[0].x)/w:0;
    return {pts:sm,w,h,quality,anchor,spanCoverage};
  }

  /**
   * Optical candle evidence: unlike the legacy curve, this checks separate
   * candle-colour strips, body widths, and the last TWO completed bars.
   * It never claims actual broker OHLC prices; full OHLC reconstruction
   * requires a verified data feed or calibrated chart scale.
   *
   * Fail closed: no distinct bars = NO SIGNAL. The rightmost bar may still
   * be forming, so only the two bars immediately to its left are considered.
   */
  function candleEvidence(curve,wantedDirection){
    if(!curve||!curve.w||!curve.h)return {ok:false,reason:'Graficul nu poate fi citit ca lumânări'};
    const w=curve.w,h=curve.h;
    const px=ctx.getImageData(0,0,w,h).data;
    const left=Math.floor(w*.08),right=Math.floor(w*.85);
    const top=Math.floor(h*.12),bottom=Math.floor(h*.83);
    const cols=[];
    for(let x=left;x<right;x++){
      let red=0,green=0;
      let redRun=0,greenRun=0,maxRedRun=0,maxGreenRun=0;
      let redTop=bottom,greenTop=bottom,redBottom=top,greenBottom=top;
      for(let y=top;y<bottom;y++){
        const i=(y*w+x)*4;
        const r=px[i],g=px[i+1],b=px[i+2];
        const isRed=r>105&&r>g*1.10&&r>b*1.04&&r-Math.min(g,b)>36;
        const isGreen=g>80&&g>r*1.12&&g>b*.88&&g-Math.min(r,b)>33;
        if(isRed){red++;redRun++;redTop=Math.min(redTop,y);redBottom=y;}
        else redRun=0;
        if(isGreen){green++;greenRun++;greenTop=Math.min(greenTop,y);greenBottom=y;}
        else greenRun=0;
        if(redRun>maxRedRun)maxRedRun=redRun;
        if(greenRun>maxGreenRun)maxGreenRun=greenRun;
      }
      const redBody=red>=5&&maxRedRun>=3&&red>green*1.4;
      const greenBody=green>=5&&maxGreenRun>=3&&green>red*1.4;
      let color=null,body=0,extent=0;
      if(redBody&&!greenBody){color='SELL';body=maxRedRun;extent=redBottom-redTop;}
      if(greenBody&&!redBody){color='BUY';body=maxGreenRun;extent=greenBottom-greenTop;}
      cols.push({x,color,body,extent});
    }

    const runs=[];
    for(const c of cols){
      if(!c.color)continue;
      const last=runs[runs.length-1];
      // A one-pixel EMPTY column is a possible bar boundary, not a bridge.
      // With <=2, two adjacent same-colour M5 candles merged into one
      // virtual candle; the optical two-closed-bar gate then falsely rejected
      // a valid matching pair as "culori opuse". Touching bars remain merged
      // (ambiguous pixels must fail closed rather than invent two bars).
      if(last&&last.color===c.color&&c.x-last.end<=1){
        last.end=c.x;last.samples++;last.maxBody=Math.max(last.maxBody,c.body);
        last.extent=Math.max(last.extent,c.extent);
      }else runs.push({start:c.x,end:c.x,color:c.color,samples:1,maxBody:c.body,extent:c.extent});
    }

    const maxWidth=Math.max(12,Math.round(w*.045));
    const candles=runs.filter(c=>
      c.samples>=2&&c.end-c.start+1<=maxWidth&&
      c.maxBody>=3&&c.extent>=4
    );
    if(candles.length<3)return {ok:false,reason:'Nu pot identifica trei lumânări distincte',count:candles.length};
    const current=candles[candles.length-1],closedB=candles[candles.length-2],closedA=candles[candles.length-3];
    if(current.end<w*.52)return {ok:false,reason:'Ultimele lumânări nu sunt suficient de vizibile',count:candles.length};
    // If the chart has very wide gaps, the last bodies may belong to labels/UI.
    if(current.start-closedB.end>w*.12||closedB.start-closedA.end>w*.12)
      return {ok:false,reason:'Lumânările recente nu sunt contigue',count:candles.length};
    if(closedA.color!==closedB.color)
      return {ok:false,reason:'Ultimele două lumânări închise au culori opuse',count:candles.length};
    if(closedA.color!==wantedDirection)
      return {ok:false,reason:'Ultimele lumânări închise contrazic semnalul',count:candles.length};
    return {ok:true,reason:'',count:candles.length,closedDirection:closedB.color,bars:candles};
  }


  // Optical only: this is NOT exchange OHLC and it cannot predict trade outcomes.
  // Require a visible rejected extreme and a second CLOSED bar in the same direction.
  function wickRejectionEvidence(curve,wantedDirection,colors){
    if(!colors||!colors.ok||!Array.isArray(colors.bars))
      return {ok:false,reason:colors&&colors.reason||'Lumânări neconfirmate'};
    const bars=colors.bars,n=bars.length;
    if(n<6)return {ok:false,reason:'Prea puține lumânări pentru suport/rezistență'};
    const w=curve.w,h=curve.h,px=ctx.getImageData(0,0,w,h).data;
    const y0=Math.floor(h*.12),y1=Math.floor(h*.83);
    const isColor=(i)=>{
      const r=px[i],g=px[i+1],b=px[i+2];
      return wantedDirection==='BUY'
        ?g>80&&g>r*1.12&&g>b*.88&&g-Math.min(r,b)>33
        :r>105&&r>g*1.10&&r>b*1.04&&r-Math.min(g,b)>36;
    };
    function geometry(bar){
      const left=Math.max(0,bar.start),right=Math.min(w-1,bar.end);
      const width=right-left+1;
      if(width<3)return null;
      let top=y1,bottom=y0,bodyTop=y1,bodyBottom=y0,bodyRows=0;
      const required=Math.max(2,Math.ceil(width*.65));
      for(let y=y0;y<y1;y++){
        let row=0;
        for(let x=left;x<=right;x++)if(isColor((y*w+x)*4))row++;
        if(row>0){top=Math.min(top,y);bottom=Math.max(bottom,y);}
        if(row>=required){bodyTop=Math.min(bodyTop,y);bodyBottom=Math.max(bodyBottom,y);bodyRows++;}
      }
      if(bodyRows<5||bottom<=top||bodyBottom<bodyTop)return null;
      return {top,bottom,bodyTop,bodyBottom,body:bodyBottom-bodyTop+1};
    }
    const rejected=geometry(bars[n-3]),confirmed=geometry(bars[n-2]);
    if(!rejected||!confirmed)
      return {ok:false,reason:'Fitilul și corpul lumânării sunt neclare'};
    const history=bars.slice(Math.max(0,n-8),n-3).map(geometry).filter(Boolean);
    if(history.length<2)return {ok:false,reason:'Suport/rezistență neverificabile'};
    const wick=wantedDirection==='BUY'
      ?rejected.bottom-rejected.bodyBottom:rejected.bodyTop-rejected.top;
    const opposite=wantedDirection==='BUY'
      ?rejected.bodyTop-rejected.top:rejected.bottom-rejected.bodyBottom;
    const ratio=wick/Math.max(1,rejected.body);
    if(ratio<1.6||opposite>rejected.body*.8)
      return {ok:false,reason:'Fără fitil dominant de respingere'};
    const tolerance=Math.max(4,Math.round(h*.025));
    const nearLevel=wantedDirection==='BUY'
      ?rejected.bottom>=Math.max(...history.map(c=>c.bottom))-tolerance
      :rejected.top<=Math.min(...history.map(c=>c.top))+tolerance;
    if(!nearLevel)return {ok:false,reason:'Nu există respingere lângă nivelul recent'};
    const resumption=wantedDirection==='BUY'
      ?confirmed.bodyTop<=rejected.bodyTop-2
      :confirmed.bodyBottom>=rejected.bodyBottom+2;
    if(!resumption)return {ok:false,reason:'A doua lumânare nu confirmă revenirea'};
    return {ok:true,dir:wantedDirection,ratio,pattern:wantedDirection==='BUY'
      ?'Respinge suport • fitil inferior':'Respinge rezistență • fitil superior'};
  }

  function classify(curve){
    const {pts,w,h,quality}=curve;
    if(pts.length<10||quality<.25)return {clear:false,dir:'NONE',atlas:'—',idx:0,score:0,reason:'Imagine insuficient de clară'};
    if((curve.spanCoverage||0)<.26)return {clear:false,dir:'NONE',atlas:'—',idx:0,score:0,reason:'Graficul ocupă o zonă prea mică. Încarcă fotografia originală, nu o captură a aplicației'};

    const full=linReg(pts);
    const recent=linReg(pts.slice(-Math.max(9,Math.floor(pts.length*.42))));
    const micro=linReg(pts.slice(-Math.max(6,Math.floor(pts.length*.22))));
    const norm=-full.slope*w/h,recentNorm=-recent.slope*w/h,microNorm=-micro.slope*w/h;
    const end=pts[pts.length-1],backRef=pts[Math.max(0,pts.length-4)],lastMove=(backRef.y-end.y)/h;
    const pv=pivots(pts,h),highs=pv.filter(p=>p.type==='H'),lows=pv.filter(p=>p.type==='L');

    const firstThird=pts.slice(0,Math.max(4,Math.floor(pts.length/3)));
    const lastThird=pts.slice(-Math.max(4,Math.floor(pts.length/3)));
    const span1=firstThird.reduce((s,p)=>s+p.span,0)/firstThird.length;
    const span2=lastThird.reduce((s,p)=>s+p.span,0)/lastThird.length;
    const moves=pts.slice(1).map((p,i)=>Math.abs(p.y-pts[i].y)/h);
    const volatility=Math.max(0,Math.min(1,median(moves)/.035));
    const narrowing=span2<span1*.78,expanding=span2>span1*1.22;
    const pred=full.slope*end.x+full.intercept,deviation=(end.y-pred)/h;
    const structuralHighs=highs.filter(p=>p.x<end.x-w*.08);
    const structuralLows=lows.filter(p=>p.x<end.x-w*.08);
    const refHigh=structuralHighs[structuralHighs.length-1]||null;
    const refLow=structuralLows[structuralLows.length-1]||null;
    const candleHigh=curve.anchor?curve.anchor.lo:end.y;
    const candleLow=curve.anchor?curve.anchor.hi:end.y;
    // Breakout valid only after price clears the structural level by a real margin
    // and both recent layers point in the same direction.
    const breakoutUp=refHigh
      ? candleHigh<refHigh.y-h*.012&&recentNorm>.035&&microNorm>.02
      : deviation<-.045&&recentNorm>.06&&microNorm>.04;
    const breakoutDown=refLow
      ? candleLow>refLow.y+h*.012&&recentNorm<-.035&&microNorm<-.02
      : deviation>.045&&recentNorm<-.06&&microNorm<-.04;
    const trendStrength=Math.min(1,Math.abs(norm)/.28);
    const recentStrength=Math.min(1,Math.abs(recentNorm)/.35);
    const microStrength=Math.min(1,Math.abs(microNorm)/.35);

    let buyVotes=0,sellVotes=0;
    const vote=(value,threshold,weight)=>{
      if(value>threshold)buyVotes+=weight;
      else if(value<-threshold)sellVotes+=weight;
    };
    vote(norm,.055,1.0);
    vote(recentNorm,.045,1.55);
    vote(microNorm,.035,1.85);
    vote(lastMove,.022,1.45);

    if(pv.length>=2){
      const lastPivot=pv[pv.length-1];
      if(lastPivot.type==='L'){
        const bounce=(lastPivot.y-end.y)/h;
        if(bounce>.025)buyVotes+=1.15;
      }else{
        const drop=(end.y-lastPivot.y)/h;
        if(drop>.025)sellVotes+=1.15;
      }
    }

    const voteTotal=Math.max(.001,buyVotes+sellVotes);
    const voteDiff=buyVotes-sellVotes;
    const consensus=Math.abs(voteDiff)/voteTotal;
    let dir='NONE',atlas='Confluență Multi-Structuri',idx=50;
    let score=.46+quality*.12+consensus*.16;

    if(voteTotal<2.6||consensus<.24||(Math.abs(recentNorm)<.03&&Math.abs(microNorm)<.03)){
      atlas=narrowing?'Compresie (Squeeze)':'Canal Orizontal';
      idx=narrowing?20:19;
      return {clear:false,dir:'NONE',atlas,idx,score:Math.min(.68,score),reason:'Direcția nu este suficient de clară'};
    }
    dir=voteDiff>0?'BUY':'SELL';

    if(pv.length>=5){
      const q=pv.slice(-5),types=q.map(p=>p.type).join('');
      if(types==='HLHLH'){
        const [s1,n1,head,n2,s2]=q;
        const shouldersClose=Math.abs(s1.y-s2.y)<h*.045,necklineClose=Math.abs(n1.y-n2.y)<h*.065,headHigher=head.y<Math.min(s1.y,s2.y)-h*.03;
        if(shouldersClose&&necklineClose&&headHigher&&dir==='SELL'){atlas='Head & Shoulders';idx=51;score=Math.max(score,.75+quality*.07+consensus*.07);}
      }else if(types==='LHLHL'){
        const [s1,n1,head,n2,s2]=q;
        const shouldersClose=Math.abs(s1.y-s2.y)<h*.045,necklineClose=Math.abs(n1.y-n2.y)<h*.065,headLower=head.y>Math.max(s1.y,s2.y)+h*.03;
        if(shouldersClose&&necklineClose&&headLower&&dir==='BUY'){atlas='Head & Shoulders inversat';idx=52;score=Math.max(score,.75+quality*.07+consensus*.07);}
      }
    }

    if(highs.length>=2){
      const a=highs[highs.length-2],b=highs[highs.length-1];
      if(Math.abs(a.y-b.y)<h*.035&&dir==='SELL'){atlas='Dublu Maxim';idx=2;score=Math.max(score,.70+quality*.09+recentStrength*.07+consensus*.06);}
    }
    if(lows.length>=2){
      const a=lows[lows.length-2],b=lows[lows.length-1];
      if(Math.abs(a.y-b.y)<h*.035&&dir==='BUY'){atlas='Dublu Minim';idx=1;score=Math.max(score,.70+quality*.09+recentStrength*.07+consensus*.06);}
    }
    if(highs.length>=3){
      const q=highs.slice(-3);
      if(Math.max(...q.map(p=>p.y))-Math.min(...q.map(p=>p.y))<h*.045&&dir==='SELL'){atlas='Triplu Maxim';idx=4;score=Math.max(score,.74+quality*.07+consensus*.06);}
    }
    if(lows.length>=3){
      const q=lows.slice(-3);
      if(Math.max(...q.map(p=>p.y))-Math.min(...q.map(p=>p.y))<h*.045&&dir==='BUY'){atlas='Triplu Minim';idx=3;score=Math.max(score,.74+quality*.07+consensus*.06);}
    }

    if(idx===50){
      if(narrowing&&(breakoutUp||breakoutDown)){atlas='Wedge + Breakout';idx=44;score=Math.max(score,.72+quality*.07+microStrength*.07+consensus*.06);}
      else if(narrowing){atlas=dir==='BUY'?'Wedge Ascendent':'Wedge Descendent';idx=dir==='BUY'?15:16;score=Math.max(score,.65+quality*.08+trendStrength*.07+consensus*.06);}
      else if(expanding){atlas='Triunghi Expanding';idx=14;score=Math.max(score,.61+quality*.09+microStrength*.07);}
      else if(breakoutUp&&dir==='BUY'){atlas='Breakout Rezistență';idx=21;score=Math.max(score,.74+quality*.07+microStrength*.08+consensus*.05);}
      else if(breakoutDown&&dir==='SELL'){atlas='Breakout Suport';idx=22;score=Math.max(score,.74+quality*.07+microStrength*.08+consensus*.05);}
      else if(Math.abs(norm)>.055){atlas=dir==='BUY'?'Canal Ascendent':'Canal Descendent';idx=dir==='BUY'?17:18;score=Math.max(score,.64+quality*.09+trendStrength*.09+consensus*.06);}
      else{atlas=dir==='BUY'?'1-2-3 Bottom':'1-2-3 Top';idx=dir==='BUY'?9:10;score=Math.max(score,.59+quality*.08+recentStrength*.08+consensus*.07);}
    }

    let disagreement=0;
    if(Math.sign(recentNorm)!==Math.sign(norm)&&Math.abs(norm)>.035)disagreement+=.07;
    if(Math.sign(microNorm)!==Math.sign(recentNorm)&&Math.abs(recentNorm)>.03)disagreement+=.08;
    if(Math.sign(lastMove)!==Math.sign(microNorm)&&Math.abs(lastMove)>.02)disagreement+=.06;
    score-=disagreement;
    score=Math.max(.44,Math.min(.93,score));

    const nearResistance=refHigh&&candleHigh>=refHigh.y-h*.012&&candleHigh<=refHigh.y+h*.06;
    const nearSupport=refLow&&candleLow<=refLow.y+h*.012&&candleLow>=refLow.y-h*.06;
    if(dir==='BUY'&&nearResistance&&!breakoutUp){
      return {clear:false,dir:'NONE',atlas:'Așteaptă confirmarea',idx:0,score:Math.min(score,.69),reason:'Prețul este sub rezistență. BUY necesită o închidere clară deasupra liniei galbene'};
    }
    if(dir==='SELL'&&nearSupport&&!breakoutDown){
      return {clear:false,dir:'NONE',atlas:'Așteaptă confirmarea',idx:0,score:Math.min(score,.69),reason:'Prețul este deasupra suportului. SELL necesită o închidere clară sub linia galbenă'};
    }

    // REVERSAL / EXHAUSTION GUARD v0.2.7
    // Evită intrarea în continuarea unui impuls deja întins și evită reversările
    // premature după o cădere/urcare violentă. Motorul preferă WAIT până la
    // recuperare/retragere structurală reală.
    const guardPts=pts.slice(-Math.max(10,Math.floor(pts.length*.30)));
    let recentHighIdx=0,recentLowIdx=0;
    for(let i=1;i<guardPts.length;i++){
      if(guardPts[i].y<guardPts[recentHighIdx].y)recentHighIdx=i;
      if(guardPts[i].y>guardPts[recentLowIdx].y)recentLowIdx=i;
    }
    const recentHighY=guardPts[recentHighIdx].y;
    const recentLowY=guardPts[recentLowIdx].y;
    const recentRange=Math.max(.0001,(recentLowY-recentHighY)/h);
    const endFromTop=(end.y-recentHighY)/Math.max(1,recentLowY-recentHighY);
    const endFromBottom=(recentLowY-end.y)/Math.max(1,recentLowY-recentHighY);

    const sharpRise=recentLowIdx<recentHighIdx&&recentRange>.050;
    const sharpFall=recentHighIdx<recentLowIdx&&recentRange>.050;
    const nearRecentTop=endFromTop<.20;
    const nearRecentBottom=endFromBottom<.20;
    const buyRecovery=sharpFall?Math.max(0,Math.min(1,(recentLowY-end.y)/Math.max(1,recentLowY-recentHighY))):1;
    const sellRetrace=sharpRise?Math.max(0,Math.min(1,(end.y-recentHighY)/Math.max(1,recentLowY-recentHighY))):1;

    if(dir==='BUY'&&sharpFall&&buyRecovery<.45){
      return {
        clear:false,dir:'NONE',atlas:'Așteaptă confirmarea',idx:0,
        score:Math.min(score,.69),
        trendStrength,recentStrength,microStrength,consensus,volatility,
        reason:'Cădere recentă puternică. BUY este blocat până la recuperare structurală'
      };
    }
    if(dir==='SELL'&&sharpRise&&sellRetrace<.45){
      return {
        clear:false,dir:'NONE',atlas:'Așteaptă confirmarea',idx:0,
        score:Math.min(score,.69),
        trendStrength,recentStrength,microStrength,consensus,volatility,
        reason:'Urcare recentă puternică. SELL este blocat până la retragere structurală'
      };
    }
    if(dir==='BUY'&&recentRange>.055&&nearRecentTop&&!breakoutUp){
      return {
        clear:false,dir:'NONE',atlas:'Așteaptă confirmarea',idx:0,
        score:Math.min(score,.69),
        trendStrength,recentStrength,microStrength,consensus,volatility,
        reason:'Preț întins aproape de maximul recent. BUY necesită breakout și confirmare'
      };
    }
    if(dir==='SELL'&&recentRange>.055&&nearRecentBottom&&!breakoutDown){
      return {
        clear:false,dir:'NONE',atlas:'Așteaptă confirmarea',idx:0,
        score:Math.min(score,.69),
        trendStrength,recentStrength,microStrength,consensus,volatility,
        reason:'Preț întins aproape de minimul recent. SELL necesită breakout și confirmare'
      };
    }

    // FRESH BREAKOUT GUARD v0.2.8
    // Un breakout vechi nu mai este suficient pentru intrare. Dacă prețul a pornit deja
    // corecția după maxim/minim, motorul blochează semnalul până la recucerirea impulsului.
    const tail=pts.slice(-Math.min(7,pts.length));
    let trailingAgainst=0;
    let adverseDistance=0;
    for(let i=tail.length-1;i>0;i--){
      const dy=(tail[i].y-tail[i-1].y)/h;
      const adverse=dir==='BUY'?dy>.0025:dy<-.0025;
      if(!adverse)break;
      trailingAgainst++;
      adverseDistance+=Math.abs(dy);
    }

    const breakoutPattern=idx===21||idx===22||idx===44||String(atlas||'').includes('Breakout');
    const staleBuyBreakout=dir==='BUY'&&breakoutPattern&&sharpRise&&endFromTop>.28;
    const staleSellBreakout=dir==='SELL'&&breakoutPattern&&sharpFall&&endFromBottom>.28;
    const activePullback=trailingAgainst>=2&&adverseDistance>.010;

    if(dir==='BUY'&&(staleBuyBreakout||activePullback)){
      return {
        clear:false,dir:'NONE',atlas:'Așteaptă confirmarea',idx:0,
        score:Math.min(score,.69),
        trendStrength,recentStrength,microStrength,consensus,volatility,
        reason:staleBuyBreakout
          ? 'Breakout BUY vechi: prețul a retras prea mult de la maxim. Așteaptă recucerirea impulsului'
          : 'Corecție activă după impuls. BUY este blocat până când prețul reia urcarea'
      };
    }
    if(dir==='SELL'&&(staleSellBreakout||activePullback)){
      return {
        clear:false,dir:'NONE',atlas:'Așteaptă confirmarea',idx:0,
        score:Math.min(score,.69),
        trendStrength,recentStrength,microStrength,consensus,volatility,
        reason:staleSellBreakout
          ? 'Breakout SELL vechi: prețul a revenit prea mult de la minim. Așteaptă reluarea impulsului'
          : 'Revenire activă după impuls. SELL este blocat până când prețul reia scăderea'
      };
    }

    // QUALITY GATE v0.2.6 — motor mai selectiv, fără modificări de interfață.
    // Semnalul este valid numai când direcția, structura și impulsul sunt aliniate.
    const directionSign=dir==='BUY'?1:-1;
    const recentAligned=directionSign*recentNorm>.045;
    const microAligned=directionSign*microNorm>.035;
    const lastMoveAligned=directionSign*lastMove>.018;
    const trendAligned=directionSign*norm>.025;
    const breakoutAligned=dir==='BUY'?breakoutUp:breakoutDown;
    const structuralPattern=[1,2,3,4,21,22,44,51,52].includes(idx);
    const alignmentCount=[recentAligned,microAligned,lastMoveAligned,trendAligned].filter(Boolean).length;
    const hardConflict=(directionSign*recentNorm<-.025)||(directionSign*microNorm<-.020);
    const chaotic=volatility>.88&&consensus<.55;
    const qualityGate=quality>=.42;
    const confluenceGate=alignmentCount>=3&&(trendAligned||breakoutAligned||structuralPattern);
    const scoreThreshold=breakoutAligned?.72:(structuralPattern?.74:.77);

    // Scorul afișat rămâne un scor intern al modelului, nu o probabilitate statistică garantată.
    // Îl plafonăm conservator până când există calibrare pe un eșantion mare de tranzacții reale/demo.
    score=Math.min(score,.88);

    const clear=
      score>=scoreThreshold&&
      consensus>=.40&&
      qualityGate&&
      confluenceGate&&
      !hardConflict&&
      !chaotic;

    let gateReason='';
    if(!clear){
      if(!qualityGate)gateReason='Imaginea graficului nu are suficientă calitate pentru un semnal serios';
      else if(hardConflict)gateReason='Impulsul recent contrazice direcția. Așteaptă confirmarea';
      else if(chaotic)gateReason='Volatilitate haotică. Motorul blochează intrarea';
      else if(consensus<.40)gateReason='Confluența BUY/SELL este insuficientă';
      else if(!confluenceGate)gateReason='Structura și momentum-ul nu sunt încă aliniate';
      else if(score<scoreThreshold)gateReason='Scorul modelului este sub pragul selectiv';
      else gateReason='Semnal insuficient confirmat';
    }

    return {
      clear,
      dir:clear?dir:'NONE',
      atlas,
      idx,
      score,
      trendStrength,
      recentStrength,
      microStrength,
      consensus,
      volatility,
      reason:clear?'':gateReason
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

  function run(dataUrl,timeframe,frameId){
    const img=new Image();
    img.onload=function(){
      try{
        const curve=buildPriceCurve(img);
        if(!curve){send({type:'ERROR',frameId,message:'Imaginea nu a putut fi citită.'});return;}
        const base=classify(curve),anchor=curve.anchor;
        // Optical regime is computed from the current screenshot only:
        // NOT broker price OHLC, never a verified per-asset volatility metric.
        const vol=Math.max(0,Math.min(1,Number(base.volatility)||0));
        const trend=Math.max(0,Math.min(1,Number(base.trendStrength)||0));
        const recent=Math.max(0,Math.min(1,Number(base.recentStrength)||0));
        const marketRegime=curve.quality<.42?'NECITIBIL':
          vol>.80?'AGITAT':
          trend>.52&&recent>.46?'TENDINTA':
          trend<.30&&recent<.30?'LATERAL':'MIXT';
        // Live v3.2.3: breakout setups no longer emit audio alerts.
        const buyColors=candleEvidence(curve,'BUY'),sellColors=candleEvidence(curve,'SELL');
        const buyWick=wickRejectionEvidence(curve,'BUY',buyColors);
        const sellWick=wickRejectionEvidence(curve,'SELL',sellColors);
        const wick=buyWick.ok?buyWick:sellWick.ok?sellWick:null;
        const recentPts=curve.pts.slice(-Math.max(10,Math.floor(curve.pts.length*.5)));
        const normalizedSlope=-linReg(recentPts).slope*curve.w/curve.h;
        const trendAligned=!!wick&&(wick.dir==='BUY'?normalizedSlope>.015:normalizedSlope<-.015);
        const supportedTf=['M5','M10','M15'].includes(String(timeframe));
        const wickOk=!!wick&&trendAligned&&supportedTf&&curve.quality>=.55&&
          marketRegime==='TENDINTA';
        const r={...base,clear:wickOk,dir:wickOk?wick.dir:'NONE',
          atlas:wickOk?wick.pattern:'Așteaptă respingere cu fitil',
          score:wickOk?Math.min(.85,.72+Math.min(.09,wick.ratio*.035)+curve.quality*.045)
            :Math.min(.69,Number(base.score)||0),
          reason:wickOk?'':!supportedTf?'Interval nevalidat: folosește M5/M10/M15'
            :marketRegime!=='TENDINTA'?'Piață neclară/laterală: fără bip'
            :!trendAligned&&wick?'Respingere contra direcției: fără bip'
            :(buyWick.reason||sellWick.reason||'Fără respingere confirmată')};
        const evidence=r.clear?candleEvidence(curve,r.dir):{ok:false,reason:r.reason};
        const clear=r.clear&&evidence.ok;
        const duration=clear?directionDurationFor(timeframe,r,curve):null;
        send({
          type:'RESULT',
          result:{
            frameId,
            signal:clear?r.dir:'NONE',
            // Diagnostic candidate blocked by the final optical gate, never alert directly.
            candidateDirection:r.clear?r.dir:'NONE',
            marketRegime,
            timeframe:String(timeframe||'M10'),
            pattern:r.atlas,
            probability:Math.round(r.score*100),
            expiry:clear?5:null,
            directionMin:duration?duration.min:null,
            directionMax:duration?duration.max:null,
            trendStrength:duration?Math.round(duration.trendStrength*100):null,
            volatility:duration?Math.round(duration.volatility*100):null,
            reason:!r.clear?(r.reason||''):(evidence.reason||''),
            atlasCount:ATLAS.length,
            anchorX:anchor?anchor.x/curve.w:null,
            anchorY:anchor?((anchor.lo+anchor.hi)/2)/curve.h:null,
            quality:Math.round(curve.quality*100),
            opticalCandleCount:evidence.count||0,
            opticalCandleGate:!!evidence.ok&&clear,
            wickRejectionGate:!!clear&&!!wick,
            // This is an optical cross-check, NOT exchange OHLC data.,
            trendLines:trendLinesFor(curve,r),
            engineVersion:ENGINE_VERSION
          }
        });
      }catch(e){
        send({type:'ERROR',frameId,message:e&&e.message?e.message:String(e)});
      }
    };
    img.onerror=function(){send({type:'ERROR',frameId,message:'Fotografia nu a putut fi încărcată în motorul de analiză.'});};
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
  window.ScalpAtlasAnalyze=function(dataUrl,timeframe,frameId){run(dataUrl,timeframe||'M10',frameId);};
  window.ScalpAtlasPing=function(){send({type:'READY',atlasCount:ATLAS.length,engineVersion:ENGINE_VERSION});};
  document.addEventListener('message',onMessage);
  window.addEventListener('message',onMessage);
  window.ScalpAtlasPing();
})();
</script></body></html>`;
