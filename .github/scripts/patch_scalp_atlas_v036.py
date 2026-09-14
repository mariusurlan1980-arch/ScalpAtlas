from pathlib import Path

APP = Path('scalp-atlas-new/App.tsx')
ENGINE = Path('scalp-atlas-new/analysisEngine.ts')


def replace_once(text: str, old: str, new: str, label: str) -> str:
    if old not in text:
        raise SystemExit(f'{label}: fragmentul așteptat nu a fost găsit; build oprit pentru siguranță.')
    return text.replace(old, new, 1)


# v0.3.6 rulează DUPĂ patch-urile v0.3.2 ... v0.3.5.
# Corecție principală:
# - „Triunghi Expanding” este permis doar când există DOUĂ limite divergente reale;
# - dacă geometria nu este confirmată, motorul revine la Canal Ascendent/Descendent
#   sau la starea de confirmare, în funcție de structură;
# - pentru un Triunghi Expanding valid se desenează ambele linii divergente.

app = APP.read_text(encoding='utf-8')
app = replace_once(
    app,
    "            <Text style={styles.versionBadge}>v0.3.5 TEST</Text>",
    "            <Text style={styles.versionBadge}>v0.3.6 TEST</Text>",
    'badge v0.3.6',
)
APP.write_text(app, encoding='utf-8')

engine = ENGINE.read_text(encoding='utf-8')
engine = replace_once(engine, "const ENGINE_VERSION='0.2.7';", "const ENGINE_VERSION='0.2.8';", 'engine version 0.2.8')

old_geometry = """    const span1=firstThird.reduce((s,p)=>s+p.span,0)/firstThird.length;
    const span2=lastThird.reduce((s,p)=>s+p.span,0)/lastThird.length;
    const narrowing=span2<span1*.78,expanding=span2>span1*1.22;
    const pred=full.slope*end.x+full.intercept,deviation=(end.y-pred)/h;"""

new_geometry = """    const span1=firstThird.reduce((s,p)=>s+p.span,0)/firstThird.length;
    const span2=lastThird.reduce((s,p)=>s+p.span,0)/lastThird.length;
    const narrowing=span2<span1*.78;

    // Un Triunghi Expanding real trebuie să aibă două limite care se depărtează:
    // maximele urcă (în coordonate imagine: panta high < 0), iar minimele coboară
    // (panta low > 0). Simplul fapt că lumânările devin mai înalte nu este suficient.
    const expandingBySpan=span2>span1*1.22;
    const triHighs=highs.slice(-3),triLows=lows.slice(-3);
    let expandingGeometry=false;
    if(triHighs.length>=2&&triLows.length>=2){
      const highReg=linReg(triHighs),lowReg=linReg(triLows);
      const highXSpan=triHighs[triHighs.length-1].x-triHighs[0].x;
      const lowXSpan=triLows[triLows.length-1].x-triLows[0].x;
      const divergence=(lowReg.slope-highReg.slope)*w/h;
      expandingGeometry=highXSpan>w*.16&&lowXSpan>w*.16&&highReg.slope<0&&lowReg.slope>0&&divergence>.035;
    }
    const expanding=expandingBySpan&&expandingGeometry;
    const pred=full.slope*end.x+full.intercept,deviation=(end.y-pred)/h;"""
engine = replace_once(engine, old_geometry, new_geometry, 'validare geometrică Triunghi Expanding')

engine = replace_once(
    engine,
    "      else if(expanding){atlas='Triunghi Expanding';idx=14;score=Math.max(score,.61+quality*.09+microStrength*.07);}",
    "      else if(expanding){atlas='Triunghi Expanding';idx=14;score=Math.max(score,.68+quality*.08+microStrength*.06+consensus*.05);}",
    'scor triunghi expanding validat',
)

old_direction = """    const direction=result.clear?result.dir:(result.wait?result.bias:'NONE');
    // O singură linie diagonală pentru direcția trendului: verde UP, roșu DOWN.
    if(direction==='BUY')addExtended(lows,'support','hi');
    else if(direction==='SELL')addExtended(highs,'resistance','lo');

    // În starea WAIT marcăm numai nivelul care trebuie confirmat."""

new_direction = """    const direction=result.clear?result.dir:(result.wait?result.bias:'NONE');
    // Excepție controlată: Triunghi Expanding valid = două limite divergente vizibile.
    // Pentru restul modelelor păstrăm o singură linie de trend, conform interfeței aprobate.
    if(result.clear&&result.idx===14&&highs.length>=2&&lows.length>=2){
      addExtended(highs,'resistance','lo');
      addExtended(lows,'support','hi');
    }else if(direction==='BUY')addExtended(lows,'support','hi');
    else if(direction==='SELL')addExtended(highs,'resistance','lo');

    // În starea WAIT marcăm numai nivelul care trebuie confirmat."""
engine = replace_once(engine, old_direction, new_direction, 'două linii numai pentru Triunghi Expanding valid')

ENGINE.write_text(engine, encoding='utf-8')
print('Patch v0.3.6 aplicat: Triunghi Expanding necesită două limite divergente; altfel fallback la structură reală.')
