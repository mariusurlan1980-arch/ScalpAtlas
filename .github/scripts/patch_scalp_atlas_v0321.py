from pathlib import Path

APP = Path('scalp-atlas-new/App.tsx')
ENGINE = Path('scalp-atlas-new/analysisEngine.ts')


def replace_once(text: str, old: str, new: str, label: str) -> str:
    if old not in text:
        raise SystemExit(f'{label}: fragmentul așteptat nu a fost găsit; build oprit pentru siguranță.')
    return text.replace(old, new, 1)


# v0.3.21 rulează DUPĂ v0.3.20.
# Corecție după testul GBP/JPY OTC M10:
# - decizia FĂRĂ SEMNAL CLAR rămâne neschimbată;
# - eticheta „Canal Orizontal” nu mai este folosită automat pentru orice conflict;
# - distingem consolidarea după rebound / respingere de un canal cu adevărat lateral;
# - nu forțăm BUY/SELL, schimbăm doar descrierea structurii fără semnal.

app = APP.read_text(encoding='utf-8')
app = replace_once(
    app,
    "            <Text style={styles.versionBadge}>v0.3.20 TEST</Text>",
    "            <Text style={styles.versionBadge}>v0.3.21 TEST</Text>",
    'badge v0.3.21',
)
APP.write_text(app, encoding='utf-8')

engine = ENGINE.read_text(encoding='utf-8')
engine = replace_once(
    engine,
    "const ENGINE_VERSION='0.3.8';",
    "const ENGINE_VERSION='0.3.9';",
    'engine version 0.3.9',
)

old_block = """    if(voteTotal<2.6||consensus<.24||(Math.abs(recentNorm)<.03&&Math.abs(microNorm)<.03)){
      atlas=narrowing?'Compresie (Squeeze)':'Canal Orizontal';
      idx=narrowing?20:19;
      return {clear:false,dir:'NONE',atlas,idx,score:Math.min(.68,score),reason:'Direcția nu este suficient de clară'};
    }"""

new_block = """    if(voteTotal<2.6||consensus<.24||(Math.abs(recentNorm)<.03&&Math.abs(microNorm)<.03)){
      // v0.3.21 — NO-SIGNAL STRUCTURE LABELS.
      // „Fără semnal clar” rămâne o decizie prudentă, dar descrierea trebuie să spună
      // dacă avem lateralizare autentică sau o consolidare după o mișcare/reversare recentă.
      const dirOf=(v,t)=>v>t?'BUY':v<-t?'SELL':'NONE';
      const fullDirLabel=dirOf(norm,.045);
      const recentDirLabel=dirOf(recentNorm,.035);
      const microDirLabel=dirOf(microNorm,.025);
      const lastPivotLabel=pv.length?pv[pv.length-1]:null;
      const bounceAfterLow=!!lastPivotLabel&&lastPivotLabel.type==='L'&&((lastPivotLabel.y-end.y)/h)>.025;
      const dropAfterHigh=!!lastPivotLabel&&lastPivotLabel.type==='H'&&((end.y-lastPivotLabel.y)/h)>.025;
      const regimeConflict=(fullDirLabel!=='NONE'&&recentDirLabel!=='NONE'&&fullDirLabel!==recentDirLabel)||
        (recentDirLabel!=='NONE'&&microDirLabel!=='NONE'&&recentDirLabel!==microDirLabel);

      let reason='Direcția nu este suficient de clară';
      if(narrowing){
        atlas='Compresie (Squeeze)';idx=20;
        reason='Prețul se comprimă, dar nu există încă o spargere confirmată.';
      }else if(bounceAfterLow){
        atlas='Structură mixtă – consolidare după rebound';idx=50;
        reason='A existat un rebound după minim, dar ultimele lumânări nu confirmă încă o continuare BUY sau o reluare SELL.';
      }else if(dropAfterHigh){
        atlas='Structură mixtă – consolidare după respingere';idx=50;
        reason='A existat o respingere după maxim, dar ultimele lumânări nu confirmă încă o continuare SELL sau o reluare BUY.';
      }else if(regimeConflict){
        atlas='Structură mixtă – consolidare';idx=50;
        reason='Trendul mai vechi și mișcarea recentă se contrazic; nu există încă direcție confirmată.';
      }else{
        atlas='Canal Orizontal';idx=19;
        reason='Prețul este lateral, fără avantaj direcțional suficient pentru BUY sau SELL.';
      }
      return {clear:false,dir:'NONE',atlas,idx,score:Math.min(.68,score),reason};
    }"""

engine = replace_once(engine, old_block, new_block, 'etichete structură fără semnal v0.3.21')
ENGINE.write_text(engine, encoding='utf-8')

print('Patch v0.3.21 aplicat: FĂRĂ SEMNAL CLAR păstrează decizia, dar diferențiază canal lateral, compresie, rebound și respingere.')
