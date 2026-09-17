from pathlib import Path

APP = Path('scalp-atlas-new/App.tsx')
ENGINE = Path('scalp-atlas-new/analysisEngine.ts')


def replace_once(text: str, old: str, new: str, label: str) -> str:
    if old not in text:
        raise SystemExit(f'{label}: fragmentul așteptat nu a fost găsit; build oprit pentru siguranță.')
    return text.replace(old, new, 1)


# v0.3.31 — MOMENTUM CONFIRMATION BOOST
# Test EUR/GBP M10: ZONĂ BUY a rămas 59% atât înainte, cât și după o accelerare bullish clară.
# Corecție:
# - scorul ZONĂ BUY/SELL devine dinamic și crește când impulsul recent + micro + recent trend
#   se aliniază cu direcția culoarului;
# - impuls aliniat moderat poate ridica zona spre ~63%;
# - impuls puternic aliniat ridică zona la minimum ~66% (maxim 69%);
# - dacă impulsul este puternic și încă nu există semnal confirmat, rezultatul mare devine
#   AȘTEAPTĂ CONFIRMAREA cu bias BUY/SELL, nu FĂRĂ SEMNAL CLAR;
# - BUY/SELL direct rămâne rezervat confirmării existente (breakout/swing/retest), deci nu
#   forțăm semnalul doar pentru că prețul accelerează.

app = APP.read_text(encoding='utf-8')
app = replace_once(
    app,
    "            <Text style={styles.versionBadge}>v0.3.30 TEST</Text>",
    "            <Text style={styles.versionBadge}>v0.3.31 TEST</Text>",
    'badge v0.3.31',
)
APP.write_text(app, encoding='utf-8')

engine = ENGINE.read_text(encoding='utf-8')
engine = replace_once(
    engine,
    "const ENGINE_VERSION='0.3.18';",
    "const ENGINE_VERSION='0.3.19';",
    'engine version 0.3.19',
)

engine = replace_once(
    engine,
    "    let lastMove=0,microNorm=0;",
    "    let lastMove=0,microNorm=0,recentNorm=0;",
    'adaugă recentNorm în opportunity',
)

engine = replace_once(
    engine,
    """      const micro=linReg(pts.slice(-Math.max(6,Math.floor(pts.length*.22))));
      microNorm=-micro.slope*curve.w/Math.max(1,curve.h);""",
    """      const micro=linReg(pts.slice(-Math.max(6,Math.floor(pts.length*.22))));
      const recent=linReg(pts.slice(-Math.max(9,Math.floor(pts.length*.42))));
      microNorm=-micro.slope*curve.w/Math.max(1,curve.h);
      recentNorm=-recent.slope*curve.w/Math.max(1,curve.h);""",
    'calculează recentNorm în opportunity',
)

needle = """    if(strongOpposite||classifiedOpposite){
      score=Math.min(score-8,60);
    }else if(oppositeImpulse){
      score=Math.min(score-5,62);
    }
    score=Math.round(clamp(score,50,69));

    const cautionOpposite=strongOpposite||classifiedOpposite||oppositeImpulse;
    const watch=cautionOpposite
      ? 'URMĂREȘTE CU ATENȚIE — impuls recent opus'
      : score>=64
        ? 'MERITĂ URMĂRITĂ — aproape de confirmare'
        : score>=59
          ? 'MERITĂ URMĂRITĂ'
          : score>=55
            ? 'URMĂREȘTE CU ATENȚIE'
            : 'PRIORITATE REDUSĂ — compară și altă pereche';

    const tf=timeframe||'timeframe-ul selectat';
    const reason=cautionOpposite
      ? 'Culoarul favorizează încă zona '+direction+', dar impulsul recent merge în sens opus. Așteaptă o respingere/reintrare clară în canal pe '+tf+' înainte de a considera zona mai puternică.'
      : score>=64
        ? 'Zona este favorabilă structural, dar așteaptă confirmarea unei lumânări '+tf+' înainte ca aplicația să transforme zona în semnal.'
        : score>=59
          ? 'Există o zonă favorabilă în culoar. Urmărește reacția următoarelor 1–2 lumânări '+tf+'; fără confirmare, nu este semnal.'
          : score>=55
            ? 'Structura este posibilă, dar reacția este încă slabă sau mixtă. Zona rămâne doar de observație.'
            : 'Culoarul există, dar poziția și reacția nu sunt suficient de convingătoare. Compară cu un grafic mai clar.';

    return {direction,score,watch,reason};"""

replacement = """    if(strongOpposite||classifiedOpposite){
      score=Math.min(score-8,60);
    }else if(oppositeImpulse){
      score=Math.min(score-5,62);
    }

    const channelAligned=(direction==='BUY'&&channel.type==='Canal Ascendent')||
      (direction==='SELL'&&channel.type==='Canal Descendent');
    const momentumAligned=direction==='BUY'
      ? (lastMove>.022&&microNorm>.038&&recentNorm>.018)
      : (lastMove<-.022&&microNorm<-.038&&recentNorm<-.018);
    const strongAligned=direction==='BUY'
      ? (lastMove>.034&&microNorm>.058&&recentNorm>.030)
      : (lastMove<-.034&&microNorm<-.058&&recentNorm<-.030);

    const cautionOpposite=strongOpposite||classifiedOpposite||oppositeImpulse;
    if(!cautionOpposite&&channelAligned){
      if(strongAligned) score=Math.max(score,66);
      else if(momentumAligned) score=Math.max(score,63);
    }
    score=Math.round(clamp(score,50,69));

    const watch=cautionOpposite
      ? 'URMĂREȘTE CU ATENȚIE — impuls recent opus'
      : strongAligned&&channelAligned
        ? 'MERITĂ URMĂRITĂ — impuls în confirmare'
        : momentumAligned&&channelAligned
          ? 'MERITĂ URMĂRITĂ — momentum favorabil'
          : score>=64
            ? 'MERITĂ URMĂRITĂ — aproape de confirmare'
            : score>=59
              ? 'MERITĂ URMĂRITĂ'
              : score>=55
                ? 'URMĂREȘTE CU ATENȚIE'
                : 'PRIORITATE REDUSĂ — compară și altă pereche';

    const tf=timeframe||'timeframe-ul selectat';
    const reason=cautionOpposite
      ? 'Culoarul favorizează încă zona '+direction+', dar impulsul recent merge în sens opus. Așteaptă o respingere/reintrare clară în canal pe '+tf+' înainte de a considera zona mai puternică.'
      : strongAligned&&channelAligned
        ? 'Culoarul și impulsul recent sunt aliniate puternic pentru '+direction+'. Zona este aproape de confirmare; așteaptă închiderea lumânării '+tf+' sau depășirea ultimului swing înainte de semnalul direct.'
        : momentumAligned&&channelAligned
          ? 'Impulsul recent s-a aliniat cu direcția culoarului. Zona '+direction+' a devenit mai interesantă, dar încă necesită confirmare pe '+tf+'.'
          : score>=64
            ? 'Zona este favorabilă structural, dar așteaptă confirmarea unei lumânări '+tf+' înainte ca aplicația să transforme zona în semnal.'
            : score>=59
              ? 'Există o zonă favorabilă în culoar. Urmărește reacția următoarelor 1–2 lumânări '+tf+'; fără confirmare, nu este semnal.'
              : score>=55
                ? 'Structura este posibilă, dar reacția este încă slabă sau mixtă. Zona rămâne doar de observație.'
                : 'Culoarul există, dar poziția și reacția nu sunt suficient de convingătoare. Compară cu un grafic mai clar.';

    return {direction,score,watch,reason,momentumAligned:momentumAligned&&channelAligned,strongAligned:strongAligned&&channelAligned};"""
engine = replace_once(engine, needle, replacement, 'boost momentum aliniat')

engine = replace_once(
    engine,
    "        const opportunity=channelOpportunity(candleChannel,r,timeframe,curve);\n        send({",
    """        const opportunity=channelOpportunity(candleChannel,r,timeframe,curve);
        if(opportunity&&opportunity.strongAligned&&!r.clear&&!r.wait){
          const momentumScore=Math.min(.69,Math.max(Number(r.score)||0,opportunity.score/100));
          r={
            ...r,
            clear:false,state:'WAIT',wait:true,bias:opportunity.direction,dir:'NONE',
            score:momentumScore,
            atlas:candleChannel.type+' – impuls '+opportunity.direction+' în confirmare',
            reason:'Culoarul și impulsul recent sunt aliniate pentru '+opportunity.direction+'. Așteaptă închiderea lumânării '+timeframe+' sau depășirea ultimului swing pentru confirmarea semnalului.'
          };
        }
        send({""",
    'promovează impulsul puternic la WAIT direcțional',
)

ENGINE.write_text(engine, encoding='utf-8')
print('Patch v0.3.31 aplicat: oportunitatea devine reactivă la momentum; impuls puternic aliniat => scor 66–69% și WAIT direcțional, fără a forța BUY/SELL direct.')
