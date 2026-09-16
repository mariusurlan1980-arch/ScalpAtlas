from pathlib import Path
import json

APP = Path('scalp-atlas-new/App.tsx')
ENGINE = Path('scalp-atlas-new/analysisEngine.ts')
PKG = Path('scalp-atlas-new/package.json')
CFG = Path('scalp-atlas-new/app.json')


def replace_once(text: str, old: str, new: str, label: str) -> str:
    if old not in text:
        raise SystemExit(f'{label}: fragmentul așteptat nu a fost găsit; build oprit pentru siguranță.')
    return text.replace(old, new, 1)


# v0.3.23 rulează DUPĂ v0.3.22.
# Cerință: aplicația trebuie să urmeze automat timeframe-ul afișat de broker.
# - OCR local, pe telefon, citește M1/M2/M3/M5/M10/M15/M30/H1 din fotografia brokerului;
# - selectorul Scalp Atlas se mută automat pe timeframe-ul detectat;
# - dacă OCR nu găsește un timeframe valid, aplicația NU ghicește și păstrează selecția curentă;
# - analiza continuă să folosească exact timeframe-ul selectat/detectat.

# Dependență OCR nativă, offline, Expo Modules / ML Kit pe Android și Vision pe iOS.
pkg = json.loads(PKG.read_text(encoding='utf-8'))
pkg.setdefault('dependencies', {})['expo-ocr-kit'] = '^0.1.4'
PKG.write_text(json.dumps(pkg, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')

cfg = json.loads(CFG.read_text(encoding='utf-8'))
plugins = cfg.setdefault('expo', {}).setdefault('plugins', [])
if not any((isinstance(p, str) and p == 'expo-ocr-kit') or (isinstance(p, list) and p and p[0] == 'expo-ocr-kit') for p in plugins):
    plugins.append(['expo-ocr-kit', {'cameraPermission': 'SCALP ATLAS folosește camera pentru a citi timeframe-ul afișat de broker.'}])
CFG.write_text(json.dumps(cfg, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')

app = APP.read_text(encoding='utf-8')
app = replace_once(
    app,
    "import * as ImagePicker from 'expo-image-picker';",
    "import * as ImagePicker from 'expo-image-picker';\nimport { recognizeText } from 'expo-ocr-kit';",
    'import OCR',
)
app = replace_once(
    app,
    "            <Text style={styles.versionBadge}>v0.3.22 TEST</Text>",
    "            <Text style={styles.versionBadge}>v0.3.23 TEST</Text>",
    'badge v0.3.23',
)

old_tf = """const TIMEFRAMES = ['M1', 'M2', 'M3', 'M5', 'M10', 'M15', 'M30', 'H1'];"""
new_tf = """const TIMEFRAMES = ['M1', 'M2', 'M3', 'M5', 'M10', 'M15', 'M30', 'H1'];

const detectBrokerTimeframe = (ocrText: string): string | null => {
  const text = String(ocrText || '').toUpperCase();
  // Ordine de la cele mai lungi la cele mai scurte ca M1 să nu prindă M10/M15.
  const patterns: Array<[string, RegExp]> = [
    ['M30', /(?:^|[^A-Z0-9])M\\s*3[0O](?:[^A-Z0-9]|$)/],
    ['M15', /(?:^|[^A-Z0-9])M\\s*[1I][5S](?:[^A-Z0-9]|$)/],
    ['M10', /(?:^|[^A-Z0-9])M\\s*[1I][0O](?:[^A-Z0-9]|$)/],
    ['M5',  /(?:^|[^A-Z0-9])M\\s*[5S](?:[^A-Z0-9]|$)/],
    ['M3',  /(?:^|[^A-Z0-9])M\\s*3(?:[^A-Z0-9]|$)/],
    ['M2',  /(?:^|[^A-Z0-9])M\\s*2(?:[^A-Z0-9]|$)/],
    ['M1',  /(?:^|[^A-Z0-9])M\\s*[1I](?:[^A-Z0-9]|$)/],
    ['H1',  /(?:^|[^A-Z0-9])H\\s*[1I](?:[^A-Z0-9]|$)/],
  ];
  for (const [tf, pattern] of patterns) if (pattern.test(text)) return tf;
  return null;
};"""
app = replace_once(app, old_tf, new_tf, 'detector timeframe broker')

old_use_asset = """  const useAsset = (asset: ImagePicker.ImagePickerAsset, source: 'camera' | 'gallery') => {
    setImage({
      uri: asset.uri,
      width: asset.width,
      height: asset.height,
      fileName: asset.fileName,
      base64: asset.base64,
    });
    setAnalysis(null);
    setRemainingSeconds(0);
    setMessage(
      source === 'camera'
        ? 'Fotografie realizată. Apasă ANALIZEAZĂ.'
        : 'Fotografie încărcată din galerie. Apasă ANALIZEAZĂ.'
    );
  };"""

new_use_asset = """  const useAsset = async (asset: ImagePicker.ImagePickerAsset, source: 'camera' | 'gallery') => {
    setImage({
      uri: asset.uri,
      width: asset.width,
      height: asset.height,
      fileName: asset.fileName,
      base64: asset.base64,
    });
    setAnalysis(null);
    setRemainingSeconds(0);
    setMessage('Citesc automat timeframe-ul afișat de broker…');

    if (Platform.OS === 'web') {
      setMessage(
        source === 'camera'
          ? 'Fotografie realizată. Verifică timeframe-ul și apasă ANALIZEAZĂ.'
          : 'Fotografie încărcată. Verifică timeframe-ul și apasă ANALIZEAZĂ.'
      );
      return;
    }

    try {
      const ocr = await recognizeText(asset.uri);
      const brokerTf = detectBrokerTimeframe(ocr?.text || '');
      if (brokerTf && TIMEFRAMES.includes(brokerTf)) {
        setTimeframe(brokerTf);
        setMessage(`Timeframe detectat automat din broker: ${brokerTf}. Apasă ANALIZEAZĂ.`);
      } else {
        setMessage('Timeframe-ul brokerului nu a putut fi citit automat. Verifică selectorul înainte de analiză.');
      }
    } catch {
      setMessage('Citirea automată a timeframe-ului nu a reușit. Verifică selectorul înainte de analiză.');
    }
  };"""
app = replace_once(app, old_use_asset, new_use_asset, 'useAsset cu OCR timeframe')

app = replace_once(
    app,
    "          useAsset(result.assets[0], 'camera');",
    "          void useAsset(result.assets[0], 'camera');",
    'pending camera async OCR',
)
app = replace_once(
    app,
    "      if (!result.canceled && result.assets?.[0]) useAsset(result.assets[0], 'camera');",
    "      if (!result.canceled && result.assets?.[0]) await useAsset(result.assets[0], 'camera');",
    'camera await OCR',
)
app = replace_once(
    app,
    "      if (!result.canceled && result.assets?.[0]) useAsset(result.assets[0], 'gallery');",
    "      if (!result.canceled && result.assets?.[0]) await useAsset(result.assets[0], 'gallery');",
    'gallery await OCR',
)

# Mesajul galben devine explicit: selectorul se sincronizează automat când OCR reușește.
app = app.replace(
    "Atenție: timpul 00:10:00 din broker este durata tranzacției, nu timeframe-ul graficului. Selectează timeframe-ul numai după cel afișat pe grafic.",
    "Timeframe AUTO: aplicația citește M1/M2/M3/M5/M10/M15/M30/H1 direct din fotografia brokerului. Dacă nu îl poate citi sigur, verifică manual selectorul.",
    1,
)
APP.write_text(app, encoding='utf-8')

engine = ENGINE.read_text(encoding='utf-8')
engine = replace_once(
    engine,
    "const ENGINE_VERSION='0.3.10';",
    "const ENGINE_VERSION='0.3.11';",
    'engine version 0.3.11',
)
ENGINE.write_text(engine, encoding='utf-8')

print('Patch v0.3.23 aplicat: OCR local detectează timeframe-ul brokerului și sincronizează automat selectorul înainte de analiză.')
