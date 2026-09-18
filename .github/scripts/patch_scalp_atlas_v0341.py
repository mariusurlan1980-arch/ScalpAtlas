from pathlib import Path

APP = Path('scalp-atlas-new/App.tsx')
ENGINE = Path('scalp-atlas-new/analysisEngine.ts')


def replace_once(text: str, old: str, new: str, label: str) -> str:
    if old not in text:
        raise SystemExit(f'{label}: fragmentul așteptat nu a fost găsit; build oprit pentru siguranță.')
    return text.replace(old, new, 1)


app = APP.read_text(encoding='utf-8')

# v0.3.41 — FAST CORE
# Feedback: aplicația se mișcă greu pe telefon.
# Optimizări fără schimbarea logicii BUY/SELL/WAIT:
# - OCR timeframe nu mai ține interfața blocată;
# - motorul WebView pornește doar după prima fotografie și rămâne pregătit;
# - butonul ANALIZEAZĂ arată explicit când OCR/motorul încă se pregătesc;
# - JPEG mai compact pentru RAM/base64;
# - analiza internă lucrează la max. 600 px în loc de 720 px.

app = replace_once(
    app,
    "  const [engineReady, setEngineReady] = useState(false);",
    "  const [engineReady, setEngineReady] = useState(false);\n  const [timeframeDetecting, setTimeframeDetecting] = useState(false);",
    'state OCR',
)

app = replace_once(
    app,
    "    setMessage('Citesc automat timeframe-ul afișat de broker…');",
    "    setTimeframeDetecting(Platform.OS !== 'web');\n    setMessage('Fotografia este gata. Citesc timeframe-ul în fundal…');",
    'OCR neblocant',
)

app = replace_once(
    app,
    "    } catch {\n      setMessage('Citirea automată a timeframe-ului nu a reușit. Verifică selectorul înainte de analiză.');\n    }\n  };",
    "    } catch {\n      setMessage('Citirea automată a timeframe-ului nu a reușit. Verifică selectorul înainte de analiză.');\n    } finally {\n      setTimeframeDetecting(false);\n    }\n  };",
    'final OCR',
)

app = replace_once(
    app,
    "      if (!result.canceled && result.assets?.[0]) await useAsset(result.assets[0], 'camera');",
    "      if (!result.canceled && result.assets?.[0]) void useAsset(result.assets[0], 'camera');",
    'camera fără await OCR',
)

app = replace_once(
    app,
    "      if (!result.canceled && result.assets?.[0]) await useAsset(result.assets[0], 'gallery');",
    "      if (!result.canceled && result.assets?.[0]) void useAsset(result.assets[0], 'gallery');",
    'galerie fără await OCR',
)

app = app.replace("        quality: 0.55,", "        quality: 0.42,")

# v0.3.39 ținea WebView permanent. Îl facem lazy fără să resetăm engineReady
# la schimbarea fotografiei, deci nu reapare bugul de inițializare.
app = replace_once(
    app,
    "      {Platform.OS !== 'web' && (\n        <WebView",
    "      {Platform.OS !== 'web' && image && (\n        <WebView",
    'WebView lazy stabil',
)

app = replace_once(
    app,
    "          disabled={!image || busy}",
    "          disabled={!image || busy || !engineReady || timeframeDetecting}",
    'disabled pregătire',
)

app = replace_once(
    app,
    "          style={[styles.analyzeButton, (!image || busy) && styles.analyzeButtonDisabled]}",
    "          style={[styles.analyzeButton, (!image || busy || !engineReady || timeframeDetecting) && styles.analyzeButtonDisabled]}",
    'stil pregătire',
)

app = replace_once(
    app,
    "          <Text style={styles.analyzeText}>{busy ? 'ANALIZEZ…' : `ANALIZEAZĂ CU ${SCALP_ATLAS_COUNT} MODELE`}</Text>",
    "          <Text style={styles.analyzeText}>{busy ? 'ANALIZEZ…' : timeframeDetecting ? 'CITESC TIMEFRAME…' : !engineReady && image ? 'PREGĂTESC MOTORUL…' : `ANALIZEAZĂ CU ${SCALP_ATLAS_COUNT} MODELE`}</Text>",
    'text pregătire',
)

app = replace_once(
    app,
    "            <Text style={styles.versionBadge}>v0.3.40 TEST</Text>",
    "            <Text style={styles.versionBadge}>v0.3.41 TEST</Text>",
    'badge v0.3.41',
)

APP.write_text(app, encoding='utf-8')

engine = ENGINE.read_text(encoding='utf-8')
engine = replace_once(
    engine,
    "const ENGINE_VERSION='0.3.23';",
    "const ENGINE_VERSION='0.3.24';",
    'engine version 0.3.24',
)
engine = replace_once(
    engine,
    "    const maxW=720,scale=Math.min(1,maxW/iw);",
    "    const maxW=600,scale=Math.min(1,maxW/iw);",
    'analiză 600px',
)
ENGINE.write_text(engine, encoding='utf-8')

print('Patch v0.3.41 aplicat: interfață și analiză mai rapide, fără schimbarea logicii de semnal.')
