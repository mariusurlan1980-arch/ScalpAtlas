from pathlib import Path

APP = Path('scalp-atlas-new/App.tsx')
ENGINE = Path('scalp-atlas-new/analysisEngine.ts')


def replace_once(text: str, old: str, new: str, label: str) -> str:
    if old not in text:
        raise SystemExit(f'{label}: fragmentul așteptat nu a fost găsit; build oprit pentru siguranță.')
    return text.replace(old, new, 1)


# v0.3.14 rulează DUPĂ patch-urile v0.3.2 ... v0.3.13.
# Corecție cerută după testul AUD/CHF OTC M10:
# - un canal descendent nu mai poate forța SELL când ultimele lumânări recuperează în sus;
# - simetric, un canal ascendent nu mai poate forța BUY când impulsul imediat este în jos;
# - trend principal + impuls recent în conflict => WAIT / AȘTEAPTĂ CONFIRMAREA;
# - scorurile 63–71% devin WAIT, nu BUY/SELL;
# - BUY/SELL valid cere minimum 72% și consens local mai bun.

app = APP.read_text(encoding='utf-8')
app = replace_once(
    app,
    "            <Text style={styles.versionBadge}>v0.3.13 TEST</Text>",
    "            <Text style={styles.versionBadge}>v0.3.14 TEST</Text>",
    'badge v0.3.14',
)
APP.write_text(app, encoding='utf-8')

engine = ENGINE.read_text(encoding='utf-8')
engine = replace_once(
    engine,
    "const ENGINE_VERSION='0.3.1';",
    "const ENGINE_VERSION='0.3.2';",
    'engine version 0.3.2',
)

old_clear = """    const clear=score>=.63&&consensus>=.28;"""

new_clear = """    // v0.3.14 — CONFIRMATION FILTER.
    // Nu folosim numai trendul mare. Ultimele straturi trebuie să confirme direcția
    // înainte ca aplicația să emită BUY/SELL. Astfel un canal descendent cu rebound
    // activ nu mai produce SELL doar pentru că partea veche a graficului coboară.
    const localDirection=(value,threshold)=>value>threshold?'BUY':value<-threshold?'SELL':'NONE';
    const primaryDir=localDirection(norm,.045);
    const recentDirNow=localDirection(recentNorm,.035);
    const microDirNow=localDirection(microNorm,.025);
    const immediateDirNow=localDirection(lastMove,.015);

    const proposedConfirmations=[recentDirNow,microDirNow,immediateDirNow].filter(d=>d===dir).length;
    const proposedOppositions=[recentDirNow,microDirNow,immediateDirNow].filter(d=>d!=='NONE'&&d!==dir).length;
    const recentAgreement=recentDirNow!=='NONE'&&recentDirNow===microDirNow;
    const reversalBreak=recentDirNow==='BUY'?breakoutUp:recentDirNow==='SELL'?breakoutDown:false;

    // Conflict clar între trendul principal și impulsul recent: nu anticipăm reversarea
    // și nici nu urmărim trendul vechi. Așteptăm confirmarea următoarei mișcări.
    if(primaryDir!=='NONE'&&recentAgreement&&recentDirNow!==primaryDir&&!reversalBreak){
      return {
        clear:false,state:'WAIT',wait:true,bias:primaryDir,dir:'NONE',
        atlas:primaryDir==='SELL'?'Canal Descendent – impuls recent opus':'Canal Ascendent – impuls recent opus',
        idx:0,score:Math.min(score,.71),
        reason:'Trendul principal și ultimele lumânări sunt în conflict. Așteaptă confirmarea: respingere și reluarea trendului sau spargere clară în sensul impulsului recent.'
      };
    }

    // Chiar dacă votul brut a ales BUY/SELL, două din cele trei straturi locale în
    // sens opus suspendă intrarea până când direcția propusă este reconfirmată.
    const freshBreakForDir=dir==='BUY'?breakoutUp:breakoutDown;
    if(proposedOppositions>=2&&proposedConfirmations<2&&!freshBreakForDir){
      return {
        clear:false,state:'WAIT',wait:true,bias:dir,dir:'NONE',
        atlas:atlas+' – Confirmare necesară',idx,
        score:Math.min(score,.71),
        reason:'Impulsul ultimelor lumânări nu confirmă încă direcția propusă. Așteaptă o respingere/închidere de confirmare înainte de intrare.'
      };
    }

    // 69% nu mai este suficient pentru o intrare directă. Zona 63–71% este WAIT.
    if(score>=.63&&score<.72&&consensus>=.28){
      return {
        clear:false,state:'WAIT',wait:true,bias:dir,dir:'NONE',
        atlas:atlas+' – Confirmare necesară',idx,
        score:Math.min(score,.71),
        reason:'Scor moderat, fără confirmare suficientă pentru BUY/SELL. Așteaptă confirmarea următoarelor lumânări.'
      };
    }

    const clear=score>=.72&&consensus>=.32;"""

engine = replace_once(engine, old_clear, new_clear, 'filtru confirmare înainte de BUY/SELL')
ENGINE.write_text(engine, encoding='utf-8')

print('Patch v0.3.14 aplicat: conflict trend/impuls => WAIT; 63–71% => WAIT; BUY/SELL de la 72% + consens local.')
