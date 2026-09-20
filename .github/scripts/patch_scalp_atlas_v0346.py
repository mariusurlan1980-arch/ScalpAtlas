from pathlib import Path

APP = Path('scalp-atlas-new/App.tsx')


def replace_once(text: str, old: str, new: str, label: str) -> str:
    if old not in text:
        raise SystemExit(f'{label}: fragmentul așteptat nu a fost găsit; build oprit pentru siguranță.')
    return text.replace(old, new, 1)


# v0.3.46 — LOW-SCORE ZONE CLEANUP
# Feedback AED/CNY OTC M15:
# - rezultatul principal "FĂRĂ SEMNAL CLAR" a fost corect;
# - eticheta "ZONĂ SELL 54%" putea însă fi interpretată ca recomandare direcțională,
#   iar piața a continuat imediat cu rebound ascendent;
# - oportunitățile slabe trebuie să rămână informație secundară, nu badge dominant.
#
# Corecții de prezentare:
# - dacă nu există BUY/SELL și nu există WAIT cu direcție, o oportunitate sub 60%
#   nu mai apare deloc pe grafic/card;
# - între 60–63% apare doar ca "OBSERVAȚIE BUY/SELL", nu "ZONĂ";
# - de la 64% în sus poate rămâne "ZONĂ BUY/SELL" ca oportunitate structurală;
# - FĂRĂ SEMNAL CLAR afișează "Scor structură", nu "Probabilitate".
# Motorul și cele 70 de modele rămân neschimbate.

app = APP.read_text(encoding='utf-8')

app = replace_once(
    app,
    "            <Text style={styles.versionBadge}>v0.3.45 TEST</Text>",
    "            <Text style={styles.versionBadge}>v0.3.46 TEST</Text>",
    'badge v0.3.46',
)

app = replace_once(
    app,
    "{analysis.opportunityDirection && analysis.opportunityScore != null && (",
    "{analysis.opportunityDirection && analysis.opportunityScore != null && (analysis.bias || analysis.opportunityScore >= 60) && (",
    'ascunde card oportunitate slabă',
)

app = replace_once(
    app,
    "{opportunityLabelStyle && analysis?.opportunityDirection && analysis.opportunityScore != null && (",
    "{opportunityLabelStyle && analysis?.opportunityDirection && analysis.opportunityScore != null && (analysis.bias || analysis.opportunityScore >= 60) && (",
    'ascunde badge oportunitate slabă',
)

app = replace_once(
    app,
    """                    {analysis.signal === 'NONE' && analysis.bias
                      ? 'ZONĂ DE CONFIRMARE'
                      : `ZONĂ ${analysis.opportunityDirection} • ${analysis.opportunityScore}%`}""",
    """                    {analysis.signal === 'NONE' && analysis.bias
                      ? 'ZONĂ DE CONFIRMARE'
                      : analysis.signal === 'NONE' && analysis.opportunityScore < 64
                        ? `OBSERVAȚIE ${analysis.opportunityDirection} • ${analysis.opportunityScore}%`
                        : `ZONĂ ${analysis.opportunityDirection} • ${analysis.opportunityScore}%`}""",
    'text card oportunitate moderată',
)

app = replace_once(
    app,
    """                {analysis.signal === 'NONE' && analysis.bias
                  ? 'ZONĂ DE CONFIRMARE'
                  : `ZONĂ ${analysis.opportunityDirection} ${analysis.opportunityScore}%`}""",
    """                {analysis.signal === 'NONE' && analysis.bias
                  ? 'ZONĂ DE CONFIRMARE'
                  : analysis.signal === 'NONE' && analysis.opportunityScore < 64
                    ? `OBSERVAȚIE ${analysis.opportunityDirection} ${analysis.opportunityScore}%`
                    : `ZONĂ ${analysis.opportunityDirection} ${analysis.opportunityScore}%`}""",
    'text badge oportunitate moderată',
)

app = replace_once(
    app,
    "              <Text style={styles.statusText}>{analysis.state === 'WAIT' ? 'Scor structură' : 'Probabilitate'}: {analysis.state === 'INVALID' ? '—' : `${analysis.probability}%`}</Text>",
    "              <Text style={styles.statusText}>{analysis.signal === 'NONE' || analysis.state === 'WAIT' ? 'Scor structură' : 'Probabilitate'}: {analysis.state === 'INVALID' ? '—' : `${analysis.probability}%`}</Text>",
    'scor structură și pentru NONE',
)

APP.write_text(app, encoding='utf-8')
print('Patch v0.3.46 aplicat: oportunitățile sub 60% sunt ascunse, 60–63% devin OBSERVAȚIE, iar NONE folosește Scor structură.')
