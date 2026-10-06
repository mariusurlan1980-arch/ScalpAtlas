from pathlib import Path
import re

SERVICE = Path(".github/native-overlay/ScalpOverlayService.kt")
s = SERVICE.read_text(encoding="utf-8")

# More broker-neutral timeframe spellings, still requiring a clear timeframe token.
norm_pattern = re.compile(
    r'  private fun normalizeTimeframe\(text: String\): String\? \{.*?\n  \}\n\n  private fun normalizePair',
    re.S,
)
norm_repl = r'''  private fun normalizeTimeframe(text: String): String? {
    val compact = text.uppercase()
      .replace("\n", " ")
      .replace(Regex("\\s+"), " ")
      .trim()

    val patterns = listOf(
      "M30" to Regex("(?:^|[^A-Z0-9])(?:M\\s*3[0O]|3[0O]\\s*M|3[0O]\\s*MIN)(?:[^A-Z0-9]|$)"),
      "M15" to Regex("(?:^|[^A-Z0-9])(?:M\\s*[1I][5S]|[1I][5S]\\s*M|[1I][5S]\\s*MIN)(?:[^A-Z0-9]|$)"),
      "M10" to Regex("(?:^|[^A-Z0-9])(?:M\\s*[1I][0O]|[1I][0O]\\s*M|[1I][0O]\\s*MIN)(?:[^A-Z0-9]|$)"),
      "M5"  to Regex("(?:^|[^A-Z0-9])(?:M\\s*[5S]|[5S]\\s*M|[5S]\\s*MIN)(?:[^A-Z0-9]|$)"),
      "M3"  to Regex("(?:^|[^A-Z0-9])(?:M\\s*3|3\\s*M|3\\s*MIN)(?:[^A-Z0-9]|$)"),
      "M2"  to Regex("(?:^|[^A-Z0-9])(?:M\\s*2|2\\s*M|2\\s*MIN)(?:[^A-Z0-9]|$)"),
      "M1"  to Regex("(?:^|[^A-Z0-9])(?:M\\s*[1I]|[1I]\\s*M|[1I]\\s*MIN|60\\s*S)(?:[^A-Z0-9]|$)"),
      "H1"  to Regex("(?:^|[^A-Z0-9])(?:H\\s*[1I]|[1I]\\s*H|60\\s*MIN)(?:[^A-Z0-9]|$)")
    )
    return patterns.firstOrNull { it.second.containsMatchIn(compact) }?.first
  }

  private fun normalizePair'''
s, n = norm_pattern.subn(norm_repl, s, count=1)
if n != 1:
    raise SystemExit("normalizeTimeframe block not found")

# Replace the OCR scan with two enlarged broker-neutral ROIs:
# upper-left for instrument/timeframe controls and middle-right for chart timeframe labels.
ocr_pattern = re.compile(
    r'  private fun scheduleMarketOcr\(bitmap: Bitmap\) \{.*?\n  \}\n\n  private fun startProjection',
    re.S,
)
ocr_repl = r'''  private fun scheduleMarketOcr(bitmap: Bitmap) {
    val now = System.currentTimeMillis()
    if (marketOcrBusy || now - lastMarketOcrAt < MARKET_OCR_INTERVAL_MS) return

    marketOcrBusy = true
    lastMarketOcrAt = now

    val copy = bitmap.copy(Bitmap.Config.ARGB_8888, false)
    val w = copy.width
    val h = copy.height

    fun cropAndScale(x0f: Float, y0f: Float, x1f: Float, y1f: Float): Pair<Bitmap, Bitmap> {
      val x0 = (w * x0f).roundToInt().coerceIn(0, w - 2)
      val y0 = (h * y0f).roundToInt().coerceIn(0, h - 2)
      val x1 = (w * x1f).roundToInt().coerceIn(x0 + 2, w)
      val y1 = (h * y1f).roundToInt().coerceIn(y0 + 2, h)
      val crop = Bitmap.createBitmap(copy, x0, y0, x1 - x0, y1 - y0)
      val targetWidth = (crop.width * 2).coerceAtMost(1200)
      val targetHeight = ((crop.height.toFloat() * targetWidth) / crop.width.toFloat()).roundToInt()
      val scaled = Bitmap.createScaledBitmap(crop, targetWidth, targetHeight.coerceAtLeast(2), true)
      return Pair(crop, scaled)
    }

    // ROI 1: controale/instrument în stânga-sus. Evită fereastra flotantă din dreapta-sus.
    val (topLeftCrop, topLeftScaled) = cropAndScale(0.00f, 0.06f, 0.62f, 0.44f)
    // ROI 2: eticheta timeframe de lângă axa prețului. În captura M1 este aici.
    val (rightMidCrop, rightMidScaled) = cropAndScale(0.48f, 0.38f, 0.99f, 0.74f)

    val recognizer = TextRecognition.getClient(TextRecognizerOptions.DEFAULT_OPTIONS)
    var leftText = ""

    fun cleanup() {
      try { topLeftScaled.recycle() } catch (_: Throwable) {}
      if (topLeftCrop !== topLeftScaled) try { topLeftCrop.recycle() } catch (_: Throwable) {}
      try { rightMidScaled.recycle() } catch (_: Throwable) {}
      if (rightMidCrop !== rightMidScaled) try { rightMidCrop.recycle() } catch (_: Throwable) {}
      try { copy.recycle() } catch (_: Throwable) {}
      try { recognizer.close() } catch (_: Throwable) {}
      marketOcrBusy = false
    }

    fun applyDetectedTexts(rightText: String) {
      val combined = (leftText + " " + rightText).trim()
      val detectedTimeframe = normalizeTimeframe(combined)
      val detectedPair = normalizePair(combined)
      var changed = false

      if (detectedTimeframe != null) {
        if (timeframeCandidate == detectedTimeframe) {
          timeframeCandidateCount += 1
        } else {
          timeframeCandidate = detectedTimeframe
          timeframeCandidateCount = 1

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
          "Timeframe verificat 2/2 • analiza a fost resetată"
        )
      } else if (currentTimeframe == "AUTO" && detectedTimeframe != null) {
        updateOverlay(
          "AȘTEAPTĂ",
          "TIMEFRAME AUTO • verific " + detectedTimeframe,
          "Confirmare timeframe " + timeframeCandidateCount + "/2 • fără semnal"
        )
      }
    }

    // Două citiri OCR pe zone mici și mărite sunt mai fiabile decât OCR pe ecranul complet.
    recognizer.process(InputImage.fromBitmap(topLeftScaled, 0))
      .addOnSuccessListener { result ->
        leftText = result.text
      }
      .addOnCompleteListener {
        recognizer.process(InputImage.fromBitmap(rightMidScaled, 0))
          .addOnSuccessListener { result ->
            applyDetectedTexts(result.text)
          }
          .addOnFailureListener {
            applyDetectedTexts("")
          }
          .addOnCompleteListener {
            cleanup()
          }
      }
  }

  private fun startProjection'''
s, n = ocr_pattern.subn(ocr_repl, s, count=1)
if n != 1:
    raise SystemExit("scheduleMarketOcr block not found")

SERVICE.write_text(s, encoding="utf-8")
print("v1.0.29 targeted timeframe OCR applied")
