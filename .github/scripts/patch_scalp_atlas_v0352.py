from pathlib import Path

APP = Path('scalp-atlas-new/App.tsx')
ENGINE = Path('scalp-atlas-new/analysisEngine.ts')


def replace_once(text: str, old: str, new: str, label: str) -> str:
    if old not in text:
        raise SystemExit(f'{label}: fragmentul așteptat nu a fost găsit; build oprit pentru siguranță.')
    return text.replace(old, new, 1)


# v0.3.52 — NOISY CHANNEL FILTER
# Feedback EUR/NZD OTC M15:
# - detectorul a desenat un canal ascendent, dar graficul avea multe alternări
#   mari și respingeri; BUY 84% a fost prea agresiv pentru o structură atât de mixtă.
#
# Corecție:
# - semnalele directe de tip Canal Ascendent/Descendent sunt verificate pentru
#   oscilație excesivă înainte de BUY/SELL;
# - canal cu quality modestă + multe alternări + drum mult mai mare decât deplasarea netă
#   => WAIT la nivel structural, nu semnal direct;
# - alegem ultimul maxim/minim relevant ca nivel galben de confirmare;
# - în UI, "Probabilitate" pentru semnal devine "Scor semnal".
# Cele 70 de modele, pragurile generale și logica breakout rămân neschimbate.

app = APP.read_text(encoding='utf-8')
app = replace_once(
    app,
    "            <Text style={styles.versionBadge}>v0.3.51 TEST</Text>",
    "            <Text style={styles.versionBadge}>v0.3.52 TEST</Text>",
    'badge v0.3.52',
)

app = replace_once(
    app,
    "              <Text style={styles.statusText}>{analysis.signal === 'NONE' || analysis.state === 'WAIT' ? 'Scor structură' : 'Probabilitate'}: {analysis.state === 'INVALID' ? '—' : `${analysis.probability}%`}</Text>",
    "              <Text style={styles.statusText}>{analysis.signal === 'NONE' || analysis.state === 'WAIT' ? 'Scor structură' : 'Scor semnal'}: {analysis.state === 'INVALID' ? '—' : `${analysis.probability}%`}</Text>",
    'Scor semnal în loc de Probabilitate',
)
APP.write_text(app, encoding='utf-8')

engine = ENGINE.read_text(encoding='utf-8')
engine = replace_once(
    engine,
    "const ENGINE_VERSION='0.3.29';",
    "const ENGINE_VERSION='0.3.30';",
    'engine version 0.3.30',
)

marker = """        send({
          type:'RESULT',"""

guard = """        // v0.3.52 — NOISY CHANNEL FILTER.
        // Un canal geometric nu este suficient dacă traseul recent este foarte zig-zag.
        // Măsurăm alternările semnificative și raportul dintre drumul parcurs și
        // deplasarea netă. Aplicăm filtrul numai semnalelor directe de tip Canal.
        if(candleChannel.valid&&r.clear&&String(r.atlas||'').startsWith('Canal ')&&
           !String(r.atlas||'').toLowerCase().includes('breakout')){
          const pts=curve&&curve.pts?curve.pts:[];
          const recentCount=Math.max(12,Math.min(22,Math.floor(pts.length*.48)));
          const recent=pts.slice(-recentCount);
          const coarse=[];

          for(let i=0;i<recent.length;i+=2){
            const g=recent.slice(i,i+2);
            if(!g.length)continue;
            coarse.push({
              x:g.reduce((s,p)=>s+p.x,0)/g.length,
              y:g.reduce((s,p)=>s+p.y,0)/g.length
            });
          }

          const moves=[];
          for(let i=1;i<coarse.length;i++){
            const m=(coarse[i-1].y-coarse[i].y)/Math.max(1,curve.h);
            if(Math.abs(m)>=.007)moves.push(m);
          }

          let flips=0;
          for(let i=1;i<moves.length;i++){
            if((moves[i]>0)!==(moves[i-1]>0))flips++;
          }

          const alternationRate=moves.length>=2?flips/(moves.length-1):0;
          const pathNorm=moves.reduce((s,m)=>s+Math.abs(m),0);
          const netNorm=coarse.length>=2
            ? Math.abs(coarse[0].y-coarse[coarse.length-1].y)/Math.max(1,curve.h)
            : 0;
          const chopRatio=pathNorm/Math.max(.012,netNorm);

          const recentPivots=pivots(recent,curve.h);
          const manyPivots=recentPivots.length>=4;
          const modestChannel=Number(candleChannel.quality)<.75;
          const noisyChannel=modestChannel&&manyPivots&&moves.length>=5&&
            alternationRate>=.45&&chopRatio>=2.8;

          if(noisyChannel){
            const oldDir=r.dir;
            const relevant=recentPivots.filter(p=>p.type===(oldDir==='BUY'?'H':'L'));
            const ref=relevant.length?relevant[relevant.length-1]:null;
            const fallbackLevel=oldDir==='BUY'?candleChannel.upperYNorm:candleChannel.lowerYNorm;
            const confirmationLevel=ref
              ? Math.max(.03,Math.min(.97,ref.y/Math.max(1,curve.h)))
              : fallbackLevel;

            r={
              ...r,
              clear:false,
              state:'WAIT',
              wait:true,
              bias:oldDir,
              dir:'NONE',
              score:Math.min(Number(r.score)||.69,.69),
              confirmationLevelY:confirmationLevel,
              atlas:oldDir==='BUY'
                ? 'Structură mixtă – impuls ascendent la rezistență'
                : 'Structură mixtă – impuls descendent la suport',
              reason:oldDir==='BUY'
                ? 'Canalul este vizibil, dar ultimele mișcări alternează puternic și există respingeri repetate. BUY se activează numai după o închidere clară peste ultimul maxim structural.'
                : 'Canalul este vizibil, dar ultimele mișcări alternează puternic și există respingeri repetate. SELL se activează numai după o închidere clară sub ultimul minim structural.'
            };
            opportunity=null;
          }
        }

        send({
          type:'RESULT',"""

engine = replace_once(engine, marker, guard, 'filtru canal zgomotos înainte de rezultat')
ENGINE.write_text(engine, encoding='utf-8')

print('Patch v0.3.52 aplicat: canalele zig-zag cu quality modestă nu mai emit BUY/SELL direct; trec în WAIT cu nivel structural de confirmare.')
