from pathlib import Path

APP = Path('scalp-atlas-new/App.tsx')
ENGINE = Path('scalp-atlas-new/analysisEngine.ts')


def replace_once(text: str, old: str, new: str, label: str) -> str:
    if old not in text:
        raise SystemExit(f'{label}: fragmentul așteptat nu a fost găsit; build oprit pentru siguranță.')
    return text.replace(old, new, 1)


# v0.3.54 — CONFIRMATION INVALIDATION
# Feedback AUD/CAD OTC M15:
# - aplicația aștepta CONFIRMARE BUY;
# - înainte de confirmare, prețul a căzut și a invalidat structura de revenire;
# - direcția BUY nu trebuie păstrată după ruperea suportului local / marginii inferioare.
#
# Corecție:
# - WAIT BUY + impuls descendent puternic + rupere suport local/canal => BUY ANULAT;
# - WAIT SELL + impuls ascendent puternic + rupere rezistență locală/canal => SELL ANULAT;
# - după anulare: bias neutru, fără badge de confirmare și fără expirare;
# - cardul afișează explicit "CONFIRMARE BUY/SELL ANULATĂ";
# - motorul recalculează structura la următoarea fotografie.
# Cele 70 de modele și regulile de confirmare existente rămân păstrate.

app = APP.read_text(encoding='utf-8')

app = replace_once(
    app,
    "            <Text style={styles.versionBadge}>v0.3.53 TEST</Text>",
    "            <Text style={styles.versionBadge}>v0.3.54 TEST</Text>",
    'badge v0.3.54',
)

app = replace_once(
    app,
    "  bias?: 'BUY' | 'SELL' | null;\n  pattern: string;",
    "  bias?: 'BUY' | 'SELL' | null;\n  cancelledDirection?: 'BUY' | 'SELL' | null;\n  pattern: string;",
    'tip cancelledDirection',
)

app = replace_once(
    app,
    """                {analysis.state === 'WAIT' ? 'AȘTEAPTĂ CONFIRMAREA' : analysis.state === 'INVALID' ? 'FOTOGRAFIE DEJA ANALIZATĂ' : analysis.signal === 'NONE' ? 'FĂRĂ SEMNAL CLAR' : analysis.signal}""",
    """                {analysis.cancelledDirection
                  ? `CONFIRMARE ${analysis.cancelledDirection} ANULATĂ`
                  : analysis.state === 'WAIT'
                    ? 'AȘTEAPTĂ CONFIRMAREA'
                    : analysis.state === 'INVALID'
                      ? 'FOTOGRAFIE DEJA ANALIZATĂ'
                      : analysis.signal === 'NONE'
                        ? 'FĂRĂ SEMNAL CLAR'
                        : analysis.signal}""",
    'titlu explicit anulare',
)

APP.write_text(app, encoding='utf-8')

engine = ENGINE.read_text(encoding='utf-8')
engine = replace_once(
    engine,
    "const ENGINE_VERSION='0.3.30';",
    "const ENGINE_VERSION='0.3.31';",
    'engine version 0.3.31',
)

marker = """        send({
          type:'RESULT',"""

guard = """        // v0.3.54 — invalidarea unei confirmări înainte de intrare.
        if(r.wait&&r.bias&&curve&&curve.pts&&curve.pts.length>=10){
          const invDir=r.bias;
          const invPts=curve.pts;
          const invRecent=invPts.slice(-Math.max(12,Math.min(24,Math.floor(invPts.length*.48))));
          const invEnd=invPts[invPts.length-1];
          const invBack=invPts[Math.max(0,invPts.length-4)];
          const invLastMove=(invBack.y-invEnd.y)/Math.max(1,curve.h);
          const invMicro=linReg(invPts.slice(-Math.max(6,Math.floor(invPts.length*.22))));
          const invMicroNorm=-invMicro.slope*curve.w/Math.max(1,curve.h);
          const invPivots=pivots(invRecent,curve.h);
          const invLows=invPivots.filter(p=>p.type==='L');
          const invHighs=invPivots.filter(p=>p.type==='H');
          const invLastLow=invLows.length?invLows[invLows.length-1]:null;
          const invLastHigh=invHighs.length?invHighs[invHighs.length-1]:null;

          const invTop=(Number.isFinite(anchor.lo)?anchor.lo:anchor.y)/Math.max(1,curve.h);
          const invBottom=(Number.isFinite(anchor.hi)?anchor.hi:anchor.y)/Math.max(1,curve.h);

          const strongDown=invLastMove<-.024||invMicroNorm<-.042;
          const strongUp=invLastMove>.024||invMicroNorm>.042;

          const brokeLocalSupport=invLastLow
            ? invBottom>invLastLow.y/Math.max(1,curve.h)+.008
            : false;
          const brokeLocalResistance=invLastHigh
            ? invTop<invLastHigh.y/Math.max(1,curve.h)-.008
            : false;

          const brokeChannelDown=candleChannel.valid
            ? invBottom>candleChannel.lowerYNorm+.010
            : false;
          const brokeChannelUp=candleChannel.valid
            ? invTop<candleChannel.upperYNorm-.010
            : false;

          const cancelBuy=invDir==='BUY'&&strongDown&&(brokeLocalSupport||brokeChannelDown);
          const cancelSell=invDir==='SELL'&&strongUp&&(brokeLocalResistance||brokeChannelUp);

          if(cancelBuy||cancelSell){
            const cancelled=invDir;
            r={
              ...r,
              clear:false,
              state:'NONE',
              wait:false,
              bias:null,
              dir:'NONE',
              score:Math.min(Number(r.score)||.58,.58),
              confirmationLevelY:null,
              cancelledDirection:cancelled,
              atlas:`Confirmare ${cancelled} anulată – recalculare`,
              reason:cancelled==='BUY'
                ? 'Revenirea BUY a eșuat înainte de confirmare: impulsul descendent a rupt suportul local sau marginea inferioară relevantă. Direcția BUY este anulată; așteaptă o structură nouă.'
                : 'Revenirea SELL a eșuat înainte de confirmare: impulsul ascendent a rupt rezistența locală sau marginea superioară relevantă. Direcția SELL este anulată; așteaptă o structură nouă.'
            };
            opportunity=null;
          }
        }

        send({
          type:'RESULT',"""

engine = replace_once(engine, marker, guard, 'gardă invalidare confirmare')

engine = replace_once(
    engine,
    """            opportunityReason:opportunity?opportunity.reason:null,
            trendLines:""",
    """            opportunityReason:opportunity?opportunity.reason:null,
            cancelledDirection:r.cancelledDirection||null,
            trendLines:""",
    'payload cancelledDirection',
)

ENGINE.write_text(engine, encoding='utf-8')
print('Patch v0.3.54 aplicat: confirmarea BUY/SELL este anulată automat când suportul/rezistența relevantă este ruptă înainte de confirmare.')
