from pathlib import Path

APP = Path('scalp-atlas-new/App.tsx')
ENGINE = Path('scalp-atlas-new/analysisEngine.ts')


def replace_once(text: str, old: str, new: str, label: str) -> str:
    if old not in text:
        raise SystemExit(f'{label}: fragmentul așteptat nu a fost găsit; build oprit pentru siguranță.')
    return text.replace(old, new, 1)


# v0.3.34 — REAL CONFIRMATION TRANSITION
# Problema observată în testele repetate: motorul putea rămâne aproape permanent în WAIT,
# deoarece filtrul 63–71% îl trimitea în „Confirmare necesară”, iar boost-ul de momentum
# din v0.3.31 nu avea voie să transforme un rezultat deja WAIT în BUY/SELL.
# Corecție:
# - separăm WAIT „moale” (scor moderat / confirmare necesară) de WAIT „dur”
#   (suport/rezistență apropiată, contra-canal, breakout/retest, impuls recent opus etc.);
# - dacă un canal direcțional este de calitate bună, poziția în canal este favorabilă,
#   iar momentum-ul recent este puternic și aliniat, WAIT-ul moale poate deveni BUY/SELL;
# - WAIT-urile de protecție rămân intacte;
# - confirmarea devine o condiție detectabilă în fotografia curentă, nu o stare perpetuă.

app = APP.read_text(encoding='utf-8')
app = replace_once(
    app,
    "            <Text style={styles.versionBadge}>v0.3.33 TEST</Text>",
    "            <Text style={styles.versionBadge}>v0.3.34 TEST</Text>",
    'badge v0.3.34',
)
APP.write_text(app, encoding='utf-8')

engine = ENGINE.read_text(encoding='utf-8')
engine = replace_once(
    engine,
    "const ENGINE_VERSION='0.3.21';",
    "const ENGINE_VERSION='0.3.22';",
    'engine version 0.3.22',
)

old = """        const opportunity=channelOpportunity(candleChannel,r,timeframe,curve);
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
        send({"""

new = """        const opportunity=channelOpportunity(candleChannel,r,timeframe,curve);

        // v0.3.34 — WAIT nu mai este o fundătură.
        // Unele WAIT-uri sunt filtre de siguranță și NU trebuie depășite; altele sunt
        // doar consecința pragului moderat 63–71% și pot deveni semnal când fotografia
        // curentă arată deja confirmarea prin canal + poziție + momentum.
        const waitText=(String(r.atlas||'')+' '+String(r.reason||'')).toLowerCase();
        const hardWait=r.wait&&(
          waitText.includes('suport apropiat')||
          waitText.includes('rezisten')||
          waitText.includes('contra culoarului')||
          waitText.includes('marginea opusă')||
          waitText.includes('impuls recent opus')||
          waitText.includes('rebound imediat')||
          waitText.includes('recul imediat')||
          waitText.includes('contra trendului')||
          waitText.includes('breakout')||
          waitText.includes('retest')||
          waitText.includes('epuizare')
        );
        const softWait=r.wait&&!hardWait&&(
          waitText.includes('confirmare necesară')||
          waitText.includes('scor moderat')||
          waitText.includes('potrivirea cu atlasul')||
          waitText.includes('confirmarea următoarelor lumânări')
        );
        const channelAligned=opportunity&&(
          (opportunity.direction==='BUY'&&candleChannel.type==='Canal Ascendent')||
          (opportunity.direction==='SELL'&&candleChannel.type==='Canal Descendent')
        );
        const favorablePosition=opportunity&&(
          (opportunity.direction==='BUY'&&candleChannel.position>=.34)||
          (opportunity.direction==='SELL'&&candleChannel.position<=.66)
        );
        const qualityReady=candleChannel.valid&&candleChannel.quality>=.70;
        const confirmationDetected=Boolean(
          opportunity&&opportunity.strongAligned&&channelAligned&&favorablePosition&&qualityReady&&
          !r.clear&&!hardWait&&(!r.wait||softWait)
        );

        if(confirmationDetected){
          const confirmedScore=Math.min(.79,Math.max(.72,(opportunity.score/100)+.05,Number(r.score)||0));
          r={
            ...r,
            clear:true,state:'SIGNAL',wait:false,bias:null,dir:opportunity.direction,
            score:confirmedScore,
            atlas:candleChannel.type+' – confirmare momentum detectată',
            reason:'Confirmarea este prezentă în fotografia curentă: culoarul, poziția prețului și momentum-ul recent sunt aliniate pentru '+opportunity.direction+'.'
          };
        }else if(opportunity&&opportunity.strongAligned&&!r.clear&&!r.wait){
          const momentumScore=Math.min(.69,Math.max(Number(r.score)||0,opportunity.score/100));
          r={
            ...r,
            clear:false,state:'WAIT',wait:true,bias:opportunity.direction,dir:'NONE',
            score:momentumScore,
            atlas:candleChannel.type+' – impuls '+opportunity.direction+' în confirmare',
            reason:'Culoarul și impulsul recent sunt aliniate pentru '+opportunity.direction+', dar lipsește încă una dintre condițiile de confirmare: poziție favorabilă sau calitate suficientă a canalului.'
          };
        }
        send({"""

engine = replace_once(engine, old, new, 'tranziție reală WAIT -> BUY/SELL')
ENGINE.write_text(engine, encoding='utf-8')
print('Patch v0.3.34 aplicat: WAIT moale poate deveni BUY/SELL când canalul + poziția + momentum confirmă; WAIT-urile de protecție rămân active.')
