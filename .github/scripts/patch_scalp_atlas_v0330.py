from pathlib import Path

APP = Path('scalp-atlas-new/App.tsx')
ENGINE = Path('scalp-atlas-new/analysisEngine.ts')


def replace_once(text: str, old: str, new: str, label: str) -> str:
    if old not in text:
        raise SystemExit(f'{label}: fragmentul așteptat nu a fost găsit; build oprit pentru siguranță.')
    return text.replace(old, new, 1)


# v0.3.30 — OPPOSITE IMPULSE GUARD + COMPACT ON-CHART LABEL
# - penalizează ZONĂ BUY/SELL când impulsul recent merge clar în sens opus;
# - dacă prețul rupe clar marginea canalului împotriva zonei, zona dispare;
# - păstrează perechea „de urmărit” doar când structura încă justifică observația;
# - micșorează eticheta ZONĂ BUY/SELL de pe grafic ca să acopere mai puține lumânări.

app = APP.read_text(encoding='utf-8')
app = replace_once(
    app,
    "            <Text style={styles.versionBadge}>v0.3.29 TEST</Text>",
    "            <Text style={styles.versionBadge}>v0.3.30 TEST</Text>",
    'badge v0.3.30',
)
app = replace_once(
    app,
    "  opportunityChartBadge: { position: 'absolute', zIndex: 6, minWidth: 106, borderWidth: 1, borderRadius: 8, paddingHorizontal: 7, paddingVertical: 4, alignItems: 'center', backgroundColor: 'rgba(7,11,18,0.86)' },",
    "  opportunityChartBadge: { position: 'absolute', zIndex: 6, minWidth: 92, borderWidth: 1, borderRadius: 7, paddingHorizontal: 5, paddingVertical: 3, alignItems: 'center', backgroundColor: 'rgba(7,11,18,0.84)' },",
    'badge oportunitate mai compact',
)
app = replace_once(
    app,
    "  opportunityChartText: { fontSize: 11, lineHeight: 14, fontWeight: '900', letterSpacing: 0.1 },",
    "  opportunityChartText: { fontSize: 10, lineHeight: 12, fontWeight: '900', letterSpacing: 0.05 },",
    'text oportunitate mai compact',
)
APP.write_text(app, encoding='utf-8')

engine = ENGINE.read_text(encoding='utf-8')
engine = replace_once(
    engine,
    "const ENGINE_VERSION='0.3.17';",
    "const ENGINE_VERSION='0.3.18';",
    'engine version 0.3.18',
)

engine = replace_once(
    engine,
    "  function channelOpportunity(channel,result,timeframe){",
    "  function channelOpportunity(channel,result,timeframe,curve){",
    'semnătură channelOpportunity cu curve',
)

needle = """    const structural=clamp(Number(result.score)||0,0,.75)/.75;
    let score=49+channel.quality*8+favor*7+structural*4;
    if(result.wait&&result.bias===direction)score+=3;
    else if(result.wait&&result.bias&&result.bias!==direction)score-=5;
    if(channel.type==='Canal Orizontal')score-=3;
    score=Math.round(clamp(score,50,69));

    const watch=score>=64
      ? 'MERITĂ URMĂRITĂ — aproape de confirmare'
      : score>=59
        ? 'MERITĂ URMĂRITĂ'
        : score>=55
          ? 'URMĂREȘTE CU ATENȚIE'
          : 'PRIORITATE REDUSĂ — compară și altă pereche';

    const tf=timeframe||'timeframe-ul selectat';
    const reason=score>=64
      ? 'Zona este favorabilă structural, dar așteaptă confirmarea unei lumânări '+tf+' înainte ca aplicația să transforme zona în semnal.'
      : score>=59
        ? 'Există o zonă favorabilă în culoar. Urmărește reacția următoarelor 1–2 lumânări '+tf+'; fără confirmare, nu este semnal.'
        : score>=55
          ? 'Structura este posibilă, dar reacția este încă slabă sau mixtă. Zona rămâne doar de observație.'
          : 'Culoarul există, dar poziția și reacția nu sunt suficient de convingătoare. Compară cu un grafic mai clar.';

    return {direction,score,watch,reason};"""

replacement = """    const structural=clamp(Number(result.score)||0,0,.75)/.75;
    let score=49+channel.quality*8+favor*7+structural*4;
    if(result.wait&&result.bias===direction)score+=3;
    else if(result.wait&&result.bias&&result.bias!==direction)score-=5;
    if(channel.type==='Canal Orizontal')score-=3;

    // v0.3.30: separăm „canal favorabil” de momentul concret al intrării.
    // O lumânare/mișcare recentă puternică împotriva zonei reduce scorul;
    // dacă prețul a ieșit clar prin marginea opusă a canalului, zona dispare complet.
    const pts=curve&&curve.pts?curve.pts:[];
    const anchor=curve&&curve.anchor?curve.anchor:null;
    let lastMove=0,microNorm=0;
    if(curve&&pts.length>=6){
      const end=pts[pts.length-1];
      const back=pts[Math.max(0,pts.length-4)];
      lastMove=(back.y-end.y)/Math.max(1,curve.h);
      const micro=linReg(pts.slice(-Math.max(6,Math.floor(pts.length*.22))));
      microNorm=-micro.slope*curve.w/Math.max(1,curve.h);
    }

    const anchorNorm=anchor&&curve?((anchor.lo+anchor.hi)/2)/Math.max(1,curve.h):null;
    const clearBreakAgainstZone=anchorNorm!=null&&(
      (direction==='SELL'&&anchorNorm<channel.upperYNorm-.012)||
      (direction==='BUY'&&anchorNorm>channel.lowerYNorm+.012)
    );
    if(clearBreakAgainstZone)return null;

    const recentAtlas=String(result.atlas||'').toLowerCase();
    const classifiedOpposite=recentAtlas.includes('impuls recent opus')||recentAtlas.includes('contra culoarului');
    const oppositeImpulse=direction==='SELL'
      ? (lastMove>.030||microNorm>.055)
      : (lastMove<-.030||microNorm<-.055);
    const strongOpposite=direction==='SELL'
      ? (lastMove>.050&&microNorm>.070)
      : (lastMove<-.050&&microNorm<-.070);

    if(strongOpposite||classifiedOpposite){
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
engine = replace_once(engine, needle, replacement, 'penalizare impuls opus opportunity zone')

engine = replace_once(
    engine,
    "        const opportunity=channelOpportunity(candleChannel,r,timeframe);",
    "        const opportunity=channelOpportunity(candleChannel,r,timeframe,curve);",
    'channelOpportunity primește curve',
)

ENGINE.write_text(engine, encoding='utf-8')
print('Patch v0.3.30 aplicat: impulsul recent opus reduce ZONĂ BUY/SELL; breakout contra zonei o elimină; eticheta de pe grafic este mai compactă.')
