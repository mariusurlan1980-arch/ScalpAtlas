from pathlib import Path

APP = Path('scalp-atlas-new/App.tsx')
ENGINE = Path('scalp-atlas-new/analysisEngine.ts')


def replace_once(text: str, old: str, new: str, label: str) -> str:
    if old not in text:
        raise SystemExit(f'{label}: fragmentul așteptat nu a fost găsit; build oprit pentru siguranță.')
    return text.replace(old, new, 1)


# v0.3.32 — PRECISE CHANNEL POSITION
# Test AED/CNY M10: canalul orizontal era detectat corect, dar ultima lumânare
# era vizual în jumătatea superioară, iar aplicația o eticheta generic „zona mediană”.
# Corecție:
# - poziția curentă folosește centrul real al ultimei lumânări (lo/hi), nu punctul netezit;
# - 3 zone devin 5 zone mai precise: margine superioară / median-superioară /
#   mediană / median-inferioară / margine inferioară;
# - logica BUY/SELL/WAIT și scorurile rămân neschimbate.

app = APP.read_text(encoding='utf-8')
app = replace_once(
    app,
    "            <Text style={styles.versionBadge}>v0.3.31 TEST</Text>",
    "            <Text style={styles.versionBadge}>v0.3.32 TEST</Text>",
    'badge v0.3.32',
)
APP.write_text(app, encoding='utf-8')

engine = ENGINE.read_text(encoding='utf-8')
engine = replace_once(
    engine,
    "const ENGINE_VERSION='0.3.19';",
    "const ENGINE_VERSION='0.3.20';",
    'engine version 0.3.20',
)

engine = replace_once(
    engine,
    """    const anchor=curve.anchor||sample[sample.length-1];
    const upperNow=upperAt(anchor.x),lowerNow=lowerAt(anchor.x);
    const ratio=Math.max(0,Math.min(1,(anchor.y-upperNow)/Math.max(1,lowerNow-upperNow)));
    const zone=ratio<=.33?'zona superioară':ratio>=.67?'zona inferioară':'zona mediană';""",
    """    const anchor=curve.anchor||sample[sample.length-1];
    const upperNow=upperAt(anchor.x),lowerNow=lowerAt(anchor.x);
    // Folosim centrul real al ultimei lumânări, nu y-ul netezit al curbei.
    const currentY=Number.isFinite(anchor.lo)&&Number.isFinite(anchor.hi)
      ? (anchor.lo+anchor.hi)/2
      : anchor.y;
    const ratio=Math.max(0,Math.min(1,(currentY-upperNow)/Math.max(1,lowerNow-upperNow)));
    const zone=ratio<=.20
      ? 'aproape de marginea superioară'
      : ratio<=.42
        ? 'zona median-superioară'
        : ratio<.58
          ? 'zona mediană'
          : ratio<.80
            ? 'zona median-inferioară'
            : 'aproape de marginea inferioară';""",
    'poziție precisă în culoar cu 5 zone',
)

ENGINE.write_text(engine, encoding='utf-8')
print('Patch v0.3.32 aplicat: poziția în Culoarul Lumânărilor folosește ultima lumânare reală și 5 zone mai precise; logica de semnal rămâne neschimbată.')
