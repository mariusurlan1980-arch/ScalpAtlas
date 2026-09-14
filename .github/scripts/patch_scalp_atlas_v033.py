from pathlib import Path

APP = Path('scalp-atlas-new/App.tsx')
ENGINE = Path('scalp-atlas-new/analysisEngine.ts')


def replace_once(text: str, old: str, new: str, label: str) -> str:
    if old not in text:
        raise SystemExit(f'{label}: fragmentul așteptat nu a fost găsit; build oprit pentru siguranță.')
    return text.replace(old, new, 1)


# v0.3.3 rulează DUPĂ patch-ul v0.3.2.
# 1) pentru Breakout Suport/Rezistență afișăm clar nivelul orizontal spart;
# 2) adăugăm spațiu jos ca rezultatul să nu fie acoperit de bara Android.

app = APP.read_text(encoding='utf-8')
app = replace_once(
    app,
    "  page: { flexGrow: 1, padding: 18, gap: 16, backgroundColor: '#070b12' },",
    "  page: { flexGrow: 1, padding: 18, paddingBottom: 88, gap: 16, backgroundColor: '#070b12' },",
    'spațiu inferior Android',
)
APP.write_text(app, encoding='utf-8')

engine = ENGINE.read_text(encoding='utf-8')
engine = replace_once(engine, "const ENGINE_VERSION='0.2.4';", "const ENGINE_VERSION='0.2.5';", 'engine version 0.2.5')

old = """    // În starea WAIT marcăm numai nivelul care trebuie confirmat.
    if(result.wait&&curve.anchor){
      const anchor=curve.anchor;
      const structural=(direction==='BUY'?highs:lows).filter(p=>p.x<anchor.x-curve.w*.04);
      const ref=structural[structural.length-1]||(direction==='BUY'?highs[highs.length-1]:lows[lows.length-1]);
      if(ref){
        const y=Math.max(0,Math.min(curve.h,ref.y));
        lines.push({kind:'confirmation',x1:Math.max(0,anchor.x-curve.w*.18)/curve.w,y1:y/curve.h,x2:Math.min(curve.w,anchor.x+curve.w*.12)/curve.w,y2:y/curve.h});
      }
    }
    return lines;"""

new = """    // În starea WAIT marcăm numai nivelul care trebuie confirmat.
    if(result.wait&&curve.anchor){
      const anchor=curve.anchor;
      const structural=(direction==='BUY'?highs:lows).filter(p=>p.x<anchor.x-curve.w*.04);
      const ref=structural[structural.length-1]||(direction==='BUY'?highs[highs.length-1]:lows[lows.length-1]);
      if(ref){
        const y=Math.max(0,Math.min(curve.h,ref.y));
        lines.push({kind:'confirmation',x1:Math.max(0,anchor.x-curve.w*.18)/curve.w,y1:y/curve.h,x2:Math.min(curve.w,anchor.x+curve.w*.12)/curve.w,y2:y/curve.h});
      }
    }

    // Dacă semnalul este un breakout confirmat, păstrăm pe grafic și nivelul
    // orizontal care a fost spart. Astfel SELL + Breakout Suport arată explicit
    // suportul, iar BUY + Breakout Rezistență arată explicit rezistența.
    if(result.clear&&curve.anchor&&(result.idx===21||result.idx===22||result.idx===44)){
      const anchor=curve.anchor;
      const levelItems=(direction==='BUY'?highs:lows).filter(p=>p.x<anchor.x-curve.w*.04);
      const ref=levelItems[levelItems.length-1]||(direction==='BUY'?highs[highs.length-1]:lows[lows.length-1]);
      if(ref){
        const y=Math.max(0,Math.min(curve.h,ref.y));
        const startX=Math.max(curve.w*.08,ref.x-curve.w*.12);
        const endX=Math.min(curve.w*.94,anchor.x+curve.w*.10);
        lines.push({kind:'confirmation',x1:startX/curve.w,y1:y/curve.h,x2:endX/curve.w,y2:y/curve.h});
      }
    }
    return lines;"""

engine = replace_once(engine, old, new, 'nivel orizontal breakout')
ENGINE.write_text(engine, encoding='utf-8')
print('Patch v0.3.3 aplicat: nivel breakout vizibil + spațiu inferior Android.')
