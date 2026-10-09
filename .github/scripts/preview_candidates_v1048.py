"""Scalp Atlas v1.0.48 non-tradable candidate diagnostic for M5/M10.

Shows which stage blocks all confirmed signals, without lowering the strict
signal rules or generating any new bip. The screen is for observation only.
Run AFTER the v1.0.47 M5 guard patch.
"""
from pathlib import Path

p=Path(".github/native-overlay/ScalpOverlayService.kt")
s=p.read_text(encoding="utf-8")

def one(old,new,label):
    global s
    n=s.count(old)
    if n!=1:
        raise SystemExit(f"v1048 {label}: expected exactly one occurrence, found {n}")
    s=s.replace(old,new,1)

one(
    '    val rawSignal = result.optString("signal", "NONE")\n',
    '''    val rawSignal = result.optString("signal", "NONE")
    // DIAGNOSTIC PREVIEW v1.0.48: NOT a trade instruction and NEVER a bip.
    // The engine's tentative vote direction is distinct from rawSignal.
    val previewDir = result.optString("candidateDirection", "NONE")
    val previewLabel = when (previewDir) {
      "BUY" -> "CANDIDAT CUMPĂRARE"
      "SELL" -> "CANDIDAT VÂNZARE"
      else -> "AȘTEAPTĂ"
    }
''',
    "candidate payload"
)
one(
    '''        "AȘTEAPTĂ",
        "NU INTRA • $currentTimeframe / 5 min • protecție timp",
        timingRejection
''',
    '''        if (currentTimeframe == "AUTO") "AȘTEAPTĂ" else previewLabel,
        "NECONFIRMAT • NU INTRA • FĂRĂ BIP • $currentTimeframe / 5 min",
        timingRejection
''',
    "chart timing rejection diagnostic"
)
one(
    '''        "AȘTEAPTĂ",
        "$currentPair • $currentTimeframe • fără direcție verificată",
        if (reason.isNotBlank()) reason else pattern
''',
    '''        if (currentTimeframe == "AUTO") "AȘTEAPTĂ" else previewLabel,
        "$currentPair • $currentTimeframe • NECONFIRMAT • NU INTRA • FĂRĂ BIP",
        if (reason.isNotBlank()) reason else "Nu există încă un semnal confirmat"
''',
    "none result diagnostic"
)
one(
    '''        "AȘTEAPTĂ",
        "NU INTRA • pereche sau lumânare M5/M10 neconfirmată",
        "Identificarea lumânării și a perechii este necesară"
''',
    '''        previewLabel,
        "NECONFIRMAT • NU INTRA • FĂRĂ BIP",
        "Nu pot confirma perechea, cronometrul sau lumânarea M5/M10"
''',
    "bar key unavailable preview"
)
# Always make the diagnostics unmistakably different from real calls.
# Colors follow the existing yellow WAIT styling; previews never start BUY/SELL.
if s.count("DIAGNOSTIC PREVIEW v1.0.48")!=1:
    raise SystemExit("v1048 preview marker missing")
if 'playBip()' not in s:
    raise SystemExit("v1048 must not delete the original sound routine")
p.write_text(s,encoding="utf-8")
print("v1.0.48 non-tradable candidate diagnostic displayed without new BIP")
