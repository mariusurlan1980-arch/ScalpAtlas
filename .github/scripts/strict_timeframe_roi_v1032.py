from pathlib import Path

SERVICE = Path(".github/native-overlay/ScalpOverlayService.kt")
s = SERVICE.read_text(encoding="utf-8")

old = '''    fun applyDetectedTexts(rightText: String) {
      val combined = (leftText + " " + rightText).trim()
      val detectedTimeframe = normalizeTimeframe(combined)
      val detectedPair = normalizePair(combined)
      var changed = false
'''

new = '''    fun applyDetectedTexts(rightText: String) {
      // v1.0.32 STRICT TIMEFRAME ROI:
      // Perechea se citește din stânga, timeframe-ul EXCLUSIV din zona dreapta-mijloc
      // unde brokerul afișează M1/M5/M10 etc. Nu combinăm cele două zone.
      // Eliminăm și eventualul text propriu al overlay-ului din OCR ca să nu
      // se auto-confirme un timeframe vechi (ex. "SCALP ATLAS • M30").
      val cleanRightText = rightText
        .lines()
        .filterNot { line ->
          val u = line.uppercase()
          u.contains("SCALP") ||
            u.contains("ATLAS") ||
            u.contains("AȘTEAPTĂ") ||
            u.contains("PAUZĂ") ||
            u.contains("CANDIDAT") ||
            u.contains("CONFIRMAT") ||
            u.contains("NU INTRA")
        }
        .joinToString(" ")

      val detectedTimeframe = normalizeTimeframe(cleanRightText)
      val detectedPair = normalizePair(leftText)
      var changed = false
'''

if old not in s:
    raise SystemExit("applyDetectedTexts marker not found")
s = s.replace(old, new, 1)

# Narrow the right ROI slightly toward the price-axis timeframe label while still
# allowing layout differences across brokers.
old_roi = 'val (rightMidCrop, rightMidScaled) = cropAndScale(0.48f, 0.38f, 0.99f, 0.74f)'
new_roi = 'val (rightMidCrop, rightMidScaled) = cropAndScale(0.60f, 0.34f, 0.99f, 0.72f)'
if old_roi not in s:
    raise SystemExit("right ROI marker not found")
s = s.replace(old_roi, new_roi, 1)

SERVICE.write_text(s, encoding="utf-8")
print("v1.0.32 strict timeframe ROI applied")
