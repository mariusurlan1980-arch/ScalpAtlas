from pathlib import Path

APP = Path('scalp-atlas-new/App.tsx')
ENGINE = Path('scalp-atlas-new/analysisEngine.ts')


def replace_once(text: str, old: str, new: str, label: str) -> str:
    if old not in text:
        raise SystemExit(f'{label}: fragmentul așteptat nu a fost găsit; build oprit pentru siguranță.')
    return text.replace(old, new, 1)


# v0.3.48 — GUARANTEED WAIT CONFIRMATION LINE
# Feedback AED/CNY OTC M15:
# - cardul WAIT spunea "închidere peste/sub linia galbenă";
# - pe unele capturi, linia galbenă nu era vizibilă deoarece nivelul structural explicit
#   lipsea iar detectorul de pivoti nu găsea un reper suficient de recent.
#
# Corecție:
# - în orice stare WAIT, dacă trendLinesFor() nu a produs deja o linie 'confirmation',
#   adăugăm una de rezervă;
# - BUY -> marginea superioară a canalului, SELL -> marginea inferioară;
# - dacă biasul este neutru, folosim direcția sugerată de modelul breakout;
# - dacă nici canalul nu este valid, folosim confirmationLevelY sau ancora curentă.
# Logica BUY/SELL/WAIT și cele 70 de modele rămân neschimbate.

app = APP.read_text(encoding='utf-8')
app = replace_once(
    app,
    "            <Text style={styles.versionBadge}>v0.3.47 TEST</Text>",
    "            <Text style={styles.versionBadge}>v0.3.48 TEST</Text>",
    'badge v0.3.48',
)
APP.write_text(app, encoding='utf-8')

engine = ENGINE.read_text(encoding='utf-8')
engine = replace_once(
    engine,
    "const ENGINE_VERSION='0.3.28';",
    "const ENGINE_VERSION='0.3.29';",
    'engine version 0.3.29',
)

marker = "  function run(dataUrl,timeframe){"
if marker not in engine:
    raise SystemExit('run() nu a fost găsită; build oprit pentru siguranță.')

helper = r'''  function trendLinesWithWaitFallback(curve,result){
    const lines=trendLinesFor(curve,result)||[];
    if(!result||!result.wait||!curve||!curve.anchor)return lines;
    if(lines.some(line=>line&&line.kind==='confirmation'))return lines;

    const channel=detectCandleChannel(curve);
    const atlas=String(result.atlas||'').toLowerCase();
    let direction=result.bias||null;

    // WAIT neutru: deducem doar nivelul de confirmare din model, nu emitem semnal.
    if(!direction){
      if(atlas.includes('breakout ascendent')||atlas.includes('margine superioară')||atlas.includes('rebound contra canalului')) direction='BUY';
      else if(atlas.includes('breakout descendent')||atlas.includes('margine inferioară')||atlas.includes('recul contra canalului')) direction='SELL';
    }

    let yNorm=Number.isFinite(result.confirmationLevelY)?result.confirmationLevelY:null;
    if(yNorm==null&&channel.valid){
      if(direction==='BUY')yNorm=channel.upperYNorm;
      else if(direction==='SELL')yNorm=channel.lowerYNorm;
    }
    if(yNorm==null){
      const a=curve.anchor;
      yNorm=(Number.isFinite(a.y)?a.y:((a.lo+a.hi)/2))/Math.max(1,curve.h);
    }

    yNorm=Math.max(.03,Math.min(.97,yNorm));
    const ax=curve.anchor.x/Math.max(1,curve.w);
    const x1=Math.max(.08,ax-.24);
    const x2=Math.min(.95,ax+.14);

    return [...lines,{kind:'confirmation',x1,y1:yNorm,x2,y2:yNorm}];
  }

'''
engine = engine.replace(marker, helper + marker, 1)

engine = replace_once(
    engine,
    "            trendLines:trendLinesFor(curve,r),",
    "            trendLines:trendLinesWithWaitFallback(curve,r),",
    'fallback linie galbenă în payload',
)

ENGINE.write_text(engine, encoding='utf-8')
print('Patch v0.3.48 aplicat: orice WAIT are obligatoriu o linie galbenă de confirmare vizibilă.')
