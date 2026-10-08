"""v1.0.44: fail-closed 5-minute entry-timing gate for M10 overlay signals.

The chart countdown is read in the broker's existing right-side OCR area.
We do not assume that two scans = two different closed candles, and we do
not emit an M10 bip from the phone's clock alone.
"""
from pathlib import Path

p = Path(".github/native-overlay/ScalpOverlayService.kt")
s = p.read_text(encoding="utf-8")

def replace_once(old, new, label):
    global s
    if s.count(old) != 1:
        raise SystemExit(f"timing guard: {label}: expected 1 occurrence, found {s.count(old)}")
    s = s.replace(old, new, 1)

replace_once(
    '  @Volatile private var timeframeMissCount = 0\n',
    '''  @Volatile private var timeframeMissCount = 0
  @Volatile private var chartCountdownSeconds: Int? = null
  @Volatile private var chartCountdownAt = 0L
  @Volatile private var chartCountdownEvidenceCount = 0
''',
    "fields"
)

# M10 bar clocks shown by the broker are expected to count down to the next
# ten-minute boundary, as in a displayed "M10 07:19" at 17:12:41.
# If the broker uses a different bar clock or OCR is uncertain, fail CLOSED.
helpers = '''  private fun noteM10CountdownFromChart(rightOcrText: String, detectedTimeframe: String?) {
    val now = System.currentTimeMillis()
    if (detectedTimeframe != "M10") return

    val wallRemaining = 600 - ((now / 1000L) % 600L).toInt()
    val choices = Regex("""(?<![0-9])([0-9]{1,2}):([0-5][0-9])(?![0-9])""")
      .findAll(rightOcrText)
      .mapNotNull { m ->
        val mm = m.groupValues[1].toIntOrNull()
        val ss = m.groupValues[2].toIntOrNull()
        if (mm == null || ss == null || mm !in 0..9) null else mm * 60 + ss
      }
      .toList()

    val read = choices.minByOrNull { kotlin.math.abs(it - wallRemaining) }
    if (read == null || kotlin.math.abs(read - wallRemaining) > 35) {
      // A missing read does not turn an old OCR sample into fresh evidence.
      if (now - chartCountdownAt > 12_000L) {
        chartCountdownSeconds = null
        chartCountdownAt = 0L
        chartCountdownEvidenceCount = 0
      }
      return
    }

    val previous = chartCountdownSeconds
    val elapsed = (now - chartCountdownAt).coerceAtLeast(0L) / 1000L
    val consecutive = previous != null &&
      chartCountdownAt > 0L &&
      now - chartCountdownAt <= 15_000L &&
      kotlin.math.abs((previous - elapsed.toInt()) - read) <= 12

    chartCountdownEvidenceCount =
      if (consecutive) (chartCountdownEvidenceCount + 1).coerceAtMost(3) else 1
    chartCountdownSeconds = read
    chartCountdownAt = now
  }

  private fun m10EntryTimingRejection(now: Long): String? {
    if (currentTimeframe != "M10") return null
    val read = chartCountdownSeconds
    if (read == null || chartCountdownEvidenceCount < 2 ||
        chartCountdownAt <= 0L || now - chartCountdownAt > 12_000L) {
      return "Cronometru M10 nedetectat sau neverificat (2 citiri OCR)"
    }

    val elapsed = ((now - chartCountdownAt).coerceAtLeast(0L) / 1000L).toInt()
    val remaining = read - elapsed
    val expected = 600 - ((now / 1000L) % 600L).toInt()
    if (kotlin.math.abs(remaining - expected) > 35) {
      return "Cronometrul graficului nu este sincronizat cu M10"
    }
    // At least 6m30s must remain (5m expiry + margin); also exclude
    // the opening 70 seconds when OCR / candle colors can be unstable.
    if (remaining !in 390..530) {
      return "Fereastră M10 pentru test 5 min: așteaptă 06:30–08:50"
    }
    return null
  }

'''
replace_once(
    '  private fun handleResult(result: JSONObject) {\n',
    helpers + '  private fun handleResult(result: JSONObject) {\n',
    "gate helper"
)

replace_once(
    '      val detectedTimeframe = normalizeTimeframe(cleanRightText)\n',
    '''      val detectedTimeframe = normalizeTimeframe(cleanRightText)
      noteM10CountdownFromChart(cleanRightText, detectedTimeframe)
''',
    "existing right-side OCR"
)

replace_once(
    '  private fun resetSignalStateForMarketChange() {\n',
    '''  private fun resetSignalStateForMarketChange() {
    chartCountdownSeconds = null
    chartCountdownAt = 0L
    chartCountdownEvidenceCount = 0
''',
    "market reset"
)

replace_once(
    '    val expiry = result.optInt("expiry", 0)\n',
    '''    // The user tests five-minute expiry on M10. This is an execution
    // setting, not a statistical promise that a 5-minute trade will win.
    val expiry = if (currentTimeframe == "M10") 5 else result.optInt("expiry", 0)
''',
    "user-selected M10 test horizon"
)

replace_once(
    '    if (rawSignal != "BUY" && rawSignal != "SELL") {\n',
    '''    // M10 5-MINUTE ENTRY GUARD v1.0.44.
    // Fail closed before counting confirmations or playing any beep.
    val timingRejection = m10EntryTimingRejection(now)
    if (timingRejection != null) {
      candidateDir = null
      candidateCount = 0
      candidateLastAt = 0L
      updateOverlay(
        "AȘTEAPTĂ",
        "NU INTRA • M10 / 5 min • protecție timp",
        timingRejection
      )
      return
    }

    if (rawSignal != "BUY" && rawSignal != "SELL") {
''',
    "before candidate and bip"
)

if s.count("M10 5-MINUTE ENTRY GUARD v1.0.44") != 1:
    raise SystemExit("M10 guard marker not found after patch")
p.write_text(s, encoding="utf-8")
print("Scalp Atlas v1.0.44 M10 OCR countdown / 5-minute timing gate applied")
