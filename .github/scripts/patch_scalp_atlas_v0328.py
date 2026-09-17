from pathlib import Path

APP = Path('scalp-atlas-new/App.tsx')
ENGINE = Path('scalp-atlas-new/analysisEngine.ts')


def replace_once(text: str, old: str, new: str, label: str) -> str:
    if old not in text:
        raise SystemExit(f'{label}: fragmentul așteptat nu a fost găsit; build oprit pentru siguranță.')
    return text.replace(old, new, 1)


# v0.3.28 — SMART OPPORTUNITY ZONE
# - pentru grafice fără BUY/SELL confirmat, dar cu un canal clar și preț într-o zonă favorabilă,
#   afișează ZONĂ BUY / ZONĂ SELL + un scor structural 50–69%;
# - scorul NU este probabilitate de profit și nu transformă zona într-un semnal;
# - arată dacă perechea merită urmărită sau are prioritate redusă.

app = APP.read_text(encoding='utf-8')
app = replace_once(
    app,
    "            <Text style={styles.versionBadge}>v0.3.27 TEST</Text>",
    "            <Text style={styles.versionBadge}>v0.3.28 TEST</Text>",
    'badge v0.3.28',
)

app = replace_once(
    app,
    "  channelQuality?: number | null;\n  trendLines?: Array<{",
    "  channelQuality?: number | null;\n  opportunityDirection?: 'BUY' | 'SELL' | null;\n  opportunityScore?: number | null;\n  opportunityWatch?: string | null;\n  opportunityReason?: string | null;\n  trendLines?: Array<{",
    'tipuri Smart Opportunity Zone',
)

channel_block = """              {analysis.channelType && analysis.channelPosition && (
                <Text style={styles.channelInfo}>
                  Culoarul lumânărilor: {analysis.channelType} • {analysis.channelPosition}{analysis.channelQuality ? ` • ${analysis.channelQuality}%` : ''}
                </Text>
              )}"""
opportunity_block = """              {analysis.channelType && analysis.channelPosition && (
                <Text style={styles.channelInfo}>
                  Culoarul lumânărilor: {analysis.channelType} • {analysis.channelPosition}{analysis.channelQuality ? ` • ${analysis.channelQuality}%` : ''}
                </Text>
              )}
              {analysis.opportunityDirection && analysis.opportunityScore != null && (
                <View style={styles.opportunityBox}>
                  <Text style={[styles.opportunityTitle, analysis.opportunityDirection === 'BUY' ? styles.buy : styles.sell]}>
                    ZONĂ {analysis.opportunityDirection} • {analysis.opportunityScore}%
                  </Text>
                  {!!analysis.opportunityWatch && (
                    <Text style={styles.opportunityWatch}>Pereche: {analysis.opportunityWatch}</Text>
                  )}
                  {!!analysis.opportunityReason && (
                    <Text style={styles.opportunityReason}>{analysis.opportunityReason}</Text>
                  )}
                  <Text style={styles.opportunityDisclaimer}>Scor structural de oportunitate — nu probabilitate de profit.</Text>
                </View>
              )}"""
app = replace_once(app, channel_block, opportunity_block, 'card Smart Opportunity Zone')

style_needle = """  channelInfo: { color: '#78b7ff', fontSize: 12, lineHeight: 18, fontWeight: '700' },"""
style_block = """  channelInfo: { color: '#78b7ff', fontSize: 12, lineHeight: 18, fontWeight: '700' },
  opportunityBox: { marginTop: 8, borderWidth: 1, borderColor: '#2b4152', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, backgroundColor: 'rgba(15,24,34,0.78)' },
  opportunityTitle: { fontSize: 18, lineHeight: 22, fontWeight: '900', letterSpacing: 0.2 },
  opportunityWatch: { color: '#dbe7f4', marginTop: 4, fontSize: 13, lineHeight: 18, fontWeight: '800' },
  opportunityReason: { color: '#aab8c9', marginTop: 3, fontSize: 12, lineHeight: 17 },
  opportunityDisclaimer: { color: '#68778a', marginTop: 5, fontSize: 10, lineHeight: 14 },"""
app = replace_once(app, style_needle, style_block, 'stiluri Smart Opportunity Zone')
APP.write_text(app, encoding='utf-8')

engine = ENGINE.read_text(encoding='utf-8')
engine = replace_once(
    engine,
    "const ENGINE_VERSION='0.3.15';",
    "const ENGINE_VERSION='0.3.16';",
    'engine version 0.3.16',
)

marker = "  function trendLinesFor(curve,result){"
if marker not in engine:
    raise SystemExit('trendLinesFor nu a fost găsită; build oprit pentru siguranță.')

helper = r'''  function channelOpportunity(channel,result,timeframe){
    if(!channel||!channel.valid||!result||result.clear)return null;
    const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
    const pos=channel.position;
    let direction=null,favor=0;

    if(channel.type==='Canal Ascendent'&&pos>=.54){
      direction='BUY';
      favor=clamp((pos-.50)/.50,0,1);
    }else if(channel.type==='Canal Descendent'&&pos<=.46){
      direction='SELL';
      favor=clamp((.50-pos)/.50,0,1);
    }else if(channel.type==='Canal Orizontal'&&pos>=.72){
      direction='BUY';
      favor=clamp((pos-.65)/.35,0,1);
    }else if(channel.type==='Canal Orizontal'&&pos<=.28){
      direction='SELL';
      favor=clamp((.35-pos)/.35,0,1);
    }else{
      return null;
    }

    const structural=clamp(Number(result.score)||0,0,.75)/.75;
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

    return {direction,score,watch,reason};
  }

'''
engine = engine.replace(marker, helper + marker, 1)

engine = replace_once(
    engine,
    "        send({\n          type:'RESULT',",
    "        const opportunity=channelOpportunity(candleChannel,r,timeframe);\n        send({\n          type:'RESULT',",
    'calcul Smart Opportunity Zone în run',
)

payload_old = """            channelType:candleChannel.valid?candleChannel.type:null,
            channelPosition:candleChannel.valid?candleChannel.zone:null,
            channelQuality:candleChannel.valid?Math.round(candleChannel.quality*100):null,
            trendLines:trendLinesFor(curve,r),"""
payload_new = """            channelType:candleChannel.valid?candleChannel.type:null,
            channelPosition:candleChannel.valid?candleChannel.zone:null,
            channelQuality:candleChannel.valid?Math.round(candleChannel.quality*100):null,
            opportunityDirection:opportunity?opportunity.direction:null,
            opportunityScore:opportunity?opportunity.score:null,
            opportunityWatch:opportunity?opportunity.watch:null,
            opportunityReason:opportunity?opportunity.reason:null,
            trendLines:trendLinesFor(curve,r),"""
engine = replace_once(engine, payload_old, payload_new, 'payload Smart Opportunity Zone')
ENGINE.write_text(engine, encoding='utf-8')

print('Patch v0.3.28 aplicat: ZONĂ BUY/SELL 50–69% ca scor structural + status de urmărit perechea, fără a forța semnalul.')
