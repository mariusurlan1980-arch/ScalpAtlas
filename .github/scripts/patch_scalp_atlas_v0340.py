from pathlib import Path

APP = Path('scalp-atlas-new/App.tsx')
ENGINE = Path('scalp-atlas-new/analysisEngine.ts')


def replace_once(text: str, old: str, new: str, label: str) -> str:
    if old not in text:
        raise SystemExit(f'{label}: fragmentul așteptat nu a fost găsit; build oprit pentru siguranță.')
    return text.replace(old, new, 1)


# v0.3.40 — EASIER SOFT CONFIRMATION
# Feedback din testare: confirmarea apare prea rar.
# Ajustăm numai WAIT-urile moi:
# - acceptăm momentum aliniat moderat, nu doar impulsul "strongAligned";
# - relaxăm ușor poziția favorabilă în canal;
# - relaxăm calitatea minimă a canalului;
# - WAIT-urile dure (rezistență/suport, impuls opus, contra-canal, breakout/retest etc.) rămân intacte.

app = APP.read_text(encoding='utf-8')
app = replace_once(
    app,
    "            <Text style={styles.versionBadge}>v0.3.39 TEST</Text>",
    "            <Text style={styles.versionBadge}>v0.3.40 TEST</Text>",
    'badge v0.3.40',
)
APP.write_text(app, encoding='utf-8')

engine = ENGINE.read_text(encoding='utf-8')
engine = replace_once(
    engine,
    "const ENGINE_VERSION='0.3.22';",
    "const ENGINE_VERSION='0.3.23';",
    'engine version 0.3.23',
)

engine = replace_once(
    engine,
    """        const favorablePosition=opportunity&&(
          (opportunity.direction==='BUY'&&candleChannel.position>=.34)||
          (opportunity.direction==='SELL'&&candleChannel.position<=.66)
        );
        const qualityReady=candleChannel.valid&&candleChannel.quality>=.70;
        const confirmationDetected=Boolean(
          opportunity&&opportunity.strongAligned&&channelAligned&&favorablePosition&&qualityReady&&
          !r.clear&&!hardWait&&(!r.wait||softWait)
        );

        if(confirmationDetected){
          const confirmedScore=Math.min(.79,Math.max(.72,(opportunity.score/100)+.05,Number(r.score)||0));""",
    """        const favorablePosition=opportunity&&(
          (opportunity.direction==='BUY'&&candleChannel.position>=.30)||
          (opportunity.direction==='SELL'&&candleChannel.position<=.70)
        );
        const qualityReady=candleChannel.valid&&candleChannel.quality>=.64;
        const alignedMomentum=Boolean(opportunity&&(opportunity.strongAligned||opportunity.momentumAligned));
        const confirmationDetected=Boolean(
          opportunity&&alignedMomentum&&channelAligned&&favorablePosition&&qualityReady&&
          !r.clear&&!hardWait&&(!r.wait||softWait)
        );

        if(confirmationDetected){
          const confirmedScore=Math.min(.79,Math.max(.70,(opportunity.score/100)+.04,Number(r.score)||0));""",
    'relaxează confirmarea moale',
)

engine = replace_once(
    engine,
    "            atlas:candleChannel.type+' – confirmare momentum detectată',",
    "            atlas:candleChannel.type+' – confirmare momentum detectată (sensibilitate medie)',",
    'eticheta confirmare v0.3.40',
)

ENGINE.write_text(engine, encoding='utf-8')
print('Patch v0.3.40 aplicat: confirmarea moale apare mai ușor; filtrele dure de protecție rămân active.')
