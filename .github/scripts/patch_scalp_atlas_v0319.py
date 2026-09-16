from pathlib import Path

APP = Path('scalp-atlas-new/App.tsx')
ENGINE = Path('scalp-atlas-new/analysisEngine.ts')


def replace_once(text: str, old: str, new: str, label: str) -> str:
    if old not in text:
        raise SystemExit(f'{label}: fragmentul așteptat nu a fost găsit; build oprit pentru siguranță.')
    return text.replace(old, new, 1)


# v0.3.19 rulează DUPĂ v0.3.18.
# Corecție după retestarea TND/USD OTC M10:
# - v0.3.18 nu bloca întotdeauna BUY când prețul era încă prea aproape de maximul local;
# - folosim acum extremitatea lumânării curente (wick), nu centrul ei;
# - banda de proximitate devine dinamică, raportată la mărimea recentă a lumânărilor;
# - breakout-ul cere depășire reală a nivelului, nu doar apropiere.

app = APP.read_text(encoding='utf-8')
app = replace_once(
    app,
    "            <Text style={styles.versionBadge}>v0.3.18 TEST</Text>",
    "            <Text style={styles.versionBadge}>v0.3.19 TEST</Text>",
    'badge v0.3.19',
)
APP.write_text(app, encoding='utf-8')

engine = ENGINE.read_text(encoding='utf-8')
engine = replace_once(
    engine,
    "const ENGINE_VERSION='0.3.6';",
    "const ENGINE_VERSION='0.3.7';",
    'engine version 0.3.7',
)

old_guard = """    const buyNearRecentResistance=Number.isFinite(recentResistanceY)&&
      end.y>=recentResistanceY-h*.008&&end.y<=recentResistanceY+h*.045;
    const sellNearRecentSupport=Number.isFinite(recentSupportY)&&
      end.y<=recentSupportY+h*.008&&end.y>=recentSupportY-h*.045;

    const confirmedAboveRecentResistance=Number.isFinite(recentResistanceY)&&
      end.y<recentResistanceY-h*.014&&recentNorm>.035&&microNorm>.02;
    const confirmedBelowRecentSupport=Number.isFinite(recentSupportY)&&
      end.y>recentSupportY+h*.014&&recentNorm<-.035&&microNorm<-.02;"""

new_guard = """    // v0.3.19 — proximitate dinamică față de ultimul maxim/minim local.
    // Folosim wick-ul curent (candleHigh/candleLow), nu centrul lumânării. Astfel un BUY
    // aflat încă sub rezistență este blocat chiar dacă centrul lumânării pare mai departe.
    const localMedianSpan=localWindow.length?median(localWindow.map(p=>p.span)):h*.015;
    const proximityBand=Math.max(h*.055,Math.min(h*.095,localMedianSpan*4.2));
    const breakoutMargin=Math.max(h*.012,Math.min(h*.028,localMedianSpan*.75));

    const buyNearRecentResistance=Number.isFinite(recentResistanceY)&&
      candleHigh>=recentResistanceY-h*.006&&candleHigh<=recentResistanceY+proximityBand;
    const sellNearRecentSupport=Number.isFinite(recentSupportY)&&
      candleLow<=recentSupportY+h*.006&&candleLow>=recentSupportY-proximityBand;

    const confirmedAboveRecentResistance=Number.isFinite(recentResistanceY)&&
      candleHigh<recentResistanceY-breakoutMargin&&recentNorm>.035&&microNorm>.02;
    const confirmedBelowRecentSupport=Number.isFinite(recentSupportY)&&
      candleLow>recentSupportY+breakoutMargin&&recentNorm<-.035&&microNorm<-.02;"""

engine = replace_once(engine, old_guard, new_guard, 'gardă dinamică rezistență/suport v0.3.19')

engine = engine.replace(
    "atlas:'Canal Ascendent – rezistență locală',idx:0,",
    "atlas:'Canal Ascendent – rezistență apropiată',idx:0,",
    1,
)
engine = engine.replace(
    "reason:'BUY este prea aproape de maximul local recent. Așteaptă închiderea unei lumânări peste linia galbenă înainte de intrare.'",
    "reason:'BUY are spațiu insuficient până la maximul local recent. Așteaptă o închidere clară peste linia galbenă înainte de intrare.'",
    1,
)
engine = engine.replace(
    "atlas:'Canal Descendent – suport local',idx:0,",
    "atlas:'Canal Descendent – suport apropiat',idx:0,",
    1,
)
engine = engine.replace(
    "reason:'SELL este prea aproape de minimul local recent. Așteaptă închiderea unei lumânări sub linia galbenă înainte de intrare.'",
    "reason:'SELL are spațiu insuficient până la minimul local recent. Așteaptă o închidere clară sub linia galbenă înainte de intrare.'",
    1,
)

ENGINE.write_text(engine, encoding='utf-8')
print('Patch v0.3.19 aplicat: proximity guard dinamic pe wick + breakout mai strict pentru BUY/SELL lângă rezistență/suport.')