from pathlib import Path

APP = Path('scalp-atlas-new/App.tsx')
ENGINE = Path('scalp-atlas-new/analysisEngine.ts')


def replace_once(text: str, old: str, new: str, label: str) -> str:
    if old not in text:
        raise SystemExit(f'{label}: fragmentul așteptat nu a fost găsit; build oprit pentru siguranță.')
    return text.replace(old, new, 1)


# v0.3.20 rulează DUPĂ v0.3.19.
# Corecție după testul USD/EGP OTC M10:
# - linia de trend confirmată nu mai este ancorată în centrul pivoturilor;
# - pentru SELL / rezistență folosim extremitățile superioare (wick/high envelope);
# - pentru BUY / suport folosim extremitățile inferioare (wick/low envelope);
# - păstrăm aceeași pantă structurală, dar evităm ca linia să taie inutil corpurile lumânărilor.

app = APP.read_text(encoding='utf-8')
app = replace_once(
    app,
    "            <Text style={styles.versionBadge}>v0.3.19 TEST</Text>",
    "            <Text style={styles.versionBadge}>v0.3.20 TEST</Text>",
    'badge v0.3.20',
)
APP.write_text(app, encoding='utf-8')

engine = ENGINE.read_text(encoding='utf-8')
engine = replace_once(
    engine,
    "const ENGINE_VERSION='0.3.7';",
    "const ENGINE_VERSION='0.3.8';",
    'engine version 0.3.8',
)

old_branch = """      let a,b;
      if(items.length>=2){a=items[items.length-2];b=items[items.length-1];}
      else{
        const sample=curve.pts.slice(-Math.max(10,Math.floor(curve.pts.length*.48))).map(p=>({x:p.x,y:p[envelopeKey]}));"""

new_branch = """      let a,b;
      if(items.length>=2){
        // v0.3.20 — WICK-ALIGNED TREND LINE.
        // Pivoții sunt calculați pe centrul curbei și pot împinge linia prin corpuri.
        // Re-ancorăm fiecare pivot în extremitatea reală a lumânării detectate:
        // 'lo' = extremitate superioară pentru rezistență, 'hi' = extremitate inferioară pentru suport.
        const snapToEnvelope=(pivot)=>{
          let nearest=null,bestDx=Infinity;
          for(const p of curve.pts){
            const dx=Math.abs(p.x-pivot.x);
            if(dx<bestDx){bestDx=dx;nearest=p;}
          }
          const envelopeY=nearest&&Number.isFinite(nearest[envelopeKey])?nearest[envelopeKey]:pivot.y;
          return {x:pivot.x,y:envelopeY};
        };
        a=snapToEnvelope(items[items.length-2]);
        b=snapToEnvelope(items[items.length-1]);
      }
      else{
        const sample=curve.pts.slice(-Math.max(10,Math.floor(curve.pts.length*.48))).map(p=>({x:p.x,y:p[envelopeKey]}));"""

engine = replace_once(engine, old_branch, new_branch, 'ancorare linie trend pe wick-uri')
ENGINE.write_text(engine, encoding='utf-8')

print('Patch v0.3.20 aplicat: linia de rezistență/suport este ancorată pe extremitățile wick-urilor, nu pe centrul pivoturilor.')
