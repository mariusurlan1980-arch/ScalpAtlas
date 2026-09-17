from pathlib import Path

APP = Path('scalp-atlas-new/App.tsx')
ENGINE = Path('scalp-atlas-new/analysisEngine.ts')


def replace_once(text: str, old: str, new: str, label: str) -> str:
    if old not in text:
        raise SystemExit(f'{label}: fragmentul așteptat nu a fost găsit; build oprit pentru siguranță.')
    return text.replace(old, new, 1)


# v0.3.33 — CHANNEL ZONE SENSITIVITY TUNE
# Test EUR/CHF M10: ultima lumânare era deja vizibil în jumătatea inferioară,
# dar eticheta rămânea „zona mediană”.
# Corecție:
# - îngustăm zona mediană la centrul real al canalului;
# - „zona median-inferioară” începe puțin mai devreme;
# - simetric, „zona median-superioară” este și ea mai sensibilă;
# - nu modificăm BUY/SELL/WAIT, scorurile sau liniile canalului.

app = APP.read_text(encoding='utf-8')
app = replace_once(
    app,
    "            <Text style={styles.versionBadge}>v0.3.32 TEST</Text>",
    "            <Text style={styles.versionBadge}>v0.3.33 TEST</Text>",
    'badge v0.3.33',
)
APP.write_text(app, encoding='utf-8')

engine = ENGINE.read_text(encoding='utf-8')
engine = replace_once(
    engine,
    "const ENGINE_VERSION='0.3.20';",
    "const ENGINE_VERSION='0.3.21';",
    'engine version 0.3.21',
)

engine = replace_once(
    engine,
    """    const zone=ratio<=.20
      ? 'aproape de marginea superioară'
      : ratio<=.42
        ? 'zona median-superioară'
        : ratio<.58
          ? 'zona mediană'
          : ratio<.80
            ? 'zona median-inferioară'
            : 'aproape de marginea inferioară';""",
    """    const zone=ratio<=.18
      ? 'aproape de marginea superioară'
      : ratio<=.46
        ? 'zona median-superioară'
        : ratio<.54
          ? 'zona mediană'
          : ratio<.82
            ? 'zona median-inferioară'
            : 'aproape de marginea inferioară';""",
    'sensibilitate poziție în culoar',
)

ENGINE.write_text(engine, encoding='utf-8')
print('Patch v0.3.33 aplicat: zona mediană este mai îngustă, iar median-superioară / median-inferioară reacționează mai devreme; logica de semnal rămâne neschimbată.')
