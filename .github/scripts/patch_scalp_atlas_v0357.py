from pathlib import Path

APP = Path('scalp-atlas-new/App.tsx')


def replace_once(text: str, old: str, new: str, label: str) -> str:
    if old not in text:
        raise SystemExit(f'{label}: fragmentul așteptat nu a fost găsit; build oprit pentru siguranță.')
    return text.replace(old, new, 1)


# v0.3.57 — FORCE BUTTON LABEL "ANALIZĂ"
# Cerință reconfirmată după test:
# butonul principal trebuie să afișeze NUMAI cuvântul "ANALIZĂ".
# Fără "ANALIZEAZĂ CU 70 MODELE".
# Modificare exclusiv vizuală; motorul și atlasul de 70 modele rămân intacte.

app = APP.read_text(encoding='utf-8')

app = replace_once(
    app,
    "            <Text style={styles.versionBadge}>v0.3.56 TEST</Text>",
    "            <Text style={styles.versionBadge}>v0.3.57 TEST</Text>",
    'badge v0.3.57',
)

app = replace_once(
    app,
    "          <Text style={styles.analyzeText}>{busy ? 'ANALIZEZ…' : timeframeDetecting ? 'CITESC TIMEFRAME…' : !engineReady && image ? 'PREGĂTESC MOTORUL…' : 'ANALIZĂ'}</Text>",
    "          <Text style={styles.analyzeText}>ANALIZĂ</Text>",
    'buton static ANALIZĂ',
)

app = app.replace('ANALIZEAZĂ CU 70 MODELE', 'ANALIZĂ')
app = app.replace('ANALIZEAZĂ CU ${SCALP_ATLAS_COUNT} MODELE', 'ANALIZĂ')

APP.write_text(app, encoding='utf-8')
print('Patch v0.3.57 aplicat: butonul principal afișează exclusiv ANALIZĂ.')
