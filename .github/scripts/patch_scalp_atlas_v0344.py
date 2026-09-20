from pathlib import Path

APP = Path('scalp-atlas-new/App.tsx')
ENGINE = Path('scalp-atlas-new/analysisEngine.ts')


def replace_once(text: str, old: str, new: str, label: str) -> str:
    if old not in text:
        raise SystemExit(f'{label}: fragmentul așteptat nu a fost găsit; build oprit pentru siguranță.')
    return text.replace(old, new, 1)


# v0.3.44 — CHANNEL BREAKOUT BIAS RESET
# Feedback EUR/TRY OTC M15:
# - canalul descendent era corect detectat;
# - ultimele lumânări au avut rebound ascendent puternic până la / peste marginea superioară;
# - rezultatul rămânea totuși WAIT cu Bias SELL.
#
# Corecție:
# - dacă un canal descendent este atacat sus cu momentum ascendent puternic,
#   SELL este suspendat temporar și biasul devine neutru;
# - simetric, într-un canal ascendent cu cădere puternică spre/sub marginea inferioară,
#   BUY este suspendat;
# - dacă motorul detectează deja un BUY/SELL confirmat în sensul breakout-ului,
#   acel semnal nu este anulat;
# - scorul secundar ZONĂ BUY/SELL este ascuns în starea neutră, pentru a nu contrazice WAIT.

app = APP.read_text(encoding='utf-8')
app = replace_once(
    app,
    "            <Text style={styles.versionBadge}>v0.3.43 TEST</Text>",
    "            <Text style={styles.versionBadge}>v0.3.44 TEST</Text>",
    'badge v0.3.44',
)
APP.write_text(app, encoding='utf-8')

engine = ENGINE.read_text(encoding='utf-8')
engine = replace_once(
    engine,
    "const ENGINE_VERSION='0.3.25';",
    "const ENGINE_VERSION='0.3.26';",
    'engine version 0.3.26',
)

engine = replace_once(
    engine,
    "        const opportunity=channelOpportunity(candleChannel,r,timeframe,curve);",
    "        let opportunity=channelOpportunity(candleChannel,r,timeframe,curve);",
    'opportunity mutabil pentru neutralizare breakout',
)

marker = """        send({
          type:'RESULT',"""

guard = """        // v0.3.44 — un rebound/breakdown puternic la marginea canalului suspendă
        // biasul vechi până când piața confirmă respingerea sau breakout-ul.
        const recentPts=curve&&curve.pts?curve.pts:[];
        let edgeLastMove=0,edgeMicroNorm=0;
        if(recentPts.length>=6){
          const edgeEnd=recentPts[recentPts.length-1];
          const edgeBack=recentPts[Math.max(0,recentPts.length-4)];
          edgeLastMove=(edgeBack.y-edgeEnd.y)/Math.max(1,curve.h);
          const edgeMicro=linReg(recentPts.slice(-Math.max(6,Math.floor(recentPts.length*.22))));
          edgeMicroNorm=-edgeMicro.slope*curve.w/Math.max(1,curve.h);
        }

        const anchorTopNorm=anchor&&curve
          ? (Number.isFinite(anchor.lo)?anchor.lo:anchor.y)/Math.max(1,curve.h)
          : null;
        const anchorBottomNorm=anchor&&curve
          ? (Number.isFinite(anchor.hi)?anchor.hi:anchor.y)/Math.max(1,curve.h)
          : null;
        const anchorCenterNorm=anchor&&curve
          ? ((Number.isFinite(anchor.lo)?anchor.lo:anchor.y)+(Number.isFinite(anchor.hi)?anchor.hi:anchor.y))/2/Math.max(1,curve.h)
          : null;

        const strongUpEdge=edgeLastMove>.022||edgeMicroNorm>.040;
        const strongDownEdge=edgeLastMove<-.022||edgeMicroNorm<-.040;
        const oldDirection=r.clear?r.dir:(r.wait?r.bias:null);

        const descendingUpperPressure=Boolean(
          candleChannel.valid&&candleChannel.type==='Canal Descendent'&&strongUpEdge&&
          anchorTopNorm!=null&&anchorTopNorm<=candleChannel.upperYNorm+.012
        );
        const ascendingLowerPressure=Boolean(
          candleChannel.valid&&candleChannel.type==='Canal Ascendent'&&strongDownEdge&&
          anchorBottomNorm!=null&&anchorBottomNorm>=candleChannel.lowerYNorm-.012
        );

        if(descendingUpperPressure&&oldDirection!=='BUY'){
          const confirmedOutside=anchorCenterNorm!=null&&anchorCenterNorm<candleChannel.upperYNorm-.004;
          r={
            ...r,
            clear:false,state:'WAIT',wait:true,bias:null,dir:'NONE',
            score:Math.min(Number(r.score)||.71,.71),
            confirmationLevelY:candleChannel.upperYNorm,
            atlas:confirmedOutside
              ? 'Canal Descendent – posibil breakout ascendent'
              : 'Canal Descendent – testare margine superioară',
            reason:confirmedOutside
              ? 'Rebound-ul ascendent a trecut peste marginea superioară a canalului. Biasul SELL este suspendat. Așteaptă menținerea/închiderea peste canal pentru confirmare BUY sau respingerea și reintrarea în canal pentru revenirea SELL.'
              : 'Rebound-ul ascendent testează marginea superioară a canalului. Biasul SELL este suspendat până la o respingere clară în jos sau un breakout ascendent confirmat.'
          };
          opportunity=null;
        }else if(ascendingLowerPressure&&oldDirection!=='SELL'){
          const confirmedOutside=anchorCenterNorm!=null&&anchorCenterNorm>candleChannel.lowerYNorm+.004;
          r={
            ...r,
            clear:false,state:'WAIT',wait:true,bias:null,dir:'NONE',
            score:Math.min(Number(r.score)||.71,.71),
            confirmationLevelY:candleChannel.lowerYNorm,
            atlas:confirmedOutside
              ? 'Canal Ascendent – posibil breakout descendent'
              : 'Canal Ascendent – testare margine inferioară',
            reason:confirmedOutside
              ? 'Căderea a trecut sub marginea inferioară a canalului. Biasul BUY este suspendat. Așteaptă menținerea/închiderea sub canal pentru confirmare SELL sau respingerea și reintrarea în canal pentru revenirea BUY.'
              : 'Căderea testează marginea inferioară a canalului. Biasul BUY este suspendat până la o respingere clară în sus sau un breakout descendent confirmat.'
          };
          opportunity=null;
        }

        send({
          type:'RESULT',"""

engine = replace_once(engine, marker, guard, 'gardă breakout contra canalului')
ENGINE.write_text(engine, encoding='utf-8')

print('Patch v0.3.44 aplicat: atacul puternic al marginii canalului suspendă biasul vechi și trece WAIT în stare neutră până la confirmare.')
