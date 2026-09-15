from pathlib import Path

APP = Path('scalp-atlas-new/App.tsx')
ENGINE = Path('scalp-atlas-new/analysisEngine.ts')


def replace_once(text: str, old: str, new: str, label: str) -> str:
    if old not in text:
        raise SystemExit(f'{label}: fragmentul așteptat nu a fost găsit; build oprit pentru siguranță.')
    return text.replace(old, new, 1)


# v0.3.17 rulează DUPĂ patch-urile v0.3.2 ... v0.3.16.
# Corecție după testul MAD/USD OTC M10:
# - în WAIT nu mai desenăm linia diagonală de trend, fiindcă poate părea „linia de confirmare”;
# - afișăm o singură linie GALBENĂ, orizontală, la ultimul nivel structural relevant;
# - cardul de rezultat explică exact ce trebuie să facă lumânarea selectată pentru confirmare.

app = APP.read_text(encoding='utf-8')
app = replace_once(
    app,
    "            <Text style={styles.versionBadge}>v0.3.16 TEST</Text>",
    "            <Text style={styles.versionBadge}>v0.3.17 TEST</Text>",
    'badge v0.3.17',
)

old_wait_details = """              {(analysis.state === 'WAIT' || analysis.state === 'INVALID') && <Text style={styles.statusReason}>{analysis.reason}</Text>}"""
new_wait_details = """              {analysis.state === 'WAIT' && (
                <View style={styles.confirmGuide}>
                  <Text style={styles.confirmGuideTitle}>CE AȘTEAPTĂ APLICAȚIA</Text>
                  <Text style={styles.confirmGuideText}>
                    {analysis.bias === 'SELL'
                      ? `Confirmare SELL: așteaptă ÎNCHIDEREA unei lumânări ${timeframe} sub linia galbenă — ultimul minim structural.`
                      : analysis.bias === 'BUY'
                        ? `Confirmare BUY: așteaptă ÎNCHIDEREA unei lumânări ${timeframe} peste linia galbenă — ultimul maxim structural.`
                        : `Așteaptă o spargere structurală clară pe ${timeframe}; linia galbenă marchează nivelul de confirmare.`}
                  </Text>
                </View>
              )}
              {(analysis.state === 'WAIT' || analysis.state === 'INVALID') && <Text style={styles.statusReason}>{analysis.reason}</Text>}"""
app = replace_once(app, old_wait_details, new_wait_details, 'ghid concret WAIT')

old_styles = """  statusReason: { color: '#ffd34d', fontSize: 12, lineHeight: 17 },"""
new_styles = """  statusReason: { color: '#ffd34d', fontSize: 12, lineHeight: 17 },
  confirmGuide: { marginTop: 4, borderWidth: 1, borderColor: '#5b4a1a', backgroundColor: '#151208', borderRadius: 10, padding: 10, gap: 4 },
  confirmGuideTitle: { color: '#ffd34d', fontSize: 11, fontWeight: '900', letterSpacing: 0.5 },
  confirmGuideText: { color: '#f3e7aa', fontSize: 12, lineHeight: 18, fontWeight: '700' },"""
app = replace_once(app, old_styles, new_styles, 'stil ghid confirmare')

APP.write_text(app, encoding='utf-8')

engine = ENGINE.read_text(encoding='utf-8')
engine = replace_once(
    engine,
    "const ENGINE_VERSION='0.3.4';",
    "const ENGINE_VERSION='0.3.5';",
    'engine version 0.3.5',
)

start = engine.find("  function trendLinesFor(curve,result){")
end = engine.find("\n  function run(dataUrl,timeframe){", start)
if start < 0 or end < 0:
    raise SystemExit('trendLinesFor: funcția nu a fost găsită; build oprit pentru siguranță.')

new_trend_lines = r'''  function trendLinesFor(curve,result){
    if(!curve||!curve.pts||curve.pts.length<7||result.state==='INVALID')return [];
    const pv=pivots(curve.pts,curve.h);
    const highs=pv.filter(p=>p.type==='H').slice(-5),lows=pv.filter(p=>p.type==='L').slice(-5);
    const lines=[];
    const direction=result.clear?result.dir:(result.wait?result.bias:'NONE');

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

    // v0.3.17: în WAIT afișăm NUMAI nivelul concret de confirmare.
    // Eliminăm linia diagonală de trend ca să nu fie confundată cu pragul de intrare.
    if(result.wait&&curve.anchor&&direction!=='NONE'){
      const anchor=curve.anchor;
      const candidates=(direction==='BUY'?highs:lows)
        .filter(p=>p.x<anchor.x-curve.w*.025)
        .sort((a,b)=>b.x-a.x);

      // Preferăm un pivot recent, apropiat de zona curentă, dar nu un punct vechi din mijlocul graficului.
      const recentCandidates=candidates.filter(p=>p.x>=anchor.x-curve.w*.42);
      const ref=recentCandidates[0]||candidates[0]||null;
      if(ref){
        const y=Math.max(0,Math.min(curve.h,ref.y));
        const startX=Math.max(curve.w*.10,ref.x-curve.w*.08);
        const endX=Math.min(curve.w*.94,Math.max(anchor.x+curve.w*.10,ref.x+curve.w*.18));
        lines.push({kind:'confirmation',x1:startX/curve.w,y1:y/curve.h,x2:endX/curve.w,y2:y/curve.h});
      }
      return lines;
    }

    // Pentru semnale confirmate păstrăm linia direcției trendului.
    if(direction==='BUY')addExtended(lows,'support','hi');
    else if(direction==='SELL')addExtended(highs,'resistance','lo');

    // Pentru breakout confirmat păstrăm exact nivelul structural calculat în classify().
    if(result.clear&&curve.anchor&&(result.idx===21||result.idx===22)&&Number.isFinite(result.breakoutLevelY)){
      const anchor=curve.anchor;
      const y=Math.max(0,Math.min(curve.h,result.breakoutLevelY*curve.h));
      const startX=Math.max(curve.w*.08,anchor.x-curve.w*.30);
      const endX=Math.min(curve.w*.94,anchor.x+curve.w*.11);
      lines.push({kind:'confirmation',x1:startX/curve.w,y1:y/curve.h,x2:endX/curve.w,y2:y/curve.h});
    }
    return lines;
  }
'''

engine = engine[:start] + new_trend_lines + engine[end:]
ENGINE.write_text(engine, encoding='utf-8')

print('Patch v0.3.17 aplicat: WAIT = o singură linie galbenă la nivel structural + instrucțiune concretă de închidere pe timeframe.')
