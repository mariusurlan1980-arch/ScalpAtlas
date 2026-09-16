from pathlib import Path

APP = Path('scalp-atlas-new/App.tsx')
ENGINE = Path('scalp-atlas-new/analysisEngine.ts')


def replace_once(text: str, old: str, new: str, label: str) -> str:
    if old not in text:
        raise SystemExit(f'{label}: fragmentul așteptat nu a fost găsit; build oprit pentru siguranță.')
    return text.replace(old, new, 1)


# v0.3.18 rulează DUPĂ patch-urile v0.3.2 ... v0.3.17.
# Corecție după testul TND/USD OTC M10:
# - BUY nu mai este emis chiar sub un maxim local recent / rezistență;
# - SELL nu mai este emis chiar deasupra unui minim local recent / suport;
# - în aceste situații rezultatul devine WAIT, cu linie galbenă exact la nivelul de confirmare;
# - săgeata semnalului confirmat este adusă mai aproape de ultima lumânare.

app = APP.read_text(encoding='utf-8')
app = replace_once(
    app,
    "            <Text style={styles.versionBadge}>v0.3.17 TEST</Text>",
    "            <Text style={styles.versionBadge}>v0.3.18 TEST</Text>",
    'badge v0.3.18',
)

# Aducem săgeata mai aproape de ultima lumânare: rămâne în dreapta, dar nu mai este
# împinsă spre banda de 70-78% a imaginii.
app = replace_once(
    app,
    "    const frontBandX = offsetX + displayW * 0.70;",
    "    const frontBandX = anchorX + 22;",
    'front band săgeată aproape de anchor',
)
app = replace_once(
    app,
    "    const cappedStructuralFront = Math.min(structuralFrontX, offsetX + displayW * 0.78);",
    "    const cappedStructuralFront = Math.min(structuralFrontX, anchorX + 28);",
    'limitare trend extins pentru săgeată',
)
app = replace_once(
    app,
    "    const frontX = Math.max(anchorX + 26, frontBandX, cappedStructuralFront + 10);",
    "    const frontX = Math.max(anchorX + 22, Math.min(anchorX + 30, cappedStructuralFront + 4));",
    'poziție frontală compactă',
)
app = replace_once(
    app,
    "    const xOffsets = [0, 12, 24, 36];",
    "    const xOffsets = [0, 6, 12, 18];",
    'offseturi orizontale compacte',
)

APP.write_text(app, encoding='utf-8')

engine = ENGINE.read_text(encoding='utf-8')
engine = replace_once(
    engine,
    "const ENGINE_VERSION='0.3.5';",
    "const ENGINE_VERSION='0.3.6';",
    'engine version 0.3.6',
)

# Filtru local de suport/rezistență. Folosim ultimele ~34% din structura detectată,
# dar excludem ultimele 3 puncte ca nivelul să vină din piața recentă, nu chiar din
# lumânarea curentă. Confirmarea cere trecere reală peste/sub nivel și impuls local.
needle = """    if(proposedOppositions>=2&&proposedConfirmations<2&&!freshBreakForDir){"""

guard = """    // v0.3.18 — LOCAL RESISTANCE / SUPPORT ENTRY GUARD.
    const localWindowSize=Math.max(10,Math.floor(pts.length*.34));
    const localStart=Math.max(0,pts.length-localWindowSize);
    const localEnd=Math.max(localStart+1,pts.length-3);
    const localWindow=pts.slice(localStart,localEnd);
    const recentResistanceY=localWindow.length?Math.min(...localWindow.map(p=>p.lo)):null;
    const recentSupportY=localWindow.length?Math.max(...localWindow.map(p=>p.hi)):null;

    const buyNearRecentResistance=Number.isFinite(recentResistanceY)&&
      end.y>=recentResistanceY-h*.008&&end.y<=recentResistanceY+h*.045;
    const sellNearRecentSupport=Number.isFinite(recentSupportY)&&
      end.y<=recentSupportY+h*.008&&end.y>=recentSupportY-h*.045;

    const confirmedAboveRecentResistance=Number.isFinite(recentResistanceY)&&
      end.y<recentResistanceY-h*.014&&recentNorm>.035&&microNorm>.02;
    const confirmedBelowRecentSupport=Number.isFinite(recentSupportY)&&
      end.y>recentSupportY+h*.014&&recentNorm<-.035&&microNorm<-.02;

    if(dir==='BUY'&&buyNearRecentResistance&&!confirmedAboveRecentResistance){
      return {
        clear:false,state:'WAIT',wait:true,bias:'BUY',dir:'NONE',
        atlas:'Canal Ascendent – rezistență locală',idx:0,
        score:Math.min(score,.71),
        confirmationLevelY:recentResistanceY/h,
        reason:'BUY este prea aproape de maximul local recent. Așteaptă închiderea unei lumânări peste linia galbenă înainte de intrare.'
      };
    }

    if(dir==='SELL'&&sellNearRecentSupport&&!confirmedBelowRecentSupport){
      return {
        clear:false,state:'WAIT',wait:true,bias:'SELL',dir:'NONE',
        atlas:'Canal Descendent – suport local',idx:0,
        score:Math.min(score,.71),
        confirmationLevelY:recentSupportY/h,
        reason:'SELL este prea aproape de minimul local recent. Așteaptă închiderea unei lumânări sub linia galbenă înainte de intrare.'
      };
    }

    if(proposedOppositions>=2&&proposedConfirmations<2&&!freshBreakForDir){"""

engine = replace_once(engine, needle, guard, 'gardă suport/rezistență locală')

# v0.3.17 desena nivelul WAIT dintr-un pivot. Dacă v0.3.18 transmite explicit
# confirmationLevelY, acela devine sursa principală pentru linia galbenă.
old_level = """      const ref=recentCandidates[0]||candidates[0]||null;
      if(ref){
        const y=Math.max(0,Math.min(curve.h,ref.y));
        const startX=Math.max(curve.w*.10,ref.x-curve.w*.08);
        const endX=Math.min(curve.w*.94,Math.max(anchor.x+curve.w*.10,ref.x+curve.w*.18));
        lines.push({kind:'confirmation',x1:startX/curve.w,y1:y/curve.h,x2:endX/curve.w,y2:y/curve.h});
      }"""

new_level = """      const ref=recentCandidates[0]||candidates[0]||null;
      const explicitY=Number.isFinite(result.confirmationLevelY)?result.confirmationLevelY*curve.h:null;
      if(ref||Number.isFinite(explicitY)){
        const y=Math.max(0,Math.min(curve.h,Number.isFinite(explicitY)?explicitY:ref.y));
        const refX=ref?ref.x:Math.max(0,anchor.x-curve.w*.14);
        const startX=Math.max(curve.w*.10,refX-curve.w*.08);
        const endX=Math.min(curve.w*.94,Math.max(anchor.x+curve.w*.10,refX+curve.w*.18));
        lines.push({kind:'confirmation',x1:startX/curve.w,y1:y/curve.h,x2:endX/curve.w,y2:y/curve.h});
      }"""

engine = replace_once(engine, old_level, new_level, 'linie galbenă la nivelul explicit v0.3.18')

ENGINE.write_text(engine, encoding='utf-8')
print('Patch v0.3.18 aplicat: BUY/SELL blocat lângă rezistență/suport recent + linie galbenă exactă + săgeată mai aproape de ultima lumânare.')
