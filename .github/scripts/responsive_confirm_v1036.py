from pathlib import Path

SERVICE = Path(".github/native-overlay/ScalpOverlayService.kt")
s = SERVICE.read_text(encoding="utf-8")

# v1.0.36 — keep the analysis engine strict, but make the confirmation layer responsive.
# Confirmed direction is still locked afterwards, so the opposite signal cannot flip immediately.
s = s.replace("private const val CONFIRMATION_SPACING_MS = 20000L",
              "private const val CONFIRMATION_SPACING_MS = 8000L", 1)
s = s.replace("private const val REQUIRED_CONFIRMATIONS = 3",
              "private const val REQUIRED_CONFIRMATIONS = 2", 1)

old = '''    val pattern = result.optString("pattern", "—")
'''
new = '''    val pattern = result.optString("pattern", "—")
    val reason = result.optString("reason", "")
'''
if old not in s:
    raise SystemExit("pattern marker not found")
s = s.replace(old, new, 1)

old_none = '''      updateOverlay(
        "AȘTEAPTĂ",
        "$currentPair • $currentTimeframe • fără semnal clar • Scor " + score + "%",
        pattern
      )
'''
new_none = '''      updateOverlay(
        "AȘTEAPTĂ",
        "$currentPair • $currentTimeframe • fără semnal clar • Scor " + score + "%",
        if (reason.isNotBlank()) reason else pattern
      )
'''
if old_none not in s:
    raise SystemExit("no-signal display marker not found")
s = s.replace(old_none, new_none, 1)

SERVICE.write_text(s, encoding="utf-8")
print("v1.0.36 responsive confirmation applied")
