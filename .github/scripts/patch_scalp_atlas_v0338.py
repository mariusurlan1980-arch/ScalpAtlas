from pathlib import Path
import re

APP = Path('scalp-atlas-new/App.tsx')


def replace_once(text: str, old: str, new: str, label: str) -> str:
    if old not in text:
        raise SystemExit(f'{label}: fragmentul așteptat nu a fost găsit; build oprit pentru siguranță.')
    return text.replace(old, new, 1)


app = APP.read_text(encoding='utf-8')

# v0.3.38 — SIMPLIFY / REMOVE PLATFORM HUB
# Renunțăm complet la pagina suplimentară „PE TOATE PLATFORMELE”.
# Păstrăm aplicația principală, motorul BUY/SELL/WAIT și optimizările de performanță v0.3.36.

# Elimină secțiunea vizuală Platform Hub din finalul ScrollView.
start = "        <View style={styles.platformHub}>"
end = "\n      </ScrollView>"
i = app.find(start)
j = app.find(end, i)
if i < 0 or j < 0:
    raise SystemExit('Secțiunea Platform Hub nu a fost găsită pentru eliminare.')
app = app[:i] + app[j:]

# Elimină lista de platforme, acum nefolosită.
app, count = re.subn(
    r"\nconst PLATFORM_HUB = \[.*?\n\] as const;\n",
    "\n",
    app,
    count=1,
    flags=re.S,
)
if count != 1:
    raise SystemExit('Constanta PLATFORM_HUB nu a fost găsită exact o dată.')

# Elimină funcțiile aferente Platform Hub.
app, count = re.subn(
    r"\n\s*const openPlatform = async \(url: string, name: string\) => \{.*?\n\s*const shareScalpAtlas = async \(\) => \{.*?\n\s*\};\n",
    "\n",
    app,
    count=1,
    flags=re.S,
)
if count != 1:
    raise SystemExit('Funcțiile Platform Hub nu au fost găsite exact o dată.')

# Elimină stilurile Platform Hub.
app, count = re.subn(
    r"  platformHub: \{.*?\n  worldwideText: .*?\n",
    "",
    app,
    count=1,
    flags=re.S,
)
if count != 1:
    raise SystemExit('Stilurile Platform Hub nu au fost găsite exact o dată.')

# Curăță importurile Linking/Share introduse doar pentru pagina eliminată.
app = app.replace("  Linking,\n  Share,\n", "")

# Actualizează badge-ul.
app = replace_once(
    app,
    "            <Text style={styles.versionBadge}>v0.3.37 TEST</Text>",
    "            <Text style={styles.versionBadge}>v0.3.38 TEST</Text>",
    'badge v0.3.38',
)

APP.write_text(app, encoding='utf-8')
print('Patch v0.3.38 aplicat: Platform Hub eliminat complet; rămâne aplicația principală simplificată, cu motorul și optimizările păstrate.')
