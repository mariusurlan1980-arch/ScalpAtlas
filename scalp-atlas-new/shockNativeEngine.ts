/**
 * Android MediaProjection → JPEG frame → same-candle optical SHOCK analyzer.
 * No broker credentials, network intercept, or order execution.
 * Unsupported charts fail closed; SHOCK percentage measures candle retracement only.
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
      shockBlocker:'AȘTEAPTĂ DATE',
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
    if(bodyRows.length<5)return null;
    var top=bodyRows[0],bottom=bodyRows[bodyRows.length-1];
    if(bottom-top>h*.35)return null; // large colored panels are not candles
    var close=candle.dir==='BUY'?top:bottom;
    // Observe the narrow center wick outside the filled candle body.
    // Do not fabricate a wick from unobserved highs or lows.
    var centerX=Math.round((candle.start+candle.end)/2);
    var wickMin=top,wickMax=bottom;
    for(var wy=minY;wy<maxY;wy++){
      var supported=false;
      for(var wx=Math.max(candle.start,centerX-1);wx<=Math.min(candle.end,centerX+1);wx++){
        if(isColor(p,(wy*w+wx)*4)===candle.dir){supported=true;break;}
      }
      if(supported){wickMin=Math.min(wickMin,wy);wickMax=Math.max(wickMax,wy);}
    }
    var upperWickPixels=Math.max(0,top-wickMin),lowerWickPixels=Math.max(0,wickMax-bottom);
    var wickPixels=candle.dir==='BUY'?lowerWickPixels:upperWickPixels;
    var wickPercent=Math.min(100,Math.round(100*wickPixels/Math.max(1,bottom-top)));
    // Optical color-fill percentage, NEVER a trade win probability.
    var opticalQuality=Math.max(1,Math.min(99,
      Math.round(100*fillPixels/(width*bodyRows.length))));
    // A trend must be measured independently of the LIVE candle's color.
    // Previous three FILLED candle bodies are read in chronological order.
    // If any is missing or the slope is unclear, no trade trend is assumed.
    var previous=viable.slice(-7,-1),trend='NONE',pastCloses=[];
    var trendStrengthPercent=null,trendVisualPoints=[],trendMeasured=false;
    if(previous.length===3){
      previous.forEach(function(g){
        var left=Math.round((g.start+g.end)/2),t=h,b=-1;
        for(var y2=minY;y2<maxY;y2++){
          var yes=0;
          for(var x2=g.start;x2<=g.end;x2++){
            if(isColor(p,(y2*w+x2)*4)===g.dir)yes++;
          }
          if(yes>=Math.max(2,Math.floor((g.end-g.start+1)*.5))){t=Math.min(t,y2);b=Math.max(b,y2);}
        }
        if(b>t+4)pastCloses.push({closeY:g.dir==='BUY'?t:b,dir:g.dir,bodyHeight:b-t});
      });
      if(pastCloses.length===3){
        trendMeasured=true;
        var move=pastCloses[2].closeY-pastCloses[0].closeY;
        var greenCount=pastCloses.filter(function(z){return z.dir==='BUY';}).length;
        if(move<=-Math.max(7,h*.018)&&greenCount>=2)trend='BUY';
        if(move>=Math.max(7,h*.018)&&greenCount<=1)trend='SELL';
        var lo=Math.min.apply(null,pastCloses.map(function(z){return z.closeY;}));
        var hi=Math.max.apply(null,pastCloses.map(function(z){return z.closeY;}));
        var meanBody=pastCloses.reduce(function(acc,z){return acc+z.bodyHeight;},0)/3;
        // Bounded screen-relative displacement strength, NOT angle/price
        // percentage, signal probability or a measured financial return.
        var denom=Math.max(1,hi-lo+meanBody);
        trendStrengthPercent=Math.min(100,Math.round(100*Math.abs(move)/denom));
        // Preserve visual fluctuations while avoiding fabricated data.
        var visualScale=Math.max(45,hi-lo+meanBody*2);
        var mid=(hi+lo)/2;
        trendVisualPoints=pastCloses.map(function(z){
          return Math.max(0,Math.min(100,Math.round(50+(z.closeY-mid)*100/visualScale)));
        });
      }
    }
    return {x:(candle.start+candle.end)/2,closeY:close,dir:candle.dir,
      width:width,bodyHeight:bottom-top,wickPixels:wickPixels,wickPercent:wickPercent,
      topWickPixels:upperWickPixels,bottomWickPixels:lowerWickPixels,
      trendDirection:trend,trendMeasured:trendMeasured,
      trendStrengthPercent:trendStrengthPercent,trendVisualPoints:trendVisualPoints,
      opticalQuality:opticalQuality};
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
        if(!candle){
          // Blank or unreadable plot: clear ALL history. Never recover an
          // old BUY/SELL after a full loss of optical evidence.
          reset();
          return report(frameId,tf,pair,epoch,'Grafic necitibil sau lumânări absente',0);
        }
        if(lastX>=0 && candle.x<lastX-tolerance){
          // A previously visible older candle took the rightmost position.
          // Ignore it briefly without treating it as a new live observation.
          if(!lastValidCandleAt||now-lastValidCandleAt>2500)reset();
          return report(frameId,tf,pair,epoch,'Lumânare activă temporar prea subțire',0);
        }
        if(lastX>=0&&Math.abs(candle.x-lastX)>tolerance){
          reset(); // rightward candle change or chart scroll
        }
        lastX=candle.x;
        lastValidCandleAt=now;
        var opticalInfo={candleDetected:true,observedCandleDirection:candle.dir,
          observedCandleX:Math.round(candle.x),opticalQuality:candle.opticalQuality,
          observedBodyHeightPx:candle.bodyHeight,
          observedTopWickPx:candle.topWickPixels,
          observedBottomWickPx:candle.bottomWickPixels,
          observedTrendDirection:candle.trendDirection,
          trendStrengthPercent:candle.trendStrengthPercent,
          trendVisualPoints:candle.trendVisualPoints};
        history=history.filter(function(o){return now-o.t<=24000&&o.t<=now;});
        history.push({t:now,y:candle.closeY,dir:candle.dir,x:candle.x,bodyHeight:candle.bodyHeight,wickPixels:candle.wickPixels});
        if(history.length>100)history.shift();
        // A shock is a temporal sequence inside ONE continuously tracked
        // candle, not a single JPEG or a guess from candle color alone.
        // The ONLY percentage exposed to the overlay is physical candle
        // retracement: opposed movement / body BEFORE the shock, in pixels.
        // It is NOT visual OCR quality, model confidence or a WIN forecast.
        var latest=history[history.length-1];
        var minBody=Math.max(10,h*.035); // still require a measurable pre-shock candle
        var minMove=Math.max(7,h*.018);
        // DEMO threshold: 50% RETRACEMENT, not 50% trade win probability.
        // 10s max to descend/ascend against the LIVE candle, >=40% recovery.
        var minShockFraction=.50,maxDropMs=10000,minRecoveryFraction=.40;
        var displayedDepth=0,displayedDropDuration=0,confirmed=false,dir='NONE';
        var confirmedDepth=0,confirmedRebound=0,confirmedDuration=0;
        for(var i=0;i<history.length-1;i++){
          var start=history[i];
          if(start.dir!==candle.dir||start.bodyHeight<minBody)continue;
          for(var j=i+1;j<history.length;j++){
            var bottom=history[j],fallMs=bottom.t-start.t;
            if(fallMs>maxDropMs)break; // slow movement is not a rapid shock
            if(fallMs<300||bottom.dir!==candle.dir)continue;
            var drop=candle.dir==='BUY'?bottom.y-start.y:start.y-bottom.y;
            if(drop<minMove)continue;
            var fraction=drop/start.bodyHeight;
            var percent=Math.min(100,Math.max(0,Math.round(100*fraction)));
            if(percent>=displayedDepth){
              displayedDepth=percent;
              displayedDropDuration=fallMs;
            }
            if(fraction<minShockFraction||j>=history.length-2)continue;
            var reboundMs=latest.t-bottom.t;
            if(reboundMs<300||reboundMs>5000)continue;
            var recovery=candle.dir==='BUY'?bottom.y-latest.y:latest.y-bottom.y;
            if(recovery/drop<minRecoveryFraction)continue;
            // Visible LONG wick must remain on the SAME recovered candle.
            // At least 35% of the body before the rapid retreat.
            if(latest.wickPixels<start.bodyHeight*.35)continue;
            // BOTH the observed trend from closed candles AND current LIVE
            // candle color must agree. Never turn a candle color into a trend.
            if(candle.trendDirection!==candle.dir)continue;
            // Both ends must be the same live candle, detected in its
            // original direction after the recovery, not the opposite candle.
            confirmed=true;
            if(percent>=confirmedDepth){
              confirmedDepth=percent;
              confirmedRebound=Math.min(100,Math.round(100*recovery/drop));
              confirmedDuration=fallMs;
              dir=candle.dir;
            }
          }
        }
        // Show a short, grounded explanation for why a LIVE observed
        // percentage is NOT an entry. No direction is inferred from color.
        var shockBlocker=confirmed?'ȘOC CONFIRMAT':
          displayedDepth===0?'AȘTEAPTĂ ȘOC':
          displayedDepth<50?'SUB 50%':
          candle.trendDirection==='NONE'?'TREND NECLAR':
          candle.trendDirection!==candle.dir?'CONTRA TREND':
          candle.wickPixels<minBody*.35?'FITIL SCURT':
          'REVENIRE/TIMP';
        var quality=confirmed?75:0; // internal optical gate only
        report(frameId,tf,pair,epoch,
          confirmed?'ȘOC rapid si revenire masurata in aceeasi lumânare':'Aștept retragere rapida și revenire',
          quality,{
            signal:confirmed?dir:'NONE',shockDirection:confirmed?dir:'NONE',
            candidateDirection:confirmed?dir:'NONE',
            shockOpticalVerified:confirmed,shockSameCandle:confirmed,
            shockRetraced:confirmed,shockRecovered:confirmed,
            // All percentages below refer to the observed forming candle.
            shockRetracementPercent:confirmed?confirmedDepth:displayedDepth,
            shockRecoveryPercent:confirmed?confirmedRebound:0,
            // A time is shown only when two LIVE frames actually measured
            // opposing movement; no fabricated seconds for blank/no-data.
            shockDropDurationMs:confirmed?confirmedDuration:0,
            shockObservedDurationMs:confirmed?confirmedDuration:displayedDropDuration,
            trendDirection:candle.trendDirection,
            trendMeasured:candle.trendMeasured,
            trendStrengthPercent:candle.trendStrengthPercent,
            trendVisualPoints:candle.trendVisualPoints,
            observedBodyHeightPx:candle.bodyHeight,
            observedTopWickPx:candle.topWickPixels,
            observedBottomWickPx:candle.bottomWickPixels,
            shockBlocker:shockBlocker,
            shockWickPercent:candle.wickPercent,
            shockWickPixels:candle.wickPixels,
            shockMaxWindowMs:maxDropMs,
            shockThresholdPercent:Math.round(minShockFraction*100),
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
