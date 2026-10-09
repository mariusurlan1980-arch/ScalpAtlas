"""v1.0.46: distinguish the broker chart M5 from overlay's own fixed M10 title.

Applied after genericize/timeframe patches v1027..v1039, timing v1044,
one-signal-per-bar v1045. Does not relax trade-entry safety conditions.
"""
from pathlib import Path
p = Path(".github/native-overlay/ScalpOverlayService.kt")
s = p.read_text(encoding="utf-8")

def one(old, new, name):
    global s
    n = s.count(old)
    if n != 1:
        raise SystemExit(f"v1046: {name}: expected 1 occurrence, got {n}")
    s = s.replace(old, new, 1)

# Actual live timeframe must be visible; the previous hard-coded "M10"
# in the headline can be mistaken for a confirmed OCR timeframe.
one(
    '  private var signalText: TextView? = null\n',
    '  private var timeframeTitleText: TextView? = null\n  private var signalText: TextView? = null\n',
    "header reference"
)
import re
s, header_changed = re.subn(
    r'(?m)^(\s*text\s*=\s*)"SCALP ATLAS\s*[•·-]\s*(?:M10|AUTO)"\s*$',
    lambda m: m.group(1) + '"SCALP ATLAS • AUTO"',
    s,
    count=1
)
if header_changed != 1:
    context = [repr(line) for line in s.splitlines() if "SCALP ATLAS" in line]
    raise SystemExit("v1046: headline could not be located; got " + str(context[:8]))
one(
    '    val close = TextView(this).apply {\n',
    '    timeframeTitleText = title\n\n    val close = TextView(this).apply {\n',
    "store title view"
)
one(
    '      signalText?.text = signal\n',
    '''      timeframeTitleText?.text = "SCALP ATLAS • " + currentTimeframe
      signalText?.text = signal
''',
    "live header refresh"
)

# Focus on broker chart's right-hand time label in portrait screenshots.
# The user's screenshot shows M5 at ~x=.76w, y=.36h and clock beside it.
# Old focus y=.40-.62 missed this label but could scan our floating overlay.
one(
    '    val (rightMidCrop, rightMidScaled) = cropAndScale(0.56f, 0.30f, 0.99f, 0.76f)\n',
    '    val (rightMidCrop, rightMidScaled) = cropAndScale(0.69f, 0.24f, 0.90f, 0.73f)\n',
    "chart strip ROI"
)
one(
    '    val (rightFocusCrop, rightFocusScaled) = cropAndScale(0.68f, 0.40f, 0.93f, 0.62f)\n',
    '    val (rightFocusCrop, rightFocusScaled) = cropAndScale(0.69f, 0.28f, 0.89f, 0.46f)\n',
    "focus ROI for M5"
)

# Prefer the chart-focused OCR read. Never concatenate broad+focus because
# normalizeTimeframe gives M10 precedence over M5; that caused false M10.
one(
    '                applyDetectedTexts((broadText + " " + focusResult.text).trim())\n',
    '''                val focusText = focusResult.text
                val focusTf = normalizeTimeframe(focusText)
                val broadWithoutOverlay = broadText.lines()
                  .filterNot { line ->
                    val u = line.uppercase()
                    u.contains("SCALP") || u.contains("ATLAS") ||
                      u.contains("AȘTEAPTĂ") || u.contains("NU INTRA") ||
                      u.contains("PAUZĂ") || u.contains("CONFIRMAT")
                  }
                  .joinToString(" ")
                // Broad fallback is permitted only if it contains an actual
                // nearby broker countdown and no self-overlay branding.
                val hasCountdown = Regex("""(?<![0-9])[0-9]{1,2}:[0-5][0-9](?![0-9])""")
                  .containsMatchIn(broadWithoutOverlay)
                val trusted = if (focusTf != null) focusText
                  else if (hasCountdown && !broadText.contains("SCALP", ignoreCase = true) &&
                           !broadText.contains("ATLAS", ignoreCase = true)) broadWithoutOverlay
                  else ""
                applyDetectedTexts(trusted)
''',
    "focus OCR priority"
)
# If focused OCR errors but broad OCR succeeds, do not fall back to a broad
# frame contaminated with "SCALP ATLAS • M10".
one(
    '                applyDetectedTexts(broadText)\n',
    '''                val safeBroad = broadText.takeIf {
                  !it.contains("SCALP", ignoreCase = true) &&
                  !it.contains("ATLAS", ignoreCase = true) &&
                  Regex("""(?<![0-9])[0-9]{1,2}:[0-5][0-9](?![0-9])""")
                    .containsMatchIn(it)
                } ?: ""
                applyDetectedTexts(safeBroad)
''',
    "broad OCR fallback"
)

# After repeated OCR misses, remove stale previously-confirmed TF instead of
# indefinitely keeping M10 and thus blocking/labeling a new M5 chart.
one(
    '''        if (timeframeMissCount >= 3) {
          timeframeCandidate = null
          timeframeCandidateCount = 0
          timeframeMissCount = 0
        }
''',
    '''        if (timeframeMissCount >= 3) {
          timeframeCandidate = null
          timeframeCandidateCount = 0
          timeframeMissCount = 0
          if (currentTimeframe != "AUTO") {
            currentTimeframe = "AUTO"
            resetSignalStateForMarketChange()
            updateOverlay(
              "AȘTEAPTĂ",
              "TIMEFRAME AUTO • etichetă M1/M5/M10/M15 neconfirmată",
              "Nu emit BIP până când brokerul afișează clar timeframe-ul"
            )
          }
        }
''',
    "stale TF invalidation"
)

# Initial status must be AUTO rather than a hard-coded false M10.
for old, new in [
    ('"M10 • HTML încărcat"', '"AUTO • HTML încărcat"'),
    ('"M10 • motor ACTIV"', '"AUTO • motor ACTIV"'),
    ('"M10 • flux ecran activ"', '"AUTO • flux ecran activ"'),
    ('"M10 • cadru respins"', '"AUTO • cadru respins"'),
]:
    s=s.replace(old,new)

if "SCALP ATLAS • M10" in s:
    raise SystemExit("Overlay still contains stale hard-coded M10 header")
if s.count('chartCountdownEvidenceCount') == 0:
    raise SystemExit("Failed to preserve v1044 timing guard")
p.write_text(s,encoding="utf-8")
print("v1.0.46: chart-focus timeframe OCR + AUTO header applied")
