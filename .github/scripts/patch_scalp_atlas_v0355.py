from pathlib import Path

APP = Path('scalp-atlas-new/App.tsx')


def replace_once(text: str, old: str, new: str, label: str) -> str:
    if old not in text:
        raise SystemExit(f'{label}: fragmentul așteptat nu a fost găsit; build oprit pentru siguranță.')
    return text.replace(old, new, 1)


# v0.3.55 — SYNC WAIT TITLE WITH CONFIRMATION DIRECTION
# Feedback:
# - badge-ul de pe grafic spune CONFIRMARE SELL / BUY;
# - cardul mare spune generic AȘTEAPTĂ CONFIRMAREA;
# - cele două mesaje trebuie să spună aceeași direcție.
#
# Corecție exclusiv vizuală:
# - WAIT + BUY => "AȘTEAPTĂ CONFIRMARE BUY" în verde;
# - WAIT + SELL => "AȘTEAPTĂ CONFIRMARE SELL" în roșu;
# - WAIT neutru => "AȘTEAPTĂ CONFIRMAREA" rămâne galben;
# - motorul și cele 70 de modele rămân neschimbate.

app = APP.read_text(encoding='utf-8')

app = replace_once(
    app,
    "            <Text style={styles.versionBadge}>v0.3.54 TEST</Text>",
    "            <Text style={styles.versionBadge}>v0.3.55 TEST</Text>",
    'badge v0.3.55',
)

app = replace_once(
    app,
    """                analysis.state === 'WAIT' ? styles.wait : analysis.signal === 'BUY' ? styles.buy : analysis.signal === 'SELL' ? styles.sell : styles.neutral,""",
    """                analysis.state === 'WAIT'
                  ? (analysis.bias === 'BUY' ? styles.buy : analysis.bias === 'SELL' ? styles.sell : styles.wait)
                  : analysis.signal === 'BUY' ? styles.buy : analysis.signal === 'SELL' ? styles.sell : styles.neutral,""",
    'culoare WAIT sincronizată cu direcția',
)

app = replace_once(
    app,
    """                {analysis.state === 'WAIT' ? 'AȘTEAPTĂ CONFIRMAREA' : analysis.state === 'INVALID' ? 'FOTOGRAFIE DEJA ANALIZATĂ' : analysis.signal === 'NONE' ? 'FĂRĂ SEMNAL CLAR' : analysis.signal}""",
    """                {analysis.state === 'WAIT'
                  ? (analysis.bias ? `AȘTEAPTĂ CONFIRMARE ${analysis.bias}` : 'AȘTEAPTĂ CONFIRMAREA')
                  : analysis.state === 'INVALID'
                    ? 'FOTOGRAFIE DEJA ANALIZATĂ'
                    : analysis.signal === 'NONE'
                      ? 'FĂRĂ SEMNAL CLAR'
                      : analysis.signal}""",
    'titlu WAIT sincronizat cu direcția',
)

APP.write_text(app, encoding='utf-8')
print('Patch v0.3.55 aplicat: cardul WAIT spune explicit AȘTEAPTĂ CONFIRMARE BUY/SELL și folosește aceeași culoare ca badge-ul de pe grafic.')
