/**
 * Native MediaProjection analyzer for one forming candle.
 * Screen pixels are not price data: only alert when repeated frames provide
 * stable, unambiguous optical evidence. No broker orders are placed.
 */
export const SHOCK_NATIVE_HTML = `<!doctype html><html><head><meta name="viewport" content="width=device-width"></head><body><canvas id="c" style="display:none"></canvas><script>
(function(){
  var canvas=document.getElementById('c'),ctx=canvas.getContext('2d',{willReadFrequently:true});
  var history=[],lastPair='',lastTf='',lastX=-1;
  function send(obj){try{AndroidBridge.postMessage(JSON.stringify(obj));}catch(e){}}
  function wait(frameId,tf,reason,quality){send({type:'RESULT',result:{frameId:frameId,timeframe:tf,signal:'NONE',shockDirection:'NONE',quality:quality||0,shockOpticalVerified:false,reason:reason}});}
  window.ScalpAtlasAnalyze=function(url,tf,frameId){
    var image=new Image();
    image.onerror=function(){send({type:'ERROR',frameId:frameId,message:'Imagine indisponibila'});};
    image.onload=function(){
      try{
        canvas.width=image.width;canvas.height=image.height;ctx.drawImage(image,0,0);
        var w=canvas.width,h=canvas.height,p=ctx.getImageData(0,0,w,h).data;
        // Only examine the right-hand chart area. Reject ambiguous/no candle.
        var cols=[],step=Math.max(1,Math.floor(w/260));
        for(var x=Math.floor(w*.52);x<Math.floor(w*.96);x+=step){
          var green=[],red=[];
          for(var y=Math.floor(h*.12);y<Math.floor(h*.86);y+=2){
            var k=(y*w+x)*4,r=p[k],g=p[k+1],b=p[k+2];
            if(g>75&&g>r*1.38&&g>b*1.12)green.push(y);
            else if(r>90&&r>g*1.38&&r>b*1.2)red.push(y);
          }
          var ys=green.length>=4?green:red,dir=green.length>=4?'BUY':'SELL';
          if(ys.length>=4)cols.push({x:x,y:ys.reduce((a,b)=>a+b,0)/ys.length,dir:dir,n:ys.length});
        }
        if(cols.length<3){history=[];return wait(frameId,tf,'Fara lumânare colorata verificabila',0);}
        var groups=[];
        cols.forEach(function(c){var g=groups[groups.length-1];if(!g||c.x-g.end>step*2||g.dir!==c.dir)groups.push({start:c.x,end:c.x,dir:c.dir,pts:[c]});else{g.end=c.x;g.pts.push(c);}});
        var group=groups.filter(g=>g.end-g.start>=step*2).pop();
        if(!group){history=[];return wait(frameId,tf,'Lumânare activa neidentificata',0);}
        var xCenter=(group.start+group.end)/2;
        // A large jump in position means chart scroll / different candle: reset.
        if(tf!==lastTf||Math.abs(xCenter-lastX)>Math.max(12,w*.025))history=[];
        lastTf=tf;lastX=xCenter;
        var tip=group.pts.reduce((a,b)=>a+b.y,0)/group.pts.length;
        var now=Date.now(),duration=({M5:300000,M10:600000,M15:900000})[tf];
        if(!duration){history=[];return wait(frameId,tf,'Timeframe invalid',0);}
        var candleStart=Math.floor(now/duration)*duration;
        history=history.filter(v=>v.candleStart===candleStart&&now-v.t<90000&&v.dir===group.dir);
        history.push({t:now,y:tip,dir:group.dir,candleStart:candleStart});
        if(history.length>120)history.shift();
        if(history.length<4||now-history[0].t<2500)return wait(frameId,tf,'Colectez cadre ale aceleiasi lumânari',60);
        var ys=history.map(v=>v.y),first=ys[0],last=ys[ys.length-1],min=Math.min.apply(null,ys),max=Math.max.apply(null,ys);
        var range=max-min,threshold=Math.max(7,h*.025);
        var lowIndex=ys.indexOf(max),highIndex=ys.indexOf(min);
        // Green: downward price shock increases screen Y, then price recovers.
        // Red: upward price shock decreases screen Y, then price recovers.
        var buy=group.dir==='BUY'&&lowIndex>0&&lowIndex<ys.length-1&&max-first>=threshold&&max-last>=threshold*.65;
        var sell=group.dir==='SELL'&&highIndex>0&&highIndex<ys.length-1&&first-min>=threshold&&last-min>=threshold*.65;
        var direction=buy?'BUY':sell?'SELL':'NONE',ok=direction!=='NONE';
        send({type:'RESULT',result:{frameId:frameId,timeframe:tf,quality:ok?65:60,
          shockDirection:direction,shockOpticalVerified:ok,shockSameCandle:ok,
          shockRetraced:ok,shockRecovered:ok,shockFrameId:frameId,
          signal:direction,expiry:5,reason:ok?'Retragere si revenire observate in cadre LIVE':'Astept retragere si revenire'}});
      }catch(e){send({type:'ERROR',frameId:frameId,message:String(e)});}
    };
    image.src=url;
  };
  send({type:'READY'});
})();
<\/script></body></html>`;
