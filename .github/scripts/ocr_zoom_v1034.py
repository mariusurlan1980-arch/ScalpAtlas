from pathlib import Path
import re

SERVICE = Path(".github/native-overlay/ScalpOverlayService.kt")
s = SERVICE.read_text(encoding="utf-8")

# Add OCR image-enhancement imports.
imports = """import android.graphics.Bitmap
import android.graphics.Color
import android.graphics.PixelFormat
"""
replacement_imports = """import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.ColorMatrix
import android.graphics.ColorMatrixColorFilter
import android.graphics.Paint
import android.graphics.PixelFormat
"""
if imports not in s:
    raise SystemExit("graphics imports marker not found")
s = s.replace(imports, replacement_imports, 1)

pattern = re.compile(
    r'  private fun scheduleMarketOcr\(bitmap: Bitmap\) \{.*?\n  \}\n\n  private fun startProjection',
    re.S,
)

replacement = r'''  private fun scheduleMarketOcr(bitmap: Bitmap) {
    val now = System.currentTimeMillis()
    if (marketOcrBusy || now - lastMarketOcrAt < MARKET_OCR_INTERVAL_MS) return

    marketOcrBusy = true
    lastMarketOcrAt = now

    val copy = bitmap.copy(Bitmap.Config.ARGB_8888, false)
    val w = copy.width
    val h = copy.height

    fun crop(x0f: Float, y0f: Float, x1f: Float, y1f: Float): Bitmap {
      val x0 = (w * x0f).roundToInt().coerceIn(0, w - 2)
      val y0 = (h * y0f).roundToInt().coerceIn(0, h - 2)
      val x1 = (w * x1f).roundToInt().coerceIn(x0 + 2, w)
      val y1 = (h * y1f).roundToInt().coerceIn(y0 + 2, h)
      return Bitmap.createBitmap(copy, x0, y0, x1 - x0, y1 - y0)
    }

    fun enlargeAndEnhance(input: Bitmap, factor: Float, maxWidth: Int): Bitmap {
      val targetWidth = (input.width * factor).roundToInt().coerceAtLeast(2).coerceAtMost(maxWidth)
      val targetHeight = ((input.height.toFloat() * targetWidth) / input.width.toFloat())
        .roundToInt().coerceAtLeast(2)

      val scaled = Bitmap.createScaledBitmap(input, targetWidth, targetHeight, true)
      val enhanced = Bitmap.createBitmap(targetWidth, targetHeight, Bitmap.Config.ARGB_8888)

      val saturation = ColorMatrix().apply { setSaturation(0f) }
      val contrast = ColorMatrix(floatArrayOf(
        1.75f, 0f,    0f,    0f, -78f,
        0f,    1.75f, 0f,    0f, -78f,
        0f,    0f,    1.75f, 0f, -78f,
        0f,    0f,    0f,    1f,   0f
      ))
      saturation.postConcat(contrast)

      val paint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        isFilterBitmap = true
        colorFilter = ColorMatrixColorFilter(saturation)
      }
      Canvas(enhanced).drawBitmap(scaled, 0f, 0f, paint)
      if (scaled !== input) try { scaled.recycle() } catch (_: Throwable) {}
      return enhanced
    }

    // Pair ROI: broker-neutral upper-left instrument label.
    val pairCrop = crop(0.00f, 0.07f, 0.60f, 0.30f)
    val pairImage = enlargeAndEnhance(pairCrop, 2.4f, 1200)

    // Timeframe ROI A: tight right-side area where M1/M5/M10 is typically rendered.
    // Matches the user test screenshots where M10/M5 sits near the current price line.
    val tfCropA = crop(0.66f, 0.38f, 0.92f, 0.69f)
    val tfImageA = enlargeAndEnhance(tfCropA, 4.0f, 1400)

    // Timeframe ROI B: wider fallback for brokers/layouts placing the label slightly left/up/down.
    val tfCropB = crop(0.50f, 0.30f, 0.90f, 0.76f)
    val tfImageB = enlargeAndEnhance(tfCropB, 3.2f, 1500)

    val recognizer = TextRecognition.getClient(TextRecognizerOptions.DEFAULT_OPTIONS)
    var pairText = ""
    var timeframeTextA = ""

    fun cleanup() {
      for (bmp in listOf(pairImage, pairCrop, tfImageA, tfCropA, tfImageB, tfCropB, copy)) {
        try { if (!bmp.isRecycled) bmp.recycle() } catch (_: Throwable) {}
      }
      try { recognizer.close() } catch (_: Throwable) {}
      marketOcrBusy = false
    }

    fun applyDetectedTexts(tfText: String) {
      val detectedTimeframe = normalizeTimeframe(tfText)
      val detectedPair = normalizePair(pairText)
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
        resetSignalStateForMarketChange()
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

    // OCR chain: pair -> tight timeframe -> wider fallback only if needed.
    recognizer.process(InputImage.fromBitmap(pairImage, 0))
      .addOnSuccessListener { result ->
        pairText = result.text
      }
      .addOnCompleteListener {
        recognizer.process(InputImage.fromBitmap(tfImageA, 0))
          .addOnSuccessListener { result ->
            timeframeTextA = result.text
          }
          .addOnCompleteListener {
            if (normalizeTimeframe(timeframeTextA) != null) {
              applyDetectedTexts(timeframeTextA)
              cleanup()
            } else {
              recognizer.process(InputImage.fromBitmap(tfImageB, 0))
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
      }
  }

  private fun startProjection'''

s, n = pattern.subn(replacement, s, count=1)
if n != 1:
    raise SystemExit("scheduleMarketOcr block not found")

SERVICE.write_text(s, encoding="utf-8")
print("v1.0.34 OCR zoom + contrast applied")
