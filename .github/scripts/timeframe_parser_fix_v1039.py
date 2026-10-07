from pathlib import Path
import re

SERVICE = Path(".github/native-overlay/ScalpOverlayService.kt")
s = SERVICE.read_text(encoding="utf-8")

pattern = re.compile(
    r'''  private fun normalizeTimeframe\(text: String\): String\? \{.*?\n  \}\n''',
    re.S,
)

replacement = r'''  private fun normalizeTimeframe(text: String): String? {
    // v1.0.39: păstrăm spațiile/separatorii OCR.
    // Înainte, "M5 01:08" devenea "M501:08", iar limita regex după M5 dispărea.
    // Asta lăsa overlay-ul blocat pe AUTO chiar dacă M5/M10 era vizibil pe grafic.
    val normalized = text
      .uppercase()
      .replace('\n', ' ')
      .replace('\r', ' ')

    val patterns = listOf(
      "M30" to Regex("(?:^|[^A-Z0-9])M\\s*3\\s*[0O](?=[^A-Z0-9]|$)"),
      "M15" to Regex("(?:^|[^A-Z0-9])M\\s*[1I]\\s*[5S](?=[^A-Z0-9]|$)"),
      "M10" to Regex("(?:^|[^A-Z0-9])M\\s*[1I]\\s*[0O](?=[^A-Z0-9]|$)"),
      "M5"  to Regex("(?:^|[^A-Z0-9])M\\s*[5S](?=[^A-Z0-9]|$)"),
      "M3"  to Regex("(?:^|[^A-Z0-9])M\\s*3(?=[^A-Z0-9]|$)"),
      "M2"  to Regex("(?:^|[^A-Z0-9])M\\s*2(?=[^A-Z0-9]|$)"),
      "M1"  to Regex("(?:^|[^A-Z0-9])M\\s*[1I](?=[^A-Z0-9]|$)"),
      "H1"  to Regex("(?:^|[^A-Z0-9])H\\s*[1I](?=[^A-Z0-9]|$)")
    )
    return patterns.firstOrNull { it.second.containsMatchIn(normalized) }?.first
  }
'''

m = pattern.search(s)
if not m:
    raise SystemExit("normalizeTimeframe function not found")
s = s[:m.start()] + replacement + s[m.end():]

SERVICE.write_text(s, encoding="utf-8")
print("v1.0.39 timeframe parser fix applied")
