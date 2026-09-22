from pathlib import Path

APP = Path('scalp-atlas-new/App.tsx')


def replace_once(text: str, old: str, new: str, label: str) -> str:
    if old not in text:
        raise SystemExit(f'{label}: fragmentul așteptat nu a fost găsit; build oprit pentru siguranță.')
    return text.replace(old, new, 1)


# v0.3.56 — SIMPLIFY ANALYZE BUTTON
# Cerință:
# - textul "ANALIZEAZĂ CU 70 MODELE" este prea lung;
# - în interfață se afișează doar cuvântul "ANALIZĂ".
# Modificare exclusiv vizuală; motorul și cele 70 de modele rămân neschimbate.

app = APP.read_text(encoding='utf-8')

app = replace_once(
    app,
    "            <Text style={styles.versionBadge}>v0.3.55 TEST</Text>",
    "            <Text style={styles.versionBadge}>v0.3.56 TEST</Text>",
    'badge v0.3.56',
)

app = replace_once(
    app,
    "<Text style={styles.analyzeText}>{busy ? 'ANALIZEZ…' : `ANALIZEAZĂ CU ${SCALP_ATLAS_COUNT} MODELE`}</Text>",
    "<Text style={styles.analyzeText}>{busy ? 'ANALIZEZ…' : 'ANALIZĂ'}</Text>",
    'text buton ANALIZĂ',
)

APP.write_text(app, encoding='utf-8')
print('Patch v0.3.56 aplicat: butonul principal afișează doar ANALIZĂ; logica de analiză rămâne neschimbată.')
