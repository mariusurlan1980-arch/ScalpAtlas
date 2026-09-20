from pathlib import Path

APP = Path('scalp-atlas-new/App.tsx')


def replace_once(text: str, old: str, new: str, label: str) -> str:
    if old not in text:
        raise SystemExit(f'{label}: fragmentul așteptat nu a fost găsit; build oprit pentru siguranță.')
    return text.replace(old, new, 1)


# v0.3.42 — CONFIRMATION CONSISTENCY
# Feedback din testare:
# - când rezultatul este WAIT / AȘTEAPTĂ CONFIRMAREA, eticheta de pe grafic
#   nu trebuie să pară deja un semnal BUY/SELL;
# - scorul oportunității nu trebuie să concureze vizual cu probabilitatea principală;
# - BUY/SELL, probabilitatea principală și expirarea rămân neschimbate.
#
# Corecție exclusiv de prezentare:
# - WAIT + bias -> "ZONĂ DE CONFIRMARE" (fără al doilea procent);
# - eticheta WAIT este galbenă/neutră, nu verde/roșie;
# - cardul oportunității folosește aceeași regulă;
# - când există semnal confirmat, comportamentul ZONĂ BUY/SELL rămâne disponibil.

app = APP.read_text(encoding='utf-8')

app = replace_once(
    app,
    "            <Text style={styles.versionBadge}>v0.3.41 TEST</Text>",
    "            <Text style={styles.versionBadge}>v0.3.42 TEST</Text>",
    'badge v0.3.42',
)

app = replace_once(
    app,
    """                  <Text style={[styles.opportunityTitle, analysis.opportunityDirection === 'BUY' ? styles.buy : styles.sell]}>
                    ZONĂ {analysis.opportunityDirection} • {analysis.opportunityScore}%
                  </Text>""",
    """                  <Text style={[
                    styles.opportunityTitle,
                    analysis.signal === 'NONE' && analysis.bias
                      ? styles.confirmationZone
                      : analysis.opportunityDirection === 'BUY' ? styles.buy : styles.sell,
                  ]}>
                    {analysis.signal === 'NONE' && analysis.bias
                      ? 'ZONĂ DE CONFIRMARE'
                      : `ZONĂ ${analysis.opportunityDirection} • ${analysis.opportunityScore}%`}
                  </Text>""",
    'card oportunitate coerent în WAIT',
)

app = replace_once(
    app,
    """              <Text style={[styles.opportunityChartText, analysis.opportunityDirection === 'BUY' ? styles.buy : styles.sell]}>
                ZONĂ {analysis.opportunityDirection} {analysis.opportunityScore}%
              </Text>""",
    """              <Text style={[
                styles.opportunityChartText,
                analysis.signal === 'NONE' && analysis.bias
                  ? styles.confirmationZone
                  : analysis.opportunityDirection === 'BUY' ? styles.buy : styles.sell,
              ]}>
                {analysis.signal === 'NONE' && analysis.bias
                  ? 'ZONĂ DE CONFIRMARE'
                  : `ZONĂ ${analysis.opportunityDirection} ${analysis.opportunityScore}%`}
              </Text>""",
    'eticheta de pe grafic coerentă în WAIT',
)

style_marker = "  opportunityChartText: { fontSize: 10, lineHeight: 12, fontWeight: '900', letterSpacing: 0.05 },"
style_replacement = """  opportunityChartText: { fontSize: 10, lineHeight: 12, fontWeight: '900', letterSpacing: 0.05 },
  confirmationZone: { color: '#ffd34d' },"""
app = replace_once(app, style_marker, style_replacement, 'stil zonă confirmare')

APP.write_text(app, encoding='utf-8')
print('Patch v0.3.42 aplicat: WAIT afișează ZONĂ DE CONFIRMARE fără procent secundar; BUY/SELL confirmat rămâne neschimbat.')
