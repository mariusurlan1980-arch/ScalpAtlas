from pathlib import Path

SERVICE = Path(".github/native-overlay/ScalpOverlayService.kt")
s = SERVICE.read_text(encoding="utf-8")

# Candidate state: timeframe is committed only after two identical consecutive OCR reads.
needle = '''  @Volatile private var currentTimeframe = "AUTO"
  @Volatile private var currentPair = "—"
'''
replacement = '''  @Volatile private var currentTimeframe = "AUTO"
  @Volatile private var timeframeCandidate: String? = null
  @Volatile private var timeframeCandidateCount = 0
  @Volatile private var currentPair = "—"
'''
if needle not in s:
    raise SystemExit("timeframe state marker not found")
s = s.replace(needle, replacement, 1)

old = '''      .addOnSuccessListener { result ->
        val text = result.text
        val detectedTimeframe = normalizeTimeframe(text)
        val detectedPair = normalizePair(text)
        var changed = false

        if (detectedTimeframe != null && detectedTimeframe != currentTimeframe) {
          currentTimeframe = detectedTimeframe
          changed = true
        }
        if (detectedPair != null && detectedPair != currentPair) {
          currentPair = detectedPair
          changed = true
        }

        if (changed) {
          resetSignalStateForMarketChange()
          updateOverlay(
            "AȘTEAPTĂ",
            "$currentPair • $currentTimeframe detectat",
            "Piață schimbată • analiza a fost resetată"
          )
        }
      }
'''
new = '''      .addOnSuccessListener { result ->
        val text = result.text

        // TIMEFRAME LOCK v1.0.28:
        // Timeframe-ul trebuie să apară de două ori consecutiv, în zona superioară
        // a graficului. Astfel evităm ca ore, expirări sau alte texte din broker
        // să fie interpretate greșit ca M1/M5/M10/M30/H1.
        val topLimit = (copy.height * 0.55f).roundToInt()
        val timeframeText = result.textBlocks
          .filter { block ->
            val box = block.boundingBox
            box != null && box.centerY() <= topLimit
          }
          .joinToString(" ") { it.text }

        val detectedTimeframe = normalizeTimeframe(timeframeText)
        val detectedPair = normalizePair(text)
        var changed = false

        if (detectedTimeframe != null) {
          if (timeframeCandidate == detectedTimeframe) {
            timeframeCandidateCount += 1
          } else {
            timeframeCandidate = detectedTimeframe
            timeframeCandidateCount = 1

            // Dacă apare un timeframe diferit de cel confirmat, oprim semnalele
            // până la a doua citire identică.
            if (currentTimeframe != "AUTO" && detectedTimeframe != currentTimeframe) {
              currentTimeframe = "AUTO"
              resetSignalStateForMarketChange()
              updateOverlay(
                "AȘTEAPTĂ",
                "TIMEFRAME AUTO • verific " + detectedTimeframe,
                "Confirmare timeframe 1/2 • fără semnal"
              )
            }
          }

          if (timeframeCandidateCount >= 2 && currentTimeframe != detectedTimeframe) {
            currentTimeframe = detectedTimeframe
            timeframeCandidateCount = 0
            changed = true
          }
        } else {
          timeframeCandidate = null
          timeframeCandidateCount = 0
        }

        if (detectedPair != null && detectedPair != currentPair) {
          currentPair = detectedPair
          changed = true
        }

        if (changed) {
          resetSignalStateForMarketChange()
          updateOverlay(
            "AȘTEAPTĂ",
            "$currentPair • $currentTimeframe confirmat",
            "Timeframe verificat • analiza a fost resetată"
          )
        }
      }
'''
if old not in s:
    raise SystemExit("scheduleMarketOcr block not found")
s = s.replace(old, new, 1)

SERVICE.write_text(s, encoding="utf-8")
print("v1.0.28 timeframe lock applied")
