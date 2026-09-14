from pathlib import Path

APP = Path('scalp-atlas-new/App.tsx')
ENGINE = Path('scalp-atlas-new/analysisEngine.ts')


def replace_once(text: str, old: str, new: str, label: str) -> str:
    if old not in text:
        raise SystemExit(f'{label}: fragmentul așteptat nu a fost găsit; build oprit pentru siguranță.')
    return text.replace(old, new, 1)


# v0.3.7 rulează DUPĂ patch-urile v0.3.2 ... v0.3.6.
# Corecție principală pentru testul real USD/JPY:
# - un fitil peste rezistență NU mai confirmă BUY breakout;
# - un fitil sub suport NU mai confirmă SELL breakout;
# - confirmarea folosește poziția corpului/închiderii estimate (end.y), nu extrema fitilului;
# - dacă fitilul străpunge nivelul dar corpul revine înapoi, rezultatul devine WAIT.

app = APP.read_text(encoding='utf-8')
app = replace_once(
    app,
    "            <Text style={styles.versionBadge}>v0.3.6 TEST</Text>",
    "            <Text style={styles.versionBadge}>v0.3.7 TEST</Text>",
    'badge v0.3.7',
)
APP.write_text(app, encoding='utf-8')

engine = ENGINE.read_text(encoding='utf-8')
engine = replace_once(engine, "const ENGINE_VERSION='0.2.8';", "const ENGINE_VERSION='0.2.9';", 'engine version 0.2.9')

old_breakout = """    const candleHigh=curve.anchor?curve.anchor.lo:end.y;
    const candleLow=curve.anchor?curve.anchor.hi:end.y;
    // Breakout valid only after price clears the structural level by a real margin
    // and both recent layers point in the same direction.
    const breakoutUp=refHigh
      ? candleHigh<refHigh.y-h*.012&&recentNorm>.035&&microNorm>.02
      : deviation<-.045&&recentNorm>.06&&microNorm>.04;
    const breakoutDown=refLow
      ? candleLow>refLow.y+h*.012&&recentNorm<-.035&&microNorm<-.02
      : deviation>.045&&recentNorm<-.06&&microNorm<-.04;"""

new_breakout = """    const candleHigh=curve.anchor?curve.anchor.lo:end.y;
    const candleLow=curve.anchor?curve.anchor.hi:end.y;
    const bodyClose=end.y; // proxy robust pentru corp/închidere din captura graficului

    // Breakout valid = CORP/închidere estimată dincolo de nivel, nu simplu fitil.
    // Coordonatele imaginii cresc în jos: deasupra rezistenței => y mai mic;
    // sub suport => y mai mare.
    const wickBreakUp=!!(refHigh&&candleHigh<refHigh.y-h*.004);
    const wickBreakDown=!!(refLow&&candleLow>refLow.y+h*.004);
    const bodyBreakUp=!!(refHigh&&bodyClose<refHigh.y-h*.012);
    const bodyBreakDown=!!(refLow&&bodyClose>refLow.y+h*.012);

    const breakoutUp=refHigh
      ? bodyBreakUp&&recentNorm>.035&&microNorm>.02
      : deviation<-.045&&recentNorm>.06&&microNorm>.04;
    const breakoutDown=refLow
      ? bodyBreakDown&&recentNorm<-.035&&microNorm<-.02
      : deviation>.045&&recentNorm<-.06&&microNorm<-.04;"""
engine = replace_once(engine, old_breakout, new_breakout, 'breakout pe corp/închidere, nu fitil')

old_wait = """    const nearResistance=refHigh&&candleHigh>=refHigh.y-h*.012&&candleHigh<=refHigh.y+h*.06;
    const nearSupport=refLow&&candleLow<=refLow.y+h*.012&&candleLow>=refLow.y-h*.06;
    if(dir==='BUY'&&nearResistance&&!breakoutUp){
      return {clear:false,state:'WAIT',wait:true,bias:'BUY',dir:'NONE',atlas:'Trend Scalp – Confirmare rezistență',idx:0,score:Math.min(score,.69),reason:'Prețul este sub rezistență. Așteaptă o închidere clară deasupra nivelului înainte de BUY'};
    }
    if(dir==='SELL'&&nearSupport&&!breakoutDown){
      return {clear:false,state:'WAIT',wait:true,bias:'SELL',dir:'NONE',atlas:'Trend Scalp – Confirmare suport',idx:0,score:Math.min(score,.69),reason:'Prețul este deasupra suportului. Așteaptă o închidere clară sub nivel înainte de SELL'};
    }"""

new_wait = """    const nearResistance=!!(refHigh&&bodyClose>=refHigh.y-h*.012&&bodyClose<=refHigh.y+h*.075);
    const nearSupport=!!(refLow&&bodyClose<=refLow.y+h*.012&&bodyClose>=refLow.y-h*.075);
    const rejectedResistance=!!(refHigh&&wickBreakUp&&!bodyBreakUp);
    const rejectedSupport=!!(refLow&&wickBreakDown&&!bodyBreakDown);

    if(dir==='BUY'&&(nearResistance||rejectedResistance)&&!breakoutUp){
      return {
        clear:false,state:'WAIT',wait:true,bias:'BUY',dir:'NONE',
        atlas:'Trend Scalp – Confirmare rezistență',idx:0,score:Math.min(score,.69),
        reason:rejectedResistance
          ? 'Fitilul a trecut peste rezistență, dar corpul/închiderea estimată a revenit sub nivel. Așteaptă confirmarea înainte de BUY'
          : 'Prețul este la rezistență. BUY necesită corp/închidere estimată clar deasupra nivelului'
      };
    }
    if(dir==='SELL'&&(nearSupport||rejectedSupport)&&!breakoutDown){
      return {
        clear:false,state:'WAIT',wait:true,bias:'SELL',dir:'NONE',
        atlas:'Trend Scalp – Confirmare suport',idx:0,score:Math.min(score,.69),
        reason:rejectedSupport
          ? 'Fitilul a trecut sub suport, dar corpul/închiderea estimată a revenit peste nivel. Așteaptă confirmarea înainte de SELL'
          : 'Prețul este la suport. SELL necesită corp/închidere estimată clar sub nivel'
      };
    }"""
engine = replace_once(engine, old_wait, new_wait, 'WAIT după fitil fără confirmare')

ENGINE.write_text(engine, encoding='utf-8')
print('Patch v0.3.7 aplicat: breakout confirmat pe corp/închidere estimată; fitil fără confirmare => AȘTEAPTĂ CONFIRMAREA.')
