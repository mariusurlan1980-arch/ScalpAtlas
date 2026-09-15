from pathlib import Path

APP = Path('scalp-atlas-new/App.tsx')
ENGINE = Path('scalp-atlas-new/analysisEngine.ts')


def replace_once(text: str, old: str, new: str, label: str) -> str:
    if old not in text:
        raise SystemExit(f'{label}: fragmentul așteptat nu a fost găsit; build oprit pentru siguranță.')
    return text.replace(old, new, 1)


# v0.3.15 rulează DUPĂ patch-urile v0.3.2 ... v0.3.14.
# Corecție după testul CHF/JPY OTC M10:
# - un Canal Ascendent nu mai emite BUY dacă ultima zonă de preț cade brusc;
# - simetric, un Canal Descendent nu mai emite SELL dacă ultima zonă urcă brusc;
# - folosim ultimele 1–3 segmente și o regresie foarte scurtă („snap momentum”);
# - o contramișcare imediată puternică => AȘTEAPTĂ CONFIRMAREA, chiar dacă scorul brut este >72%.

app = APP.read_text(encoding='utf-8')
app = replace_once(
    app,
    "            <Text style={styles.versionBadge}>v0.3.14 TEST</Text>",
    "            <Text style={styles.versionBadge}>v0.3.15 TEST</Text>",
    'badge v0.3.15',
)
APP.write_text(app, encoding='utf-8')

engine = ENGINE.read_text(encoding='utf-8')
engine = replace_once(
    engine,
    "const ENGINE_VERSION='0.3.2';",
    "const ENGINE_VERSION='0.3.3';",
    'engine version 0.3.3',
)

engine = replace_once(
    engine,
    "    const immediateDirNow=localDirection(lastMove,.015);",
    """    const immediateDirNow=localDirection(lastMove,.015);

    // v0.3.15 — LAST-CANDLE / SNAP MOMENTUM GUARD.
    // Filtrul v0.3.14 privea trendul recent și micro, dar o singură lumânare mare
    // contra trendului putea fi diluată de cele 6–9 puncte folosite de micro-regresie.
    // Aici măsurăm separat chiar capătul curbei: ultimul pas, ultimele două-trei
    // segmente și o regresie ultra-scurtă. O contramișcare puternică suspendă
    // semnalul până la confirmare, fără a declara automat reversarea.
    const oneStepMove=pts.length>=2?(pts[pts.length-2].y-end.y)/h:0;
    const twoStepMove=pts.length>=3?(pts[pts.length-3].y-end.y)/h:oneStepMove;
    const snapCount=Math.max(3,Math.min(5,pts.length));
    const snap=linReg(pts.slice(-snapCount));
    const snapNorm=-snap.slope*w/h;
    const sharpBearishSnap=oneStepMove<-.012&&((snapNorm<-.022)||(twoStepMove<-.020));
    const sharpBullishSnap=oneStepMove>.012&&((snapNorm>.022)||(twoStepMove>.020));""",
    'măsurare snap momentum',
)

engine = replace_once(
    engine,
    """    const freshBreakForDir=dir==='BUY'?breakoutUp:breakoutDown;
    if(proposedOppositions>=2&&proposedConfirmations<2&&!freshBreakForDir){""",
    """    const freshBreakForDir=dir==='BUY'?breakoutUp:breakoutDown;

    // Dacă ultima zonă accelerează clar CONTRA semnalului propus, nu intrăm.
    // Exemplu real CHF/JPY OTC M10: canalul era ascendent, dar ultima cădere mare
    // făcea BUY 79% prea agresiv. Acum acel caz devine WAIT.
    const lastZoneOpposesSignal=(dir==='BUY'&&sharpBearishSnap)||(dir==='SELL'&&sharpBullishSnap);
    if(lastZoneOpposesSignal){
      return {
        clear:false,state:'WAIT',wait:true,bias:dir,dir:'NONE',
        atlas:dir==='BUY'?'Canal Ascendent – recul imediat':'Canal Descendent – rebound imediat',
        idx:0,score:Math.min(score,.71),
        reason:dir==='BUY'
          ? 'Ultima zonă de preț cade puternic împotriva BUY. Așteaptă stabilizare și reluarea urcării înainte de intrare.'
          : 'Ultima zonă de preț urcă puternic împotriva SELL. Așteaptă stabilizare și reluarea scăderii înainte de intrare.'
      };
    }

    if(proposedOppositions>=2&&proposedConfirmations<2&&!freshBreakForDir){""",
    'blocare semnal contra ultimei zone',
)

ENGINE.write_text(engine, encoding='utf-8')
print('Patch v0.3.15 aplicat: contramișcare puternică în ultima zonă => AȘTEAPTĂ CONFIRMAREA, inclusiv la scor >72%.')
