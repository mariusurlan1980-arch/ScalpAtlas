from pathlib import Path

APP = Path('scalp-atlas-new/App.tsx')
ENGINE = Path('scalp-atlas-new/analysisEngine.ts')


def replace_once(text: str, old: str, new: str, label: str) -> str:
    if old not in text:
        raise SystemExit(f'{label}: fragmentul așteptat nu a fost găsit; build oprit pentru siguranță.')
    return text.replace(old, new, 1)


# v0.3.43 — FAST ANALYSIS + WATCHDOG
# Motiv: pe telefoane cu CPU/RAM modest analiza poate rămâne mult timp pe "ANALIZEZ..."
# chiar dacă Motorul Atlas este deja PREGĂTIT. Analiza este locală; conexiunea la internet
# nu influențează viteza.
#
# Optimizări:
# - imaginea internă de analiză: 600px -> 480px;
# - 64 -> 48 coloane de eșantionare;
# - pas pixeli 2 -> 3;
# - watchdog 15 secunde: interfața nu mai poate rămâne blocată nelimitat;
# - logica BUY/SELL/WAIT și cele 70 de modele rămân neschimbate.

app = APP.read_text(encoding='utf-8')
app = replace_once(
    app,
    "            <Text style={styles.versionBadge}>v0.3.42 TEST</Text>",
    "            <Text style={styles.versionBadge}>v0.3.43 TEST</Text>",
    'badge v0.3.43',
)

app = replace_once(
    app,
    "  const analyzerRef = useRef<WebView>(null);",
    "  const analyzerRef = useRef<WebView>(null);\n  const analysisTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);",
    'watchdog ref',
)

app = replace_once(
    app,
    """    setMessage(`Analizez fotografia pe ${timeframe} cu atlasul de ${SCALP_ATLAS_COUNT} modele…`);
    analyzerRef.current.postMessage(
      JSON.stringify({ type: 'ANALYZE', dataUrl: `data:image/jpeg;base64,${image.base64}`, timeframe })
    );""",
    """    setMessage(`Analizez fotografia pe ${timeframe} cu atlasul de ${SCALP_ATLAS_COUNT} modele…`);
    if (analysisTimeoutRef.current) clearTimeout(analysisTimeoutRef.current);
    analysisTimeoutRef.current = setTimeout(() => {
      setBusy(false);
      setRemainingSeconds(0);
      setMessage('Analiza a depășit 15 secunde. Apasă din nou ANALIZEAZĂ; motorul a fost eliberat automat.');
    }, 15000);
    analyzerRef.current.postMessage(
      JSON.stringify({ type: 'ANALYZE', dataUrl: `data:image/jpeg;base64,${image.base64}`, timeframe })
    );""",
    'pornire watchdog',
)

app = replace_once(
    app,
    """      if (payload.type === 'RESULT') {
        const result = payload.result as AnalysisResult;""",
    """      if (payload.type === 'RESULT') {
        if (analysisTimeoutRef.current) {
          clearTimeout(analysisTimeoutRef.current);
          analysisTimeoutRef.current = null;
        }
        const result = payload.result as AnalysisResult;""",
    'oprire watchdog la rezultat',
)

app = replace_once(
    app,
    """      if (payload.type === 'ERROR') {
        setBusy(false);""",
    """      if (payload.type === 'ERROR') {
        if (analysisTimeoutRef.current) {
          clearTimeout(analysisTimeoutRef.current);
          analysisTimeoutRef.current = null;
        }
        setBusy(false);""",
    'oprire watchdog la eroare',
)

APP.write_text(app, encoding='utf-8')

engine = ENGINE.read_text(encoding='utf-8')
engine = replace_once(
    engine,
    "const ENGINE_VERSION='0.3.24';",
    "const ENGINE_VERSION='0.3.25';",
    'engine version 0.3.25',
)
engine = replace_once(
    engine,
    "    const maxW=600,scale=Math.min(1,maxW/iw);",
    "    const maxW=480,scale=Math.min(1,maxW/iw);",
    'analiză 480px',
)
engine = replace_once(
    engine,
    "    const bins=64,binW=(x1-x0)/bins,pts=[];",
    "    const bins=48,binW=(x1-x0)/bins,pts=[];",
    '48 bin-uri',
)
engine = replace_once(
    engine,
    "      for(let x=bx0;x<bx1;x+=2){\n        for(let y=y0;y<y1;y+=2){",
    "      for(let x=bx0;x<bx1;x+=3){\n        for(let y=y0;y<y1;y+=3){",
    'eșantionare pixeli pas 3',
)

ENGINE.write_text(engine, encoding='utf-8')
print('Patch v0.3.43 aplicat: analiză locală mai rapidă + watchdog 15 secunde, fără schimbarea logicii de semnal.')
