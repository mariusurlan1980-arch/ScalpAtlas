from pathlib import Path

APP = Path('scalp-atlas-new/App.tsx')
ENGINE = Path('scalp-atlas-new/analysisEngine.ts')


def replace_once(text: str, old: str, new: str, label: str) -> str:
    if old not in text:
        raise SystemExit(f'{label}: fragmentul așteptat nu a fost găsit; build oprit pentru siguranță.')
    return text.replace(old, new, 1)


# v0.3.45 — CLEAR WAIT WORDING
# Feedback AUD/CHF OTC M15:
# - WAIT era corect, dar "Probabilitate: 69%" putea fi citit ca probabilitate
#   a unui SELL activ, deși nu exista semnal confirmat;
# - "Bias: SELL" este direcție urmărită, nu comandă de intrare.
#
# Corecție exclusiv de prezentare:
# - WAIT => "Scor structură", nu "Probabilitate";
# - WAIT => "Direcție urmărită", nu "Bias";
# - SIGNAL => păstrează "Probabilitate";
# - denumirile Confirmare minim/maxim recent devin explicite: "așteaptă confirmarea...".
# Logica BUY/SELL/WAIT, pragurile și cele 70 de modele nu sunt schimbate.

app = APP.read_text(encoding='utf-8')
app = replace_once(
    app,
    "            <Text style={styles.versionBadge}>v0.3.44 TEST</Text>",
    "            <Text style={styles.versionBadge}>v0.3.45 TEST</Text>",
    'badge v0.3.45',
)

app = replace_once(
    app,
    "              {analysis.state === 'WAIT' && analysis.bias && <Text style={styles.statusText}>Bias: {analysis.bias}</Text>}",
    "              {analysis.state === 'WAIT' && analysis.bias && <Text style={styles.statusText}>Direcție urmărită: {analysis.bias}</Text>}",
    'clarificare bias WAIT',
)

app = replace_once(
    app,
    "              <Text style={styles.statusText}>Probabilitate: {analysis.state === 'INVALID' ? '—' : `${analysis.probability}%`}</Text>",
    "              <Text style={styles.statusText}>{analysis.state === 'WAIT' ? 'Scor structură' : 'Probabilitate'}: {analysis.state === 'INVALID' ? '—' : `${analysis.probability}%`}</Text>",
    'scor structură în WAIT',
)

APP.write_text(app, encoding='utf-8')

engine = ENGINE.read_text(encoding='utf-8')
engine = replace_once(
    engine,
    "const ENGINE_VERSION='0.3.26';",
    "const ENGINE_VERSION='0.3.27';",
    'engine version 0.3.27',
)

engine = engine.replace(
    "Canal Descendent – Confirmare minim recent",
    "Canal Descendent – așteaptă confirmarea minimului recent"
)
engine = engine.replace(
    "Canal Ascendent – Confirmare maxim recent",
    "Canal Ascendent – așteaptă confirmarea maximului recent"
)

ENGINE.write_text(engine, encoding='utf-8')
print('Patch v0.3.45 aplicat: WAIT afișează Scor structură + Direcție urmărită; modelele minim/maxim recent sunt formulate explicit.')
