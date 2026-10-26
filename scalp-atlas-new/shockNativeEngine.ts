/**
 * Android MediaProjection → JPEG frame → same-candle optical SHOCK analyzer.
 * No broker credentials, network intercept, or order execution.
 * Unsupported charts fail closed; confidence is image quality, not win odds.
 */
export const SHOCK_NATIVE_HTML = `<!doctype html><html><head><meta name="viewport" content="width=device-width"></head><body><canvas id="c" style="display:none"></canvas><script>
(function(){
  'use strict';
  var canvas=document.getElementById('c');
  var ctx=canvas.getContext('2d',{willReadFrequently:true});
  var history=[],lastKey='',lastX=-1,lastSize='',lastFrame=-1,lastObservedAt=0,lastValidCandleAt=0;
  function send(obj){try{AndroidBridge.postMessage(JSON.stringify(obj));}catch(e){}}
  function reset(){history=[];lastX=-1;lastValidCandleAt=0;}
  function report(frameId,tf,pair,epoch,reason,quality,extra){
    var result={frameId:frameId,timeframe:tf,brokerPair:pair,marketEpoch:epoch,
      source:'ANDROID_SCREEN_CAPTURE',shockDirection:'NONE',signal:'NONE',
      shockFrameId:frameId,shockOpticalVerified:false,shockSameCandle:false,
      shockRetraced:false,shockRecovered:false,quality:quality||0,
      candidateDirection:'NONE',reason:reason};
    if(extra)Object.keys(extra).forEach(function(key){result[key]=extra[key];});
    send({type:'RESULT',result:result});
  }
  function isColor(p,i){
    var r=p[i],g=p[i+1],b=p[i+2];
    if(g>=78&&g>r*1.38&&g>b*1.15&&g-r>34)return 'BUY';
    if(r>=95&&r>g*1.42&&r>b*1.25&&r-g>34)return 'SELL';
    return '';
  }
  // Find actual filled candle bodies. A wick or an isolated colored pixel
  // cannot be used as a close price, and bottom BUY/SELL buttons are excluded.
  function findCandle(p,w,h){
    // Cropped chart excludes broker buttons; latest M10 candle can be low.
    var minY=Math.floor(h*.055),maxY=Math.floor(h*.96);
    var minX=Math.floor(w*.40),maxX=Math.floor(w*.91);
    var columns=[];
    for(var x=minX;x<maxX;x++){
      var green=0,red=0,lo=h,hi=0;
      for(var y=minY;y<maxY;y++){
        var color=isColor(p,(y*w+x)*4);
        if(color){if(color==='BUY')green++;else red++;lo=Math.min(lo,y);hi=Math.max(hi,y);}
      }
      var dominant=green>red*2?'BUY':red>green*2?'SELL':'';
      var amount=Math.max(green,red);
      // At least a small body rather than single colored wick.
      columns.push(amount>=7&&dominant?{x:x,dir:dominant,n:amount,lo:lo,hi:hi}:null);
    }
    var groups=[],open=null;
    for(var ci=0;ci<=columns.length;ci++){
      var col=ci<columns.length?columns[ci]:null;
      if(!col||open&&col.dir!==open.dir){
        if(open)groups.push(open);
        open=null;
      }
      if(col){
        if(!open)open={start:col.x,end:col.x,dir:col.dir,pixels:0};
        open.end=col.x;open.pixels+=col.n;
      }
    }
    var minWidth=Math.max(3,Math.round(w*.005));
    var maxWidth=Math.max(18,Math.round(w*.065));
    var viable=groups.filter(function(g){
      var gw=g.end-g.start+1;
      return gw>=minWidth&&gw<=maxWidth&&g.pixels>=gw*9;
    });
    if(!viable.length)return null;
    var candle=viable[viable.length-1];
    var width=candle.end-candle.start+1;
    var rowSupport=Math.max(2,Math.floor(width*.5));
    var bodyRows=[],fillPixels=0;
    for(var yy=minY;yy<maxY;yy++){
      var count=0;
      for(var xx=candle.start;xx<=candle.end;xx++){
        if(isColor(p,(yy*w+xx)*4)===candle.dir)count++;
      }
      if(count>=rowSupport){bodyRows.push(yy);fillPixels+=count;}
    }
    if(bodyRows.length<7)return null;
    var top=bodyRows[0],bottom=bodyRows[bodyRows.length-1];
    if(bottom-top>h*.35)return null; // large colored panels are not candles
    var close=candle.dir==='BUY'?top:bottom;
    // Optical color-fill percentage, NEVER a trade win probability.
    var opticalQuality=Math.max(1,Math.min(99,
      Math.round(100*fillPixels/(width*bodyRows.length))));
    return {x:(candle.start+candle.end)/2,closeY:close,dir:candle.dir,
      width:width,bodyHeight:bottom-top,opticalQuality:opticalQuality};
  }
  window.ScalpAtlasAnalyze=function(url,tf,frameId,pair,epoch){
    pair=typeof pair==='string'?pair:'';
    epoch=Number.isFinite(epoch)?epoch:-1;
    if(!/^(M5|M10|M15)$/.test(tf)||!pair||epoch<0){
      reset();return report(frameId,tf,pair,epoch,'Pereche sau interval neconfirmat',0);
    }
    if(frameId<=lastFrame){reset();return report(frameId,tf,pair,epoch,'Cadru intarziat',0);}
    lastFrame=frameId;
    var image=new Image();
    image.onerror=function(){reset();send({type:'ERROR',frameId:frameId,message:'Captura JPEG indisponibila'});};
    image.onload=function(){
      try {
        canvas.width=image.width;canvas.height=image.height;
        ctx.drawImage(image,0,0);
        var w=canvas.width,h=canvas.height,now=Date.now(),p=ctx.getImageData(0,0,w,h).data;
        if(lastObservedAt>0&&now-lastObservedAt>3500)reset();
        lastObservedAt=now;
        var duration={M5:300000,M10:600000,M15:900000}[tf];
        // The bucket is a safety boundary, not proof of broker candle timing.
        var candleBucket=Math.floor(now/duration);
        var key=pair+'|'+epoch+'|'+tf+'|'+candleBucket;
        var size=w+'x'+h;
        if(key!==lastKey||size!==lastSize){reset();lastKey=key;lastSize=size;}
        var candle=findCandle(p,w,h);
        var tolerance=Math.max(7,w*.017);
        // On a fast recovery the live body can briefly become a thin doji.
        // The finder may then see an OLD candle to its left. Do not mistake
        // that old candle for a fresh one, and do not invent optical evidence.
        // Keep the already observed same-candle history for at most 2.5 s.
        // Never emit a signal while the active candle is not visible.
        if(!candle || (lastX>=0 && candle.x<lastX-tolerance)){
          if(!lastValidCandleAt||now-lastValidCandleAt>2500)reset();
          return report(frameId,tf,pair,epoch,'Lumânare activă prea subțire sau ascunsă',0);
        }
        if(lastX>=0&&Math.abs(candle.x-lastX)>tolerance){
          reset(); // rightward candle change or chart scroll
        }
        lastX=candle.x;
        lastValidCandleAt=now;
        var opticalInfo={candleDetected:true,observedCandleDirection:candle.dir,
          observedCandleX:Math.round(candle.x),opticalQuality:candle.opticalQuality};
        history=history.filter(function(o){return now-o.t<=90000&&o.t<=now;});
        history.push({t:now,y:candle.closeY,dir:candle.dir,x:candle.x});
        if(history.length>100)history.shift();
        // A shock is a temporal sequence inside ONE continuously tracked
        // candle, not a single JPEG or a guess from candle color alone.
        if(history.length<6||now-history[0].t<4500){
          return report(frameId,tf,pair,epoch,'Colectez mișcarea aceleiași lumânări',0,opticalInfo);
        }
        var first=history[0].y,last=history[history.length-1].y;
        var threshold=Math.max(7,h*.026);
        var max=first,min=first,maxIdx=0,minIdx=0;
        history.forEach(function(o,i){
          if(o.y>max){max=o.y;maxIdx=i;}
          if(o.y<min){min=o.y;minIdx=i;}
        });
        var enoughAfter=history.length-2;
        var buy=candle.dir==='BUY'&&maxIdx>=2&&maxIdx<enoughAfter&&
          max-first>=threshold&&max-last>=threshold*.8;
        var sell=candle.dir==='SELL'&&minIdx>=2&&minIdx<enoughAfter&&
          first-min>=threshold&&last-min>=threshold*.8;
        var confirmed=buy||sell,dir=buy?'BUY':sell?'SELL':'NONE';
        // Optical image-quality indicator, never a win probability.
        var evidence=confirmed?(buy?Math.min(max-first,max-last):Math.min(first-min,last-min)):0;
        var quality=confirmed?Math.min(88,Math.max(60,Math.round(60+(evidence/threshold-1)*8))):0;
        report(frameId,tf,pair,epoch,
          confirmed?'Retragere si recuperare in aceeasi lumânare LIVE':'Aștept revenirea in aceeasi lumânare',
          quality,{
            signal:dir,shockDirection:dir,candidateDirection:dir,
            shockOpticalVerified:confirmed,shockSameCandle:confirmed,
            shockRetraced:confirmed,shockRecovered:confirmed,
            shockCandleX:Math.round(candle.x),expiry:5,
            candleDetected:true,observedCandleDirection:candle.dir,
            observedCandleX:Math.round(candle.x),opticalQuality:candle.opticalQuality
          });
      } catch(e){
        reset();send({type:'ERROR',frameId:frameId,message:String(e)});
      }
    };
    image.src=url;
  };
  send({type:'READY'});
})();
</script></body></html>`;
