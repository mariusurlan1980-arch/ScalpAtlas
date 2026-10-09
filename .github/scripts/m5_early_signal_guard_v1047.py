"""v1.0.47: require verified early M5 chart-bar countdown for beep.

Original M10 filters and UI retained. Reject late M5 alerts, use one BIP per
pair and M5 bar, and retain M5/M10 five-minute horizon as user-selected.
This engineering filter is not a predictor of returns.
"""
from pathlib import Path
p=Path(".github/native-overlay/ScalpOverlayService.kt")
s=p.read_text(encoding="utf-8")

def one(old,new,label):
    global s
    n=s.count(old)
    if n!=1:
        raise SystemExit(f"v1047 {label}: expected 1, found {n}")
    s=s.replace(old,new,1)

one(
    '  @Volatile private var chartCountdownSeconds: Int? = null\n',
    '  @Volatile private var chartCountdownTf = "AUTO"\n  @Volatile private var chartCountdownSeconds: Int? = null\n',
    "chart timeframe state"
)
one(
    '  private fun noteM10CountdownFromChart(rightOcrText: String, detectedTimeframe: String?) {\n',
    '  private fun noteChartCountdownFromChart(rightOcrText: String, detectedTimeframe: String?) {\n',
    "countdown OCR reader"
)
one(
    '''    if (detectedTimeframe != "M10") return

    val wallRemaining = 600 - ((now / 1000L) % 600L).toInt()
''',
    '''    if (detectedTimeframe != "M5" && detectedTimeframe != "M10") return
    if (chartCountdownTf != detectedTimeframe) {
      chartCountdownTf = detectedTimeframe
      chartCountdownSeconds = null
      chartCountdownAt = 0L
      chartCountdownEvidenceCount = 0
    }

    val timeframeSeconds = if (detectedTimeframe == "M5") 300L else 600L
    val wallRemaining = (timeframeSeconds - ((now / 1000L) % timeframeSeconds)).toInt()
''',
    "read chart countdown with actual bar duration"
)
one(
    '      noteM10CountdownFromChart(cleanRightText, detectedTimeframe)\n',
    '      noteChartCountdownFromChart(cleanRightText, detectedTimeframe)\n',
    "OCR reader call"
)
one(
    '''    chartCountdownSeconds = null
    chartCountdownAt = 0L
    chartCountdownEvidenceCount = 0
''',
    '''    chartCountdownTf = "AUTO"
    chartCountdownSeconds = null
    chartCountdownAt = 0L
    chartCountdownEvidenceCount = 0
''',
    "on pair/timeframe change reset clock evidence"
)
one(
    '    if (read == null || chartCountdownEvidenceCount < 2 ||\n',
    '    if (read == null || chartCountdownTf != "M10" || chartCountdownEvidenceCount < 2 ||\n',
    "M10 must use M10 timer"
)
one(
    '  private fun m10BarKeyForSignal(now: Long): String? {\n    if (currentTimeframe != "M10") return null\n',
    '  private fun verifiedBarKeyForSignal(now: Long): String? {\n    if (currentTimeframe != "M10" && currentTimeframe != "M5") return null\n',
    "generic per bar key"
)
one(
    '    if (m10EntryTimingRejection(now) != null) return null\n',
    '    if (m10EntryTimingRejection(now) != null || m5EntryTimingRejection(now) != null) return null\n',
    "bar key matches M5/M10 time filters"
)
one(
    '''    val closeBarId = (closeMillis + 30_000L) / 600_000L
    return pair + "|M10|" + closeBarId
''',
    '''    val barMillis = if (currentTimeframe == "M5") 300_000L else 600_000L
    val closeBarId = (closeMillis + 30_000L) / barMillis
    return pair + "|" + currentTimeframe + "|" + closeBarId
''',
    "dedupe bar-size"
)
one(
    '          .put("timeframe", "M10")\n',
    '          .put("timeframe", currentTimeframe)\n',
    "paper journal timeframe"
)
one(
    '    val currentM10BarKey = if (currentTimeframe == "M10") m10BarKeyForSignal(now) else null\n',
    '    val currentChartBarKey = if (currentTimeframe == "M5" || currentTimeframe == "M10") verifiedBarKeyForSignal(now) else null\n',
    "verified current M5/M10 bar key"
)
one(
    '    if (currentTimeframe == "M10" && currentM10BarKey == null) {\n',
    '    if ((currentTimeframe == "M10" || currentTimeframe == "M5") && currentChartBarKey == null) {\n',
    "reject bar without clock"
)
if s.count("currentM10BarKey")!=3:
    raise SystemExit(f"v1047 remaining candidate bar-key references: {s.count('currentM10BarKey')}")
s=s.replace("currentM10BarKey","currentChartBarKey")
one(
    '    if (currentTimeframe == "M10") {\n      val barKey = currentChartBarKey ?: return\n',
    '    if (currentTimeframe == "M5" || currentTimeframe == "M10") {\n      val barKey = currentChartBarKey ?: return\n',
    "persist M5 BIP deduplication too"
)
one(
    '"NU INTRA • pereche sau lumânare M10 neconfirmată"',
    '"NU INTRA • pereche sau lumânare M5/M10 neconfirmată"',
    "generic uncertain-bar status"
)
one(
    '"NU INTRA • semnal emis deja pentru această lumânare M10"',
    '"NU INTRA • semnal deja emis pentru lumânarea curentă"',
    "generic dedup feedback"
)
one(
    '"Un singur BIP per pereche și lumânare M10"',
    '"Un singur BIP per pereche și lumânare"',
    "generic dedup detail"
)
one(
    '    val expiry = if (currentTimeframe == "M10") 5 else result.optInt("expiry", 0)\n',
    '    val expiry = if (currentTimeframe == "M5" || currentTimeframe == "M10") 5 else result.optInt("expiry", 0)\n',
    "5-minute expiry M5/M10"
)
one(
    '    val timingRejection = m10EntryTimingRejection(now)\n',
    '    val timingRejection = m10EntryTimingRejection(now) ?: m5EntryTimingRejection(now)\n',
    "active timing rejection"
)
one(
    '"NU INTRA • M10 / 5 min • protecție timp"',
    '"NU INTRA • $currentTimeframe / 5 min • protecție timp"',
    "overlay timing label"
)
insert='''  private fun m5EntryTimingRejection(now: Long): String? {
    if (currentTimeframe != "M5") return null
    val read = chartCountdownSeconds
    if (read == null || chartCountdownTf != "M5" || chartCountdownEvidenceCount < 2 ||
        chartCountdownAt <= 0L || now - chartCountdownAt > 12_000L) {
      return "M5: cronometrul lumânării nu este verificat (2 citiri OCR)"
    }
    val elapsed = ((now - chartCountdownAt).coerceAtLeast(0L) / 1000L).toInt()
    val remaining = read - elapsed
    val expected = 300 - ((now / 1000L) % 300L).toInt()
    if (kotlin.math.abs(remaining - expected) > 20) {
      return "M5: cronometrul graficului nu coincide cu timpul real"
    }
    // EARLY M5 BIP GUARD v1.0.47.
    // Early window 00:20..01:05 after current M5 candle opens:
    // 4:40..3:55 remaining. A five-minute option trade spans the next bar;
    // no claim that this timing predicts the direction or ensures profit.
    if (remaining !in 235..280) {
      return "M5: semnal prea târziu/devreme • testează doar în primele 20–65 secunde"
    }
    return null
  }

'''
one('  private fun m10EntryTimingRejection(now: Long): String? {\n',insert+'  private fun m10EntryTimingRejection(now: Long): String? {\n',"M5 strict timing guard")
if s.count("EARLY M5 BIP GUARD v1.0.47")!=1:raise SystemExit("new M5 guard absent")
if "noteM10CountdownFromChart" in s or "currentM10BarKey" in s:raise SystemExit("old M10-only identifier survived")
p.write_text(s,encoding="utf-8")
print("v1.0.47 early M5-timeframe countdown, one beep per bar, 5-minute trade interval applied")
