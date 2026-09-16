from pathlib import Path

APP = Path('scalp-atlas-new/App.tsx')
ENGINE = Path('scalp-atlas-new/analysisEngine.ts')


def replace_once(text: str, old: str, new: str, label: str) -> str:
    if old not in text:
        raise SystemExit(f'{label}: fragmentul așteptat nu a fost găsit; build oprit pentru siguranță.')
    return text.replace(old, new, 1)


# v0.3.27 — FINE YELLOW CONFIRMATION LINE
# - păstrează logica neschimbată;
# - face linia galbenă de confirmare mai fină și puțin mai discretă.

app = APP.read_text(encoding='utf-8')
app = replace_once(
    app,
    "            <Text style={styles.versionBadge}>v0.3.26 TEST</Text>",
    "            <Text style={styles.versionBadge}>v0.3.27 TEST</Text>",
    'badge v0.3.27',
)
app = replace_once(
    app,
    "  confirmationLine: { backgroundColor: '#ffd34d', height: 3 },",
    "  confirmationLine: { backgroundColor: '#ffd34d', height: 2, opacity: 0.86 },",
    'linie galbenă mai fină',
)
APP.write_text(app, encoding='utf-8')

engine = ENGINE.read_text(encoding='utf-8')
engine = replace_once(
    engine,
    "const ENGINE_VERSION='0.3.14';",
    "const ENGINE_VERSION='0.3.15';",
    'engine version 0.3.15',
)
ENGINE.write_text(engine, encoding='utf-8')

print('Patch v0.3.27 aplicat: linia galbenă de confirmare este mai fină și mai discretă; logica de analiză rămâne neschimbată.')
