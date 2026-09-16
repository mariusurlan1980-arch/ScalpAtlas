from pathlib import Path

APP = Path('scalp-atlas-new/App.tsx')
ENGINE = Path('scalp-atlas-new/analysisEngine.ts')


def replace_once(text: str, old: str, new: str, label: str) -> str:
    if old not in text:
        raise SystemExit(f'{label}: fragmentul așteptat nu a fost găsit; build oprit pentru siguranță.')
    return text.replace(old, new, 1)


# v0.3.24 rulează DUPĂ v0.3.23.
# Corecție după testul CHF/JPY OTC M10 (Breakout Support 93%):
# - un breakout deja extins, urmat de rebound/pullback, nu mai emite imediat SELL/BUY;
# - aplicația cere retest + respingere sau o continuare nouă peste/sub extremă;
# - scorurile de breakout fără retest confirmat sunt plafonate sub 90%;
# - săgeata semnalului confirmat este adusă și mai aproape de ultima lumânare.

app = APP.read_text(encoding='utf-8')
app = replace_once(
    app,
    "            <Text style={styles.versionBadge}>v0.3.23 TEST</Text>",
    "            <Text style={styles.versionBadge}>v0.3.24 TEST</Text>",
    'badge v0.3.24',
)

# Apropie săgeata de ultima lumânare fără să o suprapună peste corp.
app = replace_once(app, "    const frontBandX = anchorX + 22;", "    const frontBandX = anchorX + 12;", 'frontBandX compact v0.3.24')
app = replace_once(app, "    const cappedStructuralFront = Math.min(structuralFrontX, anchorX + 28);", "    const cappedStructuralFront = Math.min(structuralFrontX, anchorX + 18);", 'structural front compact v0.3.24')
app = replace_once(
    app,
    "    const frontX = Math.max(anchorX + 22, Math.min(anchorX + 30, cappedStructuralFront + 4));",
    "    const frontX = Math.max(anchorX + 12, Math.min(anchorX + 20, cappedStructuralFront + 3));",
    'frontX compact v0.3.24',
)
app = replace_once(app, "    const xOffsets = [0, 6, 12, 18];", "    const xOffsets = [0, 4, 8, 12];", 'offseturi săgeată v0.3.24')
APP.write_text(app, encoding='utf-8')

engine = ENGINE.read_text(encoding='utf-8')
engine = replace_once(
    engine,
    "const ENGINE_VERSION='0.3.11';",
    "const ENGINE_VERSION='0.3.12';",
    'engine version 0.3.12',
)

needle = """    const clear=score>=.72&&(consensus>=.32||strongLocalAligned);"""

guard = """    // v0.3.24 — BREAKOUT RETEST / LATE-ENTRY GUARD.
    // Un breakout poate fi real, dar intrarea devine slabă dacă prețul s-a extins deja
    // și apoi revine spre nivel. Nu confundăm validitatea structurii cu momentul intrării.
    const breakoutPattern=String(atlas||'').toLowerCase().includes('breakout');
    if(breakoutPattern){
      const tailCount=Math.max(7,Math.min(12,Math.floor(pts.length*.26)));
      const tail=pts.slice(-tailCount);
      const previousTail=tail.length>1?tail.slice(0,-1):tail;
      const priorLowExtreme=previousTail.length?Math.max(...previousTail.map(p=>p.hi)):candleLow;
      const priorHighExtreme=previousTail.length?Math.min(...previousTail.map(p=>p.lo)):candleHigh;

      const sellLevel=refLow?refLow.y:null;
      const buyLevel=refHigh?refHigh.y:null;
      const sellWasExtended=Number.isFinite(sellLevel)&&priorLowExtreme>sellLevel+h*.018;
      const buyWasExtended=Number.isFinite(buyLevel)&&priorHighExtreme<buyLevel-h*.018;
      const sellPulledBack=sellWasExtended&&candleLow<priorLowExtreme-h*.018;
      const buyPulledBack=buyWasExtended&&candleHigh>priorHighExtreme+h*.018;

      // Retest: prețul revine aproape de nivelul spart, apoi impulsul local se întoarce
      // din nou în direcția breakout-ului. Acest caz poate păstra semnalul direct.
      const sellNearRetest=Number.isFinite(sellLevel)&&Math.abs(candleHigh-sellLevel)<=h*.025;
      const buyNearRetest=Number.isFinite(buyLevel)&&Math.abs(candleLow-buyLevel)<=h*.025;
      const sellRetestRejected=sellNearRetest&&recentNorm<-.025&&microNorm<-.018&&lastMove<-.010;
      const buyRetestRejected=buyNearRetest&&recentNorm>.025&&microNorm>.018&&lastMove>.010;

      const lateSell=dir==='SELL'&&breakoutDown&&sellPulledBack&&!sellRetestRejected;
      const lateBuy=dir==='BUY'&&breakoutUp&&buyPulledBack&&!buyRetestRejected;

      if(lateSell||lateBuy){
        const waitDir=lateSell?'SELL':'BUY';
        const level=lateSell?sellLevel:buyLevel;
        return {
          clear:false,state:'WAIT',wait:true,bias:waitDir,dir:'NONE',
          atlas:lateSell?'Breakout Support – așteaptă retest':'Breakout Rezistență – așteaptă retest',
          idx,score:Math.min(score,.78),
          confirmationLevelY:Number.isFinite(level)?level/h:undefined,
          reason:lateSell
            ? 'Breakout-ul SELL este deja extins și prețul a început un rebound. Așteaptă retestarea suportului spart și respingerea în jos sau un nou minim confirmat înainte de intrare.'
            : 'Breakout-ul BUY este deja extins și prețul a început un pullback. Așteaptă retestarea rezistenței sparte și respingerea în sus sau un nou maxim confirmat înainte de intrare.'
        };
      }

      // Fără retest confirmat, un breakout poate rămâne semnal, dar nu primește 90%+.
      // Peste 90% este rezervat pentru breakout + retest/respingere confirmată.
      if(!(sellRetestRejected||buyRetestRejected)) score=Math.min(score,.89);
    }

    const clear=score>=.72&&(consensus>=.32||strongLocalAligned);"""

engine = replace_once(engine, needle, guard, 'gardă breakout/retest v0.3.24')
ENGINE.write_text(engine, encoding='utf-8')

print('Patch v0.3.24 aplicat: breakout extins + rebound/pullback => WAIT pentru retest; breakout fără retest plafonat sub 90%; săgeată mai aproape.')
