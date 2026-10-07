from pathlib import Path

SERVICE = Path(".github/native-overlay/ScalpOverlayService.kt")
s = SERVICE.read_text(encoding="utf-8")

# v1.0.38 — improve AUTO timeframe OCR reliability on small grey labels such as M10.
# Keep strict signal blocking while timeframe is AUTO; only make OCR more tolerant.

needle = '''  @Volatile private var timeframeCandidate: String? = null
  @Volatile private var timeframeCandidateCount = 0
'''
replacement = '''  @Volatile private var timeframeCandidate: String? = null
  @Volatile private var timeframeCandidateCount = 0
  @Volatile private var timeframeMissCount = 0
'''
if needle not in s:
    raise SystemExit("timeframe state marker not found")
s = s.replace(needle, replacement, 1)

# Increase OCR scale so small timeframe text is easier for ML Kit.
old = '''      val targetWidth = (crop.width * 2).coerceAtMost(1200)
'''
new = '''      val targetWidth = (crop.width * 4).coerceAtMost(1800)
'''
if old not in s:
    raise SystemExit("OCR scale marker not found")
s = s.replace(old, new, 1)

# Keep the broad right ROI and add a tighter focus ROI centered where broker chart labels usually sit.
old = '''    val (rightMidCrop, rightMidScaled) = cropAndScale(0.60f, 0.34f, 0.99f, 0.72f)

    val recognizer = TextRecognition.getClient(TextRecognizerOptions.DEFAULT_OPTIONS)
'''
new = '''    val (rightMidCrop, rightMidScaled) = cropAndScale(0.56f, 0.30f, 0.99f, 0.76f)
    val (rightFocusCrop, rightFocusScaled) = cropAndScale(0.68f, 0.40f, 0.93f, 0.62f)

    val recognizer = TextRecognition.getClient(TextRecognizerOptions.DEFAULT_OPTIONS)
'''
if old not in s:
    raise SystemExit("right ROI marker not found")
s = s.replace(old, new, 1)

old = '''      try { rightMidScaled.recycle() } catch (_: Throwable) {}
      if (rightMidCrop !== rightMidScaled) try { rightMidCrop.recycle() } catch (_: Throwable) {}
      try { copy.recycle() } catch (_: Throwable) {}
'''
new = '''      try { rightMidScaled.recycle() } catch (_: Throwable) {}
      if (rightMidCrop !== rightMidScaled) try { rightMidCrop.recycle() } catch (_: Throwable) {}
      try { rightFocusScaled.recycle() } catch (_: Throwable) {}
      if (rightFocusCrop !== rightFocusScaled) try { rightFocusCrop.recycle() } catch (_: Throwable) {}
      try { copy.recycle() } catch (_: Throwable) {}
'''
if old not in s:
    raise SystemExit("cleanup marker not found")
s = s.replace(old, new, 1)

# A single OCR miss must not erase a good first candidate.
old = '''      if (detectedTimeframe != null) {
        if (timeframeCandidate == detectedTimeframe) {
'''
new = '''      if (detectedTimeframe != null) {
        timeframeMissCount = 0
        if (timeframeCandidate == detectedTimeframe) {
'''
if old not in s:
    raise SystemExit("detected timeframe marker not found")
s = s.replace(old, new, 1)

old = '''      } else {
        timeframeCandidate = null
        timeframeCandidateCount = 0
      }
'''
new = '''      } else {
        timeframeMissCount += 1
        if (timeframeMissCount >= 3) {
          timeframeCandidate = null
          timeframeCandidateCount = 0
          timeframeMissCount = 0
        }
      }
'''
if old not in s:
    raise SystemExit("timeframe miss marker not found")
s = s.replace(old, new, 1)

# OCR both broad and focused areas; combine the texts before normalization.
old = '''        recognizer.process(InputImage.fromBitmap(rightMidScaled, 0))
          .addOnSuccessListener { result ->
            applyDetectedTexts(result.text)
          }
          .addOnFailureListener {
            applyDetectedTexts("")
          }
          .addOnCompleteListener {
            cleanup()
          }
'''
new = '''        recognizer.process(InputImage.fromBitmap(rightMidScaled, 0))
          .addOnSuccessListener { broadResult ->
            val broadText = broadResult.text
            recognizer.process(InputImage.fromBitmap(rightFocusScaled, 0))
              .addOnSuccessListener { focusResult ->
                applyDetectedTexts((broadText + " " + focusResult.text).trim())
              }
              .addOnFailureListener {
                applyDetectedTexts(broadText)
              }
              .addOnCompleteListener {
                cleanup()
              }
          }
          .addOnFailureListener {
            recognizer.process(InputImage.fromBitmap(rightFocusScaled, 0))
              .addOnSuccessListener { focusResult ->
                applyDetectedTexts(focusResult.text)
              }
              .addOnFailureListener {
                applyDetectedTexts("")
              }
              .addOnCompleteListener {
                cleanup()
              }
          }
'''
if old not in s:
    raise SystemExit("OCR chain marker not found")
s = s.replace(old, new, 1)

SERVICE.write_text(s, encoding="utf-8")
print("v1.0.38 timeframe OCR reliability fix applied")
