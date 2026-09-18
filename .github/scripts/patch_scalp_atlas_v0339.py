from pathlib import Path

APP = Path('scalp-atlas-new/App.tsx')


def replace_once(text: str, old: str, new: str, label: str) -> str:
    if old not in text:
        raise SystemExit(f'{label}: fragmentul așteptat nu a fost găsit; build oprit pentru siguranță.')
    return text.replace(old, new, 1)


app = APP.read_text(encoding='utf-8')

# v0.3.39 — ENGINE READY FIX
# Repară blocarea "Motorul Atlas se inițializează":
# - WebView-ul motorului pornește din nou imediat la deschiderea aplicației;
# - schimbarea fotografiei nu mai resetează engineReady la false;
# - motorul BUY/SELL/WAIT și regulile de analiză rămân neschimbate.

app = replace_once(
    app,
    "      {Platform.OS !== 'web' && image && (\n        <WebView",
    "      {Platform.OS !== 'web' && (\n        <WebView",
    'WebView permanent mount',
)

app = replace_once(
    app,
    "    setAnalysis(null);\n    setEngineReady(false);\n    setRemainingSeconds(0);",
    "    setAnalysis(null);\n    setRemainingSeconds(0);",
    'nu reseta engineReady la imagine nouă',
)

app = replace_once(
    app,
    "            <Text style={styles.versionBadge}>v0.3.38 TEST</Text>",
    "            <Text style={styles.versionBadge}>v0.3.39 TEST</Text>",
    'badge v0.3.39',
)

APP.write_text(app, encoding='utf-8')
print('Patch v0.3.39 aplicat: motorul WebView pornește la lansarea aplicației și nu mai rămâne blocat în INIȚIALIZARE după selectarea unei imagini.')
