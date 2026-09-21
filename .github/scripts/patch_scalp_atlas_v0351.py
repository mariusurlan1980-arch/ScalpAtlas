from pathlib import Path

APP = Path('scalp-atlas-new/App.tsx')


def replace_once(text: str, old: str, new: str, label: str) -> str:
    if old not in text:
        raise SystemExit(f'{label}: fragmentul așteptat nu a fost găsit; build oprit pentru siguranță.')
    return text.replace(old, new, 1)


# v0.3.51 — EXPLICIT CONFIRMATION DIRECTION
# Feedback CAD/JPY OTC M15:
# - badge-ul compact din v0.3.50 este bun;
# - simplul "CONFIRMARE" nu spune suficient de clar dacă se așteaptă BUY sau SELL.
#
# Corecție exclusiv vizuală:
# - WAIT + bias BUY => "CONFIRMARE BUY"
# - WAIT + bias SELL => "CONFIRMARE SELL"
# - dacă biasul este neutru, direcția este dedusă din modelul WAIT, la fel ca poziționarea.
# - culoarea rămâne galbenă pentru a sublinia că NU este încă semnal activ.
# Motorul, pragurile și cele 70 de modele nu sunt modificate.

app = APP.read_text(encoding='utf-8')

app = replace_once(
    app,
    "            <Text style={styles.versionBadge}>v0.3.50 TEST</Text>",
    "            <Text style={styles.versionBadge}>v0.3.51 TEST</Text>",
    'badge v0.3.51',
)

old_text = """                {analysis.signal === 'NONE' && analysis.bias
                  ? 'CONFIRMARE'
                  : analysis.signal === 'NONE' && analysis.opportunityScore < 64
                    ? `OBSERVAȚIE ${analysis.opportunityDirection} ${analysis.opportunityScore}%`
                    : `ZONĂ ${analysis.opportunityDirection} ${analysis.opportunityScore}%`}"""

new_text = """                {analysis.signal === 'NONE' && analysis.bias
                  ? `CONFIRMARE ${analysis.bias}`
                  : analysis.signal === 'NONE' && analysis.opportunityScore < 64
                    ? `OBSERVAȚIE ${analysis.opportunityDirection} ${analysis.opportunityScore}%`
                    : `ZONĂ ${analysis.opportunityDirection} ${analysis.opportunityScore}%`}"""

app = replace_once(app, old_text, new_text, 'direcție explicită în badge WAIT')

APP.write_text(app, encoding='utf-8')
print('Patch v0.3.51 aplicat: badge-ul WAIT afișează CONFIRMARE BUY/SELL și rămâne galben.')
