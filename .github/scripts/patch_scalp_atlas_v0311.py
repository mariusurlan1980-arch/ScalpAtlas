from pathlib import Path

APP = Path('scalp-atlas-new/App.tsx')
ENGINE = Path('scalp-atlas-new/analysisEngine.ts')


def replace_once(text: str, old: str, new: str, label: str) -> str:
    if old not in text:
        raise SystemExit(f'{label}: fragmentul așteptat nu a fost găsit; build oprit pentru siguranță.')
    return text.replace(old, new, 1)


# v0.3.11 rulează DUPĂ patch-urile v0.3.2 ... v0.3.10.
# Corecție cerută după seria reală CAD/JPY M10:
# - motorul nu mai „aleargă” după un SELL deja foarte extins;
# - după o cădere puternică, dacă ultimele lumânări încetinesc / resping minimul /
#   încep să recupereze, SELL este suspendat și rezultatul devine WAIT;
# - aceeași protecție este aplicată simetric pentru BUY după o urcare prea extinsă;
# - semnalul revine numai după confirmarea unui nou minim/maxim sau după reevaluare.

app = APP.read_text(encoding='utf-8')
app = replace_once(
    app,
    "            <Text style={styles.versionBadge}>v0.3.10 TEST</Text>",
    "            <Text style={styles.versionBadge}>v0.3.11 TEST</Text>",
    'badge v0.3.11',
)
APP.write_text(app, encoding='utf-8')

engine = ENGINE.read_text(encoding='utf-8')
engine = replace_once(engine, "const ENGINE_VERSION='0.3.0';", "const ENGINE_VERSION='0.3.1';", 'engine version 0.3.1')

old_dir = """    dir=voteDiff>0?'BUY':'SELL';"""

new_dir = """    dir=voteDiff>0?'BUY':'SELL';

    // Protecție ANTI-CHASE / anti-epuizare.
    // Trendul mare poate rămâne SELL mult timp după o cădere abruptă, deși ultimele
    // lumânări au început deja să respingă minimul. Folosim un strat ultra-recent
    // pentru a detecta încetinirea sau revenirea și oprim semnalul până la confirmare.
    const ultraCount=Math.max(4,Math.min(7,Math.floor(pts.length*.12)));
    const ultraPts=pts.slice(-ultraCount);
    const ultra=linReg(ultraPts);
    const ultraNorm=-ultra.slope*w/h;

    const extremeCount=Math.max(8,Math.min(16,Math.floor(pts.length*.28)));
    const priorExtremePts=pts.slice(Math.max(0,pts.length-extremeCount),Math.max(0,pts.length-1));
    const recentTroughY=priorExtremePts.length
      ? Math.max(...priorExtremePts.map(p=>Number.isFinite(p.hi)?p.hi:p.y))
      : bodyClose;
    const recentPeakY=priorExtremePts.length
      ? Math.min(...priorExtremePts.map(p=>Number.isFinite(p.lo)?p.lo:p.y))
      : bodyClose;

    const bounceFromTrough=(recentTroughY-bodyClose)/h;
    const pullbackFromPeak=(bodyClose-recentPeakY)/h;
    const nearRecentTrough=bodyClose>=recentTroughY-h*.040;
    const nearRecentPeak=bodyClose<=recentPeakY+h*.040;

    const extendedSell=(recentNorm<-.075)||(norm<-.070&&recentNorm<-.045);
    const extendedBuy=(recentNorm>.075)||(norm>.070&&recentNorm>.045);

    // „Încetinește” înseamnă că stratul ultra-recent este mult mai puțin bearish/
    // bullish decât trendul recent sau chiar a început să se întoarcă.
    const sellDecelerating=(ultraNorm>recentNorm+.055)||(ultraNorm>-.012)||(lastMove>-.004);
    const buyDecelerating=(ultraNorm<recentNorm-.055)||(ultraNorm<.012)||(lastMove<.004);
    const sellRebound=(bounceFromTrough>.018)||(ultraNorm>.010)||(lastMove>.008);
    const buyPullback=(pullbackFromPeak>.018)||(ultraNorm<-.010)||(lastMove<-.008);

    // Un nou breakout este considerat „proaspăt” numai dacă și ultimele câteva
    // puncte continuă în aceeași direcție; astfel un suport spart mai devreme nu
    // ține SELL-ul activ după ce prețul a început deja să revină.
    const freshBreakDown=!!(bodyBreakDown&&ultraNorm<-.018&&lastMove<-.006);
    const freshBreakUp=!!(bodyBreakUp&&ultraNorm>.018&&lastMove>.006);

    if(dir==='SELL'&&extendedSell&&nearRecentTrough&&sellDecelerating&&
       (sellRebound||Math.abs(ultraNorm)<.020)&&!freshBreakDown){
      return {
        clear:false,state:'WAIT',wait:true,bias:'SELL',dir:'NONE',
        atlas:'Epuizare SELL – Confirmare minim recent',idx:0,
        score:Math.min(score,.66),
        waitLevelY:recentTroughY/h,
        reason:'Căderea este deja extinsă, iar ultimele lumânări încetinesc sau resping minimul. Nu urmări SELL-ul. Așteaptă un nou minim confirmat; dacă prețul recuperează, direcția trebuie reevaluată.'
      };
    }

    if(dir==='BUY'&&extendedBuy&&nearRecentPeak&&buyDecelerating&&
       (buyPullback||Math.abs(ultraNorm)<.020)&&!freshBreakUp){
      return {
        clear:false,state:'WAIT',wait:true,bias:'BUY',dir:'NONE',
        atlas:'Epuizare BUY – Confirmare maxim recent',idx:0,
        score:Math.min(score,.66),
        waitLevelY:recentPeakY/h,
        reason:'Urcarea este deja extinsă, iar ultimele lumânări încetinesc sau resping maximul. Nu urmări BUY-ul. Așteaptă un nou maxim confirmat; dacă prețul cedează, direcția trebuie reevaluată.'
      };
    }"""

engine = replace_once(engine, old_dir, new_dir, 'regulă anti-chasing după direcția votată')
ENGINE.write_text(engine, encoding='utf-8')

print('Patch v0.3.11 aplicat: anti-chasing după impuls extins; rebound/încetinire => AȘTEAPTĂ CONFIRMAREA.')
