from pathlib import Path
p=Path(".github/templates/ScalpAtlasAnalysisEngineV0416.ts")
s=p.read_text(encoding="utf-8")
anchor="  function simpleScalpContext(curve){"
assert s.count(anchor)==1
fn="""  // Experimental optical geometry: conservative veto only, never creates a signal.
  function geometricContext(curve,direction){
    const pts=(curve.pts||[]).slice(0,-2);
    if(pts.length<24||!curve.h||!curve.w)return {ok:false,shape:'NECITIBIL'};
    const n=Math.max(8,Math.floor(pts.length*.24));
    const tail=pts.slice(-n);
    const highs=[],lows=[];
    for(let i=1;i<tail.length-1;i++){
      if(tail[i].y<=tail[i-1].y&&tail[i].y<=tail[i+1].y)highs.push(tail[i]);
      if(tail[i].y>=tail[i-1].y&&tail[i].y>=tail[i+1].y)lows.push(tail[i]);
    }
    if(highs.length<2||lows.length<2)return {ok:false,shape:'NECLAR'};
    const top=highs.slice(-2),bottom=lows.slice(-2);
    const hs=(top[1].y-top[0].y)/curve.h;
    const ls=(bottom[1].y-bottom[0].y)/curve.h;
    const near=(a,b)=>Math.abs(a.y-b.y)/curve.h<.018;
    const doubleTop=near(top[0],top[1]);
    const doubleBottom=near(bottom[0],bottom[1]);
    const converging=hs>.008&&ls<-.008;
    const channel=Math.abs(hs-ls)<.018&&Math.abs(hs)>.005;
    if(doubleTop&&direction==='BUY')return {ok:false,shape:'DUBLU_MAXIM'};
    if(doubleBottom&&direction==='SELL')return {ok:false,shape:'DUBLU_MINIM'};
    if(converging)return {ok:false,shape:'TRIUNGHI_NE_CONFIRMAT'};
    if(channel&&((hs<0&&direction==='BUY')||(hs>0&&direction==='SELL')))
      return {ok:false,shape:'CANAL_CONTRA_DIRECTIE'};
    return {ok:true,shape:channel?'CANAL':'STRUCTURA_NEUTRA'};
  }

"""
s=s.replace(anchor,fn+anchor)
needle="        const clear=r.clear&&evidence.ok;"
assert s.count(needle)==1
s=s.replace(needle,"        const geometry=geometricContext(curve,r.dir);\n        const clear=r.clear&&evidence.ok&&geometry.ok;")
needle="            marketRegime,"
assert s.count(needle)==1
s=s.replace(needle,needle+"\n            geometricPattern:geometry.shape,\n            geometricGate:geometry.ok,")
p.write_text(s,encoding="utf-8")
print("PASS: geometric context added as conservative no-bip veto")
