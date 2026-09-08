import { SCALP_ATLAS_MODELS } from './atlas';

const atlasJson = JSON.stringify(SCALP_ATLAS_MODELS);

export const ANALYSIS_ENGINE_HTML = `<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>html,body{margin:0;background:#000}canvas{display:none}</style></head>
<body><canvas id="analysisCanvas"></canvas><script>
(function(){
  const ENGINE_VERSION='0.2.3';
  const ATLAS=${atlasJson};
  const canvas=document.getElementById('analysisCanvas');
  const ctx=canvas.getContext('2d',{willReadFrequently:true});
  const TF_MIN={M1:1,M2:2,M3:3,M5:5,M10:10,M15:15,M30:30,H1:60};

  function send(payload){try{window.ReactNativeWebView.postMessage(JSON.stringify(payload));}catch(e){}}

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
    const x0=Math.floor(w*.02),x1=Math.floor(w*.89),y0=Math.floor(h*.05),y1=Math.floor(h*.79);
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
    return {pts:sm,w,h,quality,anchor};
  }

  function classify(curve){
    const {pts,w,h,quality}=curve;
    if(pts.length<10||quality<.25)return {clear:false,dir:'NONE',atlas:'—',idx:0,score:0,reason:'Imagine insuficient de clară'};

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
    const narrowing=span2<span1*.78,expanding=span2>span1*1.22;
    const pred=full.slope*end.x+full.intercept,deviation=(end.y-pred)/h;
    const breakoutUp=deviation<-.045||recentNorm>norm+.12||microNorm>.09;
    const breakoutDown=deviation>.045||recentNorm<norm-.12||microNorm<-.09;
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

    const clear=score>=.63&&consensus>=.28;
    return {
      clear,
      dir:clear?dir:'NONE',
      atlas,
      idx,
      score,
      reason:clear?'':'Potrivirea cu atlasul este prea slabă sau semnalele se contrazic'
    };
  }

  function expiryFor(tf,score){
    const base=TF_MIN[tf]||15;
    let mult=score>=.82?1:score>=.72?1.25:1.5;
    let mins=Math.max(1,Math.round(base*mult));
    if(tf==='H1')mins=Math.round(mins/5)*5;
    return mins;
  }

  function run(dataUrl,timeframe){
    const img=new Image();
    img.onload=function(){
      try{
        const curve=buildPriceCurve(img);
        if(!curve){send({type:'ERROR',message:'Imaginea nu a putut fi citită.'});return;}
        const r=classify(curve),anchor=curve.anchor;
        send({
          type:'RESULT',
          result:{
            signal:r.clear?r.dir:'NONE',
            pattern:r.atlas,
            probability:Math.round(r.score*100),
            expiry:r.clear?expiryFor(timeframe,r.score):null,
            reason:r.reason||'',
            atlasCount:ATLAS.length,
            anchorX:anchor?anchor.x/curve.w:null,
            anchorY:anchor?((anchor.lo+anchor.hi)/2)/curve.h:null,
            quality:Math.round(curve.quality*100),
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

  document.addEventListener('message',onMessage);
  window.addEventListener('message',onMessage);
  send({type:'READY',atlasCount:ATLAS.length,engineVersion:ENGINE_VERSION});
})();
<\\/script></body></html>`;
