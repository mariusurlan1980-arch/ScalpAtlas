from pathlib import Path

APP = Path('scalp-atlas-new/App.tsx')
ENGINE = Path('scalp-atlas-new/analysisEngine.ts')


def replace_once(text: str, old: str, new: str, label: str) -> str:
    if old not in text:
        raise SystemExit(f'{label}: fragmentul așteptat nu a fost găsit; build oprit pentru siguranță.')
    return text.replace(old, new, 1)


# v0.3.8 rulează DUPĂ patch-urile v0.3.2 ... v0.3.7.
# Corecție principală pentru testele QAR/CNY și USD/RUB:
# - trend puternic + preț lipit de maximul/minimul recent => nu forțează intrarea;
# - afișează AȘTEAPTĂ CONFIRMAREA cu bias BUY/SELL;
# - trasează galben exact nivelul recent care trebuie confirmat;
# - expirarea rămâne „după confirmare” în starea WAIT.

app = APP.read_text(encoding='utf-8')
app = replace_once(
    app,
    "            <Text style={styles.versionBadge}>v0.3.7 TEST</Text>",
    "            <Text style={styles.versionBadge}>v0.3.8 TEST</Text>",
    'badge v0.3.8',
)

app = replace_once(
    app,
    "              <Text style={styles.statusText}>Model: {analysis.state === 'INVALID' ? '—' : (analysis.pattern || '—')}</Text>\n              <Text style={styles.statusText}>Probabilitate: {analysis.state === 'INVALID' ? '—' : `${analysis.probability}%`}</Text>",
    "              <Text style={styles.statusText}>Model: {analysis.state === 'INVALID' ? '—' : (analysis.pattern || '—')}</Text>\n              {analysis.state === 'WAIT' && analysis.bias && <Text style={styles.statusText}>Bias: {analysis.bias}</Text>}\n              <Text style={styles.statusText}>Probabilitate: {analysis.state === 'INVALID' ? '—' : `${analysis.probability}%`}</Text>",
    'bias vizibil în WAIT',
)
APP.write_text(app, encoding='utf-8')

engine = ENGINE.read_text(encoding='utf-8')
engine = replace_once(engine, "const ENGINE_VERSION='0.2.9';", "const ENGINE_VERSION='0.3.0';", 'engine version 0.3.0')

old_wait = """    const nearResistance=!!(refHigh&&bodyClose>=refHigh.y-h*.012&&bodyClose<=refHigh.y+h*.075);
    const nearSupport=!!(refLow&&bodyClose<=refLow.y+h*.012&&bodyClose>=refLow.y-h*.075);
    const rejectedResistance=!!(refHigh&&wickBreakUp&&!bodyBreakUp);
    const rejectedSupport=!!(refLow&&wickBreakDown&&!bodyBreakDown);

    if(dir==='BUY'&&(nearResistance||rejectedResistance)&&!breakoutUp){
      return {
        clear:false,state:'WAIT',wait:true,bias:'BUY',dir:'NONE',
        atlas:'Trend Scalp – Confirmare rezistență',idx:0,score:Math.min(score,.69),
        reason:rejectedResistance
          ? 'Fitilul a trecut peste rezistență, dar corpul/închiderea estimată a revenit sub nivel. Așteaptă confirmarea înainte de BUY'
          : 'Prețul este la rezistență. BUY necesită corp/închidere estimată clar deasupra nivelului'
      };
    }
    if(dir==='SELL'&&(nearSupport||rejectedSupport)&&!breakoutDown){
      return {
        clear:false,state:'WAIT',wait:true,bias:'SELL',dir:'NONE',
        atlas:'Trend Scalp – Confirmare suport',idx:0,score:Math.min(score,.69),
        reason:rejectedSupport
          ? 'Fitilul a trecut sub suport, dar corpul/închiderea estimată a revenit peste nivel. Așteaptă confirmarea înainte de SELL'
          : 'Prețul este la suport. SELL necesită corp/închidere estimată clar sub nivel'
      };
    }"""

new_wait = """    const nearResistance=!!(refHigh&&bodyClose>=refHigh.y-h*.012&&bodyClose<=refHigh.y+h*.075);
    const nearSupport=!!(refLow&&bodyClose<=refLow.y+h*.012&&bodyClose>=refLow.y-h*.075);
    const rejectedResistance=!!(refHigh&&wickBreakUp&&!bodyBreakUp);
    const rejectedSupport=!!(refLow&&wickBreakDown&&!bodyBreakDown);

    // 1) Nivel structural clasic: păstrăm regula strictă din v0.3.7.
    if(dir==='BUY'&&(nearResistance||rejectedResistance)&&!breakoutUp){
      return {
        clear:false,state:'WAIT',wait:true,bias:'BUY',dir:'NONE',
        atlas:'Trend Scalp – Confirmare rezistență',idx:0,score:Math.min(score,.69),
        waitLevelY:refHigh?refHigh.y/h:null,
        reason:rejectedResistance
          ? 'Fitilul a trecut peste rezistență, dar corpul/închiderea estimată a revenit sub nivel. Așteaptă confirmarea înainte de BUY'
          : 'Prețul este la rezistență. BUY necesită corp/închidere estimată clar deasupra nivelului'
      };
    }
    if(dir==='SELL'&&(nearSupport||rejectedSupport)&&!breakoutDown){
      return {
        clear:false,state:'WAIT',wait:true,bias:'SELL',dir:'NONE',
        atlas:'Trend Scalp – Confirmare suport',idx:0,score:Math.min(score,.69),
        waitLevelY:refLow?refLow.y/h:null,
        reason:rejectedSupport
          ? 'Fitilul a trecut sub suport, dar corpul/închiderea estimată a revenit peste nivel. Așteaptă confirmarea înainte de SELL'
          : 'Prețul este la suport. SELL necesită corp/închidere estimată clar sub nivel'
      };
    }

    // 2) Protecție contra intrării târzii: după un impuls puternic, dacă prețul
    // este lipit de maximul/minimul recent și nu există o spargere structurală
    // confirmată, cerem încă o închidere de confirmare în loc să forțăm BUY/SELL.
    const lateWindow=Math.max(12,Math.floor(pts.length*.34));
    const priorRecent=pts.slice(Math.max(0,pts.length-lateWindow),Math.max(0,pts.length-2));
    const recentHighY=priorRecent.length?Math.min(...priorRecent.map(p=>Number.isFinite(p.lo)?p.lo:p.y)):null;
    const recentLowY=priorRecent.length?Math.max(...priorRecent.map(p=>Number.isFinite(p.hi)?p.hi:p.y)):null;
    const strongBuyImpulse=norm>.055&&recentNorm>.075&&consensus>=.32;
    const strongSellImpulse=norm<-.055&&recentNorm<-.075&&consensus>=.32;
    const atRecentHigh=recentHighY!==null&&bodyClose>=recentHighY-h*.018&&bodyClose<=recentHighY+h*.045;
    const atRecentLow=recentLowY!==null&&bodyClose<=recentLowY+h*.018&&bodyClose>=recentLowY-h*.045;
    const confirmedStructuralBreakUp=!!(refHigh&&breakoutUp&&bodyBreakUp);
    const confirmedStructuralBreakDown=!!(refLow&&breakoutDown&&bodyBreakDown);

    if(dir==='BUY'&&strongBuyImpulse&&atRecentHigh&&!confirmedStructuralBreakUp){
      return {
        clear:false,state:'WAIT',wait:true,bias:'BUY',dir:'NONE',
        atlas:'Canal Ascendent – Confirmare maxim recent',idx:0,score:Math.min(score,.69),
        waitLevelY:recentHighY/h,
        reason:'Trendul este ascendent, dar prețul este foarte aproape de maximul recent după un impuls puternic. Așteaptă o închidere clară peste linia galbenă înainte de BUY'
      };
    }
    if(dir==='SELL'&&strongSellImpulse&&atRecentLow&&!confirmedStructuralBreakDown){
      return {
        clear:false,state:'WAIT',wait:true,bias:'SELL',dir:'NONE',
        atlas:'Canal Descendent – Confirmare minim recent',idx:0,score:Math.min(score,.69),
        waitLevelY:recentLowY/h,
        reason:'Trendul este descendent, dar prețul este foarte aproape de minimul recent după un impuls puternic. Așteaptă o închidere clară sub linia galbenă înainte de SELL'
      };
    }"""
engine = replace_once(engine, old_wait, new_wait, 'WAIT la maxim/minim recent după impuls')

old_wait_lines = """    // În starea WAIT marcăm numai nivelul care trebuie confirmat.
    if(result.wait&&curve.anchor){
      const anchor=curve.anchor;
      const structural=(direction==='BUY'?highs:lows).filter(p=>p.x<anchor.x-curve.w*.04);
      const ref=structural[structural.length-1]||(direction==='BUY'?highs[highs.length-1]:lows[lows.length-1]);
      if(ref){
        const y=Math.max(0,Math.min(curve.h,ref.y));
        lines.push({kind:'confirmation',x1:Math.max(0,anchor.x-curve.w*.18)/curve.w,y1:y/curve.h,x2:Math.min(curve.w,anchor.x+curve.w*.12)/curve.w,y2:y/curve.h});
      }
    }"""

new_wait_lines = """    // În starea WAIT marcăm numai nivelul care trebuie confirmat.
    // Dacă classify() a furnizat un nivel exact (waitLevelY), îl folosim pe acela.
    if(result.wait&&curve.anchor){
      const anchor=curve.anchor;
      let y=null;
      if(Number.isFinite(result.waitLevelY)){
        y=Math.max(0,Math.min(curve.h,result.waitLevelY*curve.h));
      }else{
        const structural=(direction==='BUY'?highs:lows).filter(p=>p.x<anchor.x-curve.w*.04);
        const ref=structural[structural.length-1]||(direction==='BUY'?highs[highs.length-1]:lows[lows.length-1]);
        if(ref)y=Math.max(0,Math.min(curve.h,ref.y));
      }
      if(Number.isFinite(y)){
        lines.push({kind:'confirmation',x1:Math.max(0,anchor.x-curve.w*.22)/curve.w,y1:y/curve.h,x2:Math.min(curve.w,anchor.x+curve.w*.12)/curve.w,y2:y/curve.h});
      }
    }"""
engine = replace_once(engine, old_wait_lines, new_wait_lines, 'linie galbenă exactă pentru WAIT')

ENGINE.write_text(engine, encoding='utf-8')
print('Patch v0.3.8 aplicat: intrare târzie la maxim/minim recent => AȘTEAPTĂ CONFIRMAREA + bias + linie galbenă exactă.')
