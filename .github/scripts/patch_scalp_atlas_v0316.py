from pathlib import Path

APP = Path('scalp-atlas-new/App.tsx')
ENGINE = Path('scalp-atlas-new/analysisEngine.ts')


def replace_once(text: str, old: str, new: str, label: str) -> str:
    if old not in text:
        raise SystemExit(f'{label}: fragmentul așteptat nu a fost găsit; build oprit pentru siguranță.')
    return text.replace(old, new, 1)


# v0.3.16 rulează DUPĂ patch-urile v0.3.2 ... v0.3.15.
# Corecție după testul AUD/USD OTC M10:
# - un rebound BUY într-un trend principal descendent nu devine semnal direct doar
#   pentru că revenirea locală are scor >72%; simetric pentru SELL contra trendului ascendent;
# - o intrare contra trendului principal cere o reversare STRUCTURALĂ confirmată
#   (corp/închidere peste/sub nivelul structural) și minimum două confirmări locale;
# - altfel rezultatul este AȘTEAPTĂ CONFIRMAREA.

app = APP.read_text(encoding='utf-8')
app = replace_once(
    app,
    "            <Text style={styles.versionBadge}>v0.3.15 TEST</Text>",
    "            <Text style={styles.versionBadge}>v0.3.16 TEST</Text>",
    'badge v0.3.16',
)
APP.write_text(app, encoding='utf-8')

engine = ENGINE.read_text(encoding='utf-8')
engine = replace_once(
    engine,
    "const ENGINE_VERSION='0.3.3';",
    "const ENGINE_VERSION='0.3.4';",
    'engine version 0.3.4',
)

needle = """    if(lastZoneOpposesSignal){
      return {
        clear:false,state:'WAIT',wait:true,bias:dir,dir:'NONE',
        atlas:dir==='BUY'?'Canal Ascendent – recul imediat':'Canal Descendent – rebound imediat',
        idx:0,score:Math.min(score,.71),
        reason:dir==='BUY'
          ? 'Ultima zonă de preț cade puternic împotriva BUY. Așteaptă stabilizare și reluarea urcării înainte de intrare.'
          : 'Ultima zonă de preț urcă puternic împotriva SELL. Așteaptă stabilizare și reluarea scăderii înainte de intrare.'
      };
    }

    if(proposedOppositions>=2&&proposedConfirmations<2&&!freshBreakForDir){"""

replacement = """    if(lastZoneOpposesSignal){
      return {
        clear:false,state:'WAIT',wait:true,bias:dir,dir:'NONE',
        atlas:dir==='BUY'?'Canal Ascendent – recul imediat':'Canal Descendent – rebound imediat',
        idx:0,score:Math.min(score,.71),
        reason:dir==='BUY'
          ? 'Ultima zonă de preț cade puternic împotriva BUY. Așteaptă stabilizare și reluarea urcării înainte de intrare.'
          : 'Ultima zonă de preț urcă puternic împotriva SELL. Așteaptă stabilizare și reluarea scăderii înainte de intrare.'
      };
    }

    // v0.3.16 — COUNTERTREND REVERSAL GUARD.
    // O revenire locală nu este suficientă pentru a inversa un trend principal clar.
    // BUY contra unui trend SELL (sau SELL contra unui trend BUY) are voie să devină
    // semnal direct numai după o spargere structurală confirmată pe corp/închidere
    // și cel puțin două confirmări din recent/micro/imediat.
    const counterTrendProposal=primaryDir!=='NONE'&&dir!==primaryDir&&Math.abs(norm)>=.055;
    const structuralReversalForDir=dir==='BUY'?confirmedStructuralBreakUp:confirmedStructuralBreakDown;
    if(counterTrendProposal&&(!structuralReversalForDir||proposedConfirmations<2)){
      return {
        clear:false,state:'WAIT',wait:true,bias:primaryDir,dir:'NONE',
        atlas:primaryDir==='SELL'
          ? 'Canal Descendent – rebound contra trendului'
          : 'Canal Ascendent – recul contra trendului',
        idx:0,score:Math.min(score,.71),
        reason:primaryDir==='SELL'
          ? 'Trendul principal rămâne descendent. Revenirea BUY nu a rupt și confirmat încă structura descendentă. Așteaptă o închidere clară peste ultimul maxim structural înainte de BUY.'
          : 'Trendul principal rămâne ascendent. Reculul SELL nu a rupt și confirmat încă structura ascendentă. Așteaptă o închidere clară sub ultimul minim structural înainte de SELL.'
      };
    }

    if(proposedOppositions>=2&&proposedConfirmations<2&&!freshBreakForDir){"""

engine = replace_once(engine, needle, replacement, 'gardă reversare contra trendului principal')
ENGINE.write_text(engine, encoding='utf-8')

print('Patch v0.3.16 aplicat: rebound/recul contra trendului principal => WAIT până la reversare structurală confirmată.')
