from pathlib import Path

SERVICE = Path(".github/native-overlay/ScalpOverlayService.kt")
s = SERVICE.read_text(encoding="utf-8")

# v1.0.37 — Romanian-facing signal labels only.
# Internal engine values remain BUY/SELL so analysis behavior is untouched.

marker = '''  private fun formatSeconds(total: Long): String {
'''
helper = '''  private fun signalLabel(signal: String): String =
    when (signal) {
      "BUY" -> "CUMPĂRARE"
      "SELL" -> "VÂNZARE"
      else -> signal
    }

'''
if "private fun signalLabel" not in s:
    if marker not in s:
        raise SystemExit("formatSeconds marker not found")
    s = s.replace(marker, helper + marker, 1)

s = s.replace(
    '          currentLock,\n          "CONFIRMAT " + REQUIRED_CONFIRMATIONS + "/" + REQUIRED_CONFIRMATIONS +',
    '          signalLabel(currentLock),\n          "CONFIRMAT " + REQUIRED_CONFIRMATIONS + "/" + REQUIRED_CONFIRMATIONS +',
    1
)

s = s.replace(
    '        "NU INTRA • BUY/SELL apare numai la CONFIRMAT " +',
    '        "NU INTRA • CUMPĂRARE/VÂNZARE apare numai la CONFIRMAT " +',
)

s = s.replace(
    '        "Candidat " + candidateDir + " • Confirmare " + candidateCount + "/" + REQUIRED_CONFIRMATIONS,',
    '        "Candidat " + signalLabel(candidateDir ?: "") + " • Confirmare " + candidateCount + "/" + REQUIRED_CONFIRMATIONS,',
)

s = s.replace(
    '        "Candidat " + rawSignal + " • Confirmare " + candidateCount + "/" + REQUIRED_CONFIRMATIONS,',
    '        "Candidat " + signalLabel(rawSignal) + " • Confirmare " + candidateCount + "/" + REQUIRED_CONFIRMATIONS,',
)

s = s.replace(
    '''    updateOverlay(
      rawSignal,
      "CONFIRMAT " + REQUIRED_CONFIRMATIONS + "/" + REQUIRED_CONFIRMATIONS + " • Scor " + score + "%",
''',
    '''    updateOverlay(
      signalLabel(rawSignal),
      "CONFIRMAT " + REQUIRED_CONFIRMATIONS + "/" + REQUIRED_CONFIRMATIONS + " • Scor " + score + "%",
''',
    1
)

old_color = '''          signal.startsWith("BUY") -> Color.rgb(52, 218, 148)
          signal.startsWith("SELL") -> Color.rgb(255, 88, 96)
'''
new_color = '''          signal.startsWith("BUY") || signal.startsWith("CUMPĂRARE") -> Color.rgb(52, 218, 148)
          signal.startsWith("SELL") || signal.startsWith("VÂNZARE") -> Color.rgb(255, 88, 96)
'''
if old_color not in s:
    raise SystemExit("signal color marker not found")
s = s.replace(old_color, new_color, 1)

SERVICE.write_text(s, encoding="utf-8")
print("v1.0.37 Romanian signal labels applied; engine remains BUY/SELL internally")
