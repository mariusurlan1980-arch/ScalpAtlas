from pathlib import Path

APP = Path('scalp-atlas-new/App.tsx')
ENGINE = Path('scalp-atlas-new/analysisEngine.ts')


def replace_once(text: str, old: str, new: str, label: str) -> str:
    if old not in text:
        raise SystemExit(f'{label}: fragmentul așteptat nu a fost găsit; build oprit pentru siguranță.')
    return text.replace(old, new, 1)


# v0.3.26 — SMART CANDLE CHANNEL VISUAL TUNE
# - păstrează marginile culoarului clare;
# - face mediana mai subțire și discretă, ca să nu fie confundată cu suport/rezistență;
# - nu schimbă logica BUY/SELL/WAIT.

app = APP.read_text(encoding='utf-8')
app = replace_once(
    app,
    "            <Text style={styles.versionBadge}>v0.3.25 TEST</Text>",
    "            <Text style={styles.versionBadge}>v0.3.26 TEST</Text>",
    'badge v0.3.26',
)
app = replace_once(
    app,
    "  channelMidLine: { height: 0, backgroundColor: 'transparent', borderTopWidth: 2, borderStyle: 'dashed', borderColor: '#63a8ff', opacity: 0.75 },",
    "  channelMidLine: { height: 0, backgroundColor: 'transparent', borderTopWidth: 1, borderStyle: 'dashed', borderColor: '#63a8ff', opacity: 0.52 },",
    'mediană culoar mai subțire',
)
APP.write_text(app, encoding='utf-8')

engine = ENGINE.read_text(encoding='utf-8')
engine = replace_once(
    engine,
    "const ENGINE_VERSION='0.3.13';",
    "const ENGINE_VERSION='0.3.14';",
    'engine version 0.3.14',
)
ENGINE.write_text(engine, encoding='utf-8')

print('Patch v0.3.26 aplicat: mediana culoarului este mai subțire și mai discretă; logica de analiză rămâne neschimbată.')
