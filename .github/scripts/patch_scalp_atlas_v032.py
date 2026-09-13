from pathlib import Path

APP = Path('scalp-atlas-new/App.tsx')
ENGINE = Path('scalp-atlas-new/analysisEngine.ts')


def replace_once(text: str, old: str, new: str, label: str) -> str:
    if old not in text:
        raise SystemExit(f'{label}: fragmentul așteptat nu a fost găsit; build oprit pentru siguranță.')
    return text.replace(old, new, 1)


# ---------------- App.tsx ----------------
app = APP.read_text(encoding='utf-8')

app = replace_once(
    app,
    "type AnalysisResult = {\n  signal: 'BUY' | 'SELL' | 'NONE';\n  pattern: string;",
    "type AnalysisResult = {\n  signal: 'BUY' | 'SELL' | 'NONE';\n  state?: 'SIGNAL' | 'WAIT' | 'NONE' | 'INVALID';\n  bias?: 'BUY' | 'SELL' | null;\n  pattern: string;",
    'AnalysisResult state',
)

app = replace_once(
    app,
    "        setMessage(\n          result.signal === 'NONE'\n            ? result.reason || 'Fără semnal clar.'\n            : `${result.signal} • ${result.pattern} • ${result.probability}%`\n        );",
    "        setMessage(\n          result.state === 'WAIT'\n            ? result.reason || 'Așteaptă confirmarea.'\n            : result.state === 'INVALID'\n              ? result.reason || 'Încarcă graficul original.'\n              : result.signal === 'NONE'\n                ? result.reason || 'Fără semnal clar.'\n                : `${result.signal} • ${result.pattern} • ${result.probability}%`\n        );",
    'mesaj WAIT/INVALID',
)

app = replace_once(
    app,
    "                analysis.signal === 'BUY' ? styles.buy : analysis.signal === 'SELL' ? styles.sell : styles.neutral,",
    "                analysis.state === 'WAIT' ? styles.wait : analysis.signal === 'BUY' ? styles.buy : analysis.signal === 'SELL' ? styles.sell : styles.neutral,",
    'culoare WAIT',
)

app = replace_once(
    app,
    "                {analysis.signal === 'NONE' ? 'FĂRĂ SEMNAL CLAR' : analysis.signal}",
    "                {analysis.state === 'WAIT' ? 'AȘTEAPTĂ CONFIRMAREA' : analysis.state === 'INVALID' ? 'FOTOGRAFIE DEJA ANALIZATĂ' : analysis.signal === 'NONE' ? 'FĂRĂ SEMNAL CLAR' : analysis.signal}",
    'titlu rezultat WAIT',
)

app = replace_once(
    app,
    "              <Text style={styles.statusText}>Model: {analysis.pattern || '—'}</Text>\n              <Text style={styles.statusText}>Probabilitate: {analysis.probability}%</Text>\n              <Text style={styles.statusText}>Expirare recomandată: {analysis.expiry ? `${analysis.expiry} min` : '—'}</Text>",
    "              <Text style={styles.statusText}>Model: {analysis.state === 'INVALID' ? '—' : (analysis.pattern || '—')}</Text>\n              <Text style={styles.statusText}>Probabilitate: {analysis.state === 'INVALID' ? '—' : `${analysis.probability}%`}</Text>\n              <Text style={styles.statusText}>Expirare recomandată: {analysis.state === 'WAIT' ? 'după confirmare' : analysis.expiry ? `${analysis.expiry} min` : '—'}</Text>\n              {(analysis.state === 'WAIT' || analysis.state === 'INVALID') && <Text style={styles.statusReason}>{analysis.reason}</Text>}",
    'detalii rezultat WAIT',
)

app = replace_once(
    app,
    "          Semnalul este afișat numai când potrivirea depășește pragul intern; altfel aplicația afișează „Fără semnal clar”. Probabilitatea este o estimare structurală, nu o garanție de tranzacționare.",
    "          BUY sau SELL apare numai după confirmare. Când prețul este la un nivel important fără spargere confirmată, aplicația afișează „Așteaptă confirmarea”. Probabilitatea este o estimare structurală, nu o garanție de tranzacționare.",
    'footer confirmare',
)

app = replace_once(
    app,
    "  resistanceLine: { backgroundColor: '#31d8ee' },",
    "  resistanceLine: { backgroundColor: '#ff6464' },",
    'trend descendent roșu',
)

app = replace_once(
    app,
    "  neutral: { color: '#d5dde8' },",
    "  neutral: { color: '#d5dde8' },\n  wait: { color: '#ffd34d' },",
    'stil WAIT',
)

app = replace_once(
    app,
    "  statusSmall: { color: '#728095', fontSize: 12 },",
    "  statusSmall: { color: '#728095', fontSize: 12 },\n  statusReason: { color: '#ffd34d', fontSize: 12, lineHeight: 17 },",
    'motiv WAIT',
)

APP.write_text(app, encoding='utf-8')


# ---------------- analysisEngine.ts ----------------
engine = ENGINE.read_text(encoding='utf-8')
engine = replace_once(engine, "const ENGINE_VERSION='0.2.3';", "const ENGINE_VERSION='0.2.4';", 'engine version')

needle = """  function isCandleColor(r,g,b){
    const mx=Math.max(r,g,b),mn=Math.min(r,g,b),sat=mx-mn;
    const greenish=(g>80&&g>r*1.10&&g>b*.84&&sat>30)||(g>115&&b>80&&r<125&&sat>28);
    const reddish=(r>105&&r>g*1.08&&r>b*1.03&&sat>30)||(r>155&&g>45&&g<155&&b<135);
    return greenish||reddish;
  }

  function buildPriceCurve(img){"""
replacement = """  function isCandleColor(r,g,b){
    const mx=Math.max(r,g,b),mn=Math.min(r,g,b),sat=mx-mn;
    const greenish=(g>80&&g>r*1.10&&g>b*.84&&sat>30)||(g>115&&b>80&&r<125&&sat>28);
    const reddish=(r>105&&r>g*1.08&&r>b*1.03&&sat>30)||(r>155&&g>45&&g<155&&b<135);
    return greenish||reddish;
  }

  // Protecție anti-recursie: o captură care conține deja interfața SCALP ATLAS
  // nu trebuie analizată din nou ca și cum ar fi un grafic brut.
  function looksLikeScalpAtlasScreenshot(data,w,h){
    let magenta=0,cyan=0,blue=0;
    const topEnd=Math.floor(h*.42);
    for(let y=0;y<topEnd;y+=3){
      for(let x=0;x<w;x+=3){
        const i=(y*w+x)*4,r=data[i],g=data[i+1],b=data[i+2];
        if(r>170&&b>150&&g<130)magenta++;
        if(b>150&&g>120&&r<120)cyan++;
      }
    }
    const midStart=Math.floor(h*.28),midEnd=Math.floor(h*.72);
    for(let y=midStart;y<midEnd;y+=3){
      for(let x=0;x<w;x+=3){
        const i=(y*w+x)*4,r=data[i],g=data[i+1],b=data[i+2];
        if(b>150&&g>70&&r<100&&b>g*1.2)blue++;
      }
    }
    return magenta>18&&cyan>28&&blue>220;
  }

  function buildPriceCurve(img){"""
engine = replace_once(engine, needle, replacement, 'detector captură Scalp Atlas')

engine = replace_once(
    engine,
    "    const data=ctx.getImageData(0,0,w,h).data;\n    // Exclude bottom trading buttons and the far-right action/price panel.",
    "    const data=ctx.getImageData(0,0,w,h).data;\n    if(looksLikeScalpAtlasScreenshot(data,w,h)){\n      return {pts:[],w,h,quality:0,anchor:null,spanCoverage:0,recursiveAppCapture:true};\n    }\n    // Exclude bottom trading buttons and the far-right action/price panel.",
    'blocare captură deja analizată',
)

engine = replace_once(
    engine,
    "  function classify(curve){\n    const {pts,w,h,quality}=curve;\n    if(pts.length<10||quality<.25)return {clear:false,dir:'NONE',atlas:'—',idx:0,score:0,reason:'Imagine insuficient de clară'};",
    "  function classify(curve){\n    const {pts,w,h,quality}=curve;\n    if(curve.recursiveAppCapture)return {clear:false,state:'INVALID',wait:false,bias:null,dir:'NONE',atlas:'Fotografie deja analizată',idx:0,score:0,reason:'Încarcă graficul original din broker, fără interfața sau liniile SCALP ATLAS.'};\n    if(pts.length<10||quality<.25)return {clear:false,dir:'NONE',atlas:'—',idx:0,score:0,reason:'Imagine insuficient de clară'};",
    'clasificare captură recursivă',
)

engine = replace_once(
    engine,
    "      return {clear:false,dir:'NONE',atlas:'Așteaptă confirmarea',idx:0,score:Math.min(score,.69),reason:'Prețul este sub rezistență. BUY necesită o închidere clară deasupra liniei galbene'};",
    "      return {clear:false,state:'WAIT',wait:true,bias:'BUY',dir:'NONE',atlas:'Trend Scalp – Confirmare rezistență',idx:0,score:Math.min(score,.69),reason:'Prețul este sub rezistență. Așteaptă o închidere clară deasupra nivelului înainte de BUY'};",
    'WAIT BUY',
)

engine = replace_once(
    engine,
    "      return {clear:false,dir:'NONE',atlas:'Așteaptă confirmarea',idx:0,score:Math.min(score,.69),reason:'Prețul este deasupra suportului. SELL necesită o închidere clară sub linia galbenă'};",
    "      return {clear:false,state:'WAIT',wait:true,bias:'SELL',dir:'NONE',atlas:'Trend Scalp – Confirmare suport',idx:0,score:Math.min(score,.69),reason:'Prețul este deasupra suportului. Așteaptă o închidere clară sub nivel înainte de SELL'};",
    'WAIT SELL',
)

start = engine.find("  function trendLinesFor(curve,result){")
end = engine.find("\n  function run(dataUrl,timeframe){", start)
if start < 0 or end < 0:
    raise SystemExit('trendLinesFor: funcția nu a fost găsită; build oprit pentru siguranță.')

new_trend_lines = r'''  function trendLinesFor(curve,result){
    if(!curve||!curve.pts||curve.pts.length<7||result.state==='INVALID')return [];
    const pv=pivots(curve.pts,curve.h);
    const highs=pv.filter(p=>p.type==='H').slice(-3),lows=pv.filter(p=>p.type==='L').slice(-3);
    const lines=[];

    const addExtended=(items,kind,envelopeKey)=>{
      let a,b;
      if(items.length>=2){a=items[items.length-2];b=items[items.length-1];}
      else{
        const sample=curve.pts.slice(-Math.max(10,Math.floor(curve.pts.length*.48))).map(p=>({x:p.x,y:p[envelopeKey]}));
        if(sample.length<2)return;
        const reg=linReg(sample),first=sample[0],last=sample[sample.length-1];
        a={x:first.x,y:reg.slope*first.x+reg.intercept};
        b={x:last.x,y:reg.slope*last.x+reg.intercept};
      }
      const endX=Math.min(curve.w*.94,Math.max(b.x+curve.w*.10,b.x));
      const endY=b.y+(endX-b.x)*(b.y-a.y)/Math.max(1,b.x-a.x);
      lines.push({kind,x1:a.x/curve.w,y1:Math.max(0,Math.min(1,a.y/curve.h)),x2:endX/curve.w,y2:Math.max(0,Math.min(1,endY/curve.h))});
    };

    const direction=result.clear?result.dir:(result.wait?result.bias:'NONE');
    // O singură linie diagonală pentru direcția trendului: verde UP, roșu DOWN.
    if(direction==='BUY')addExtended(lows,'support','hi');
    else if(direction==='SELL')addExtended(highs,'resistance','lo');

    // În starea WAIT marcăm numai nivelul care trebuie confirmat.
    if(result.wait&&curve.anchor){
      const anchor=curve.anchor;
      const structural=(direction==='BUY'?highs:lows).filter(p=>p.x<anchor.x-curve.w*.04);
      const ref=structural[structural.length-1]||(direction==='BUY'?highs[highs.length-1]:lows[lows.length-1]);
      if(ref){
        const y=Math.max(0,Math.min(curve.h,ref.y));
        lines.push({kind:'confirmation',x1:Math.max(0,anchor.x-curve.w*.18)/curve.w,y1:y/curve.h,x2:Math.min(curve.w,anchor.x+curve.w*.12)/curve.w,y2:y/curve.h});
      }
    }
    return lines;
  }
'''
engine = engine[:start] + new_trend_lines + engine[end:]

engine = replace_once(
    engine,
    "            signal:r.clear?r.dir:'NONE',\n            pattern:r.atlas,",
    "            signal:r.clear?r.dir:'NONE',\n            state:r.clear?'SIGNAL':r.wait?'WAIT':(r.state||'NONE'),\n            bias:r.bias||(r.clear?r.dir:null),\n            pattern:r.atlas,",
    'payload state/bias',
)

ENGINE.write_text(engine, encoding='utf-8')
print('Patch v0.3.2 aplicat: WAIT explicit, trend unic, blocare capturi SCALP ATLAS.')
