"""v1.0.45: one M10 audible alert per confirmed pair+bar, no stale candidates.
This is an engineering safeguard, NOT a claim of predictive profitability.
Applied AFTER patches v1027 ... v1039 and v1044 in the Android workflow.
"""
from pathlib import Path
import re

path = Path(".github/native-overlay/ScalpOverlayService.kt")
s = path.read_text(encoding="utf-8")

def one(old, new, label):
    global s
    matches = s.count(old)
    if matches != 1:
        raise SystemExit(f"{label}: expected exactly one marker; found {matches}")
    s = s.replace(old, new, 1)

one(
    "  private var candidateDir: String? = null\n",
    "  private var candidateBarKey: String? = null\n  private var candidateDir: String? = null\n",
    "candidate metadata"
)
one(
    "  private fun resetSignalStateForMarketChange() {\n",
    "  private fun resetSignalStateForMarketChange() {\n    candidateBarKey = null\n",
    "market change reset"
)

helper = '''  private fun m10BarKeyForSignal(now: Long): String? {
    if (currentTimeframe != "M10") return null
    // Paired with the strict verified M10 countdown guard from v1.0.44.
    // No pair or stale OCR = NO signal. The 10-minute boundary is only
    // accepted after chart timer and phone clock have agreed.
    val pair = currentPair.trim().uppercase()
    if (pair.isBlank() || pair == "—" || pair == "UNKNOWN") return null
    if (m10EntryTimingRejection(now) != null) return null
    val read = chartCountdownSeconds ?: return null
    val elapsed = ((now - chartCountdownAt).coerceAtLeast(0L) / 1000L).toInt()
    val remaining = read - elapsed
    val closeMillis = now + remaining * 1000L
    val closeBarId = (closeMillis + 30_000L) / 600_000L
    return pair + "|M10|" + closeBarId
  }

  private fun recordPaperOnlySignal(now: Long, key: String, dir: String) {
    // Stores metadata for REVIEW after five minutes. No price feed or
    // verified closing quote exists, so this does NOT label wins/losses.
    try {
      val prefs = getSharedPreferences("scalp_atlas_paper_signals", Context.MODE_PRIVATE)
      val previous = org.json.JSONArray(prefs.getString("events", "[]"))
      val recent = org.json.JSONArray()
      for (i in max(0, previous.length() - 79) until previous.length()) {
        recent.put(previous.get(i))
      }
      recent.put(
        JSONObject()
          .put("pair", currentPair)
          .put("timeframe", "M10")
          .put("dir", dir)
          .put("sentAt", now)
          .put("reviewAt", now + 5 * 60_000L)
          .put("barKey", key)
          .put("outcome", "REQUIRES_PRICE_VERIFICATION")
      )
      prefs.edit().putString("events", recent.toString()).apply()
    } catch (_: Exception) {
      // An optional private journal must not crash the real-time overlay.
    }
  }

'''
one("  private fun handleResult(result: JSONObject) {\n", helper+"  private fun handleResult(result: JSONObject) {\n", "helper insertion")

# A WAIT/NONE between two same-direction scans invalidates the candidate.
# Previously, a candidate was preserved for 65 seconds during contradictory
# analysis, allowing 2/2 to appear without genuinely stable evidence.
start='    if (rawSignal != "BUY" && rawSignal != "SELL") {\n'
end='    if (candidateDir != rawSignal) {\n'
i=s.find(start)
j=s.find(end,i+len(start))
if i<0 or j<0 or s.count(start)!=1 or s.count(end)!=1:
    raise SystemExit("cannot locate candidate NONE branch")
s=s[:i]+'''    // STABLE-CANDIDATE FIX v1.0.45: any missing/rejected result breaks
    // the candidate sequence. A fresh 2/2 must be continuous and in the
    // same M10 candle, not separated by stale WAIT/NONE results.
    if (rawSignal != "BUY" && rawSignal != "SELL") {
      candidateDir = null
      candidateBarKey = null
      candidateCount = 0
      candidateLastAt = 0L
      updateOverlay(
        "AȘTEAPTĂ",
        "$currentPair • $currentTimeframe • fără direcție verificată",
        if (reason.isNotBlank()) reason else pattern
      )
      return
    }

    val currentM10BarKey = if (currentTimeframe == "M10") m10BarKeyForSignal(now) else null
    if (currentTimeframe == "M10" && currentM10BarKey == null) {
      candidateDir = null
      candidateBarKey = null
      candidateCount = 0
      candidateLastAt = 0L
      updateOverlay(
        "AȘTEAPTĂ",
        "NU INTRA • pereche sau lumânare M10 neconfirmată",
        "Identificarea lumânării și a perechii este necesară"
      )
      return
    }

    if (candidateDir != rawSignal || candidateBarKey != currentM10BarKey) {
''' + s[j+len(end):]
# Count continues only within same bar.
one(
    '      candidateDir = rawSignal\n      candidateCount = 1\n',
    '      candidateDir = rawSignal\n      candidateBarKey = currentM10BarKey\n      candidateCount = 1\n',
    "stable candidate start"
)
one(
    "    // SIGNAL LOCK v1.0.23\n",
    '''    // ONE-ALERT-PER-M10-BAR v1.0.45:
    // Guard is persisted across overlay restarts and pair switching.
    // It prevents a second BIP for the exact same confirmed pair+M10 bar.
    if (currentTimeframe == "M10") {
      val barKey = currentM10BarKey ?: return
      val prefs = getSharedPreferences("scalp_atlas_bar_dedupe", Context.MODE_PRIVATE)
      val seen = prefs.getStringSet("barKeys", emptySet()) ?: emptySet()
      if (barKey in seen) {
        candidateDir = null
        candidateBarKey = null
        candidateCount = 0
        candidateLastAt = 0L
        updateOverlay(
          "PAUZĂ SEMNAL",
          "NU INTRA • semnal emis deja pentru această lumânare M10",
          "Un singur BIP per pereche și lumânare M10"
        )
        return
      }
      val currentBarId = barKey.substringAfterLast('|').toLongOrNull() ?: return
      val updated = seen.filter { stored ->
        val id = stored.substringAfterLast('|').toLongOrNull()
        id != null && id >= currentBarId - 144L
      }.toMutableSet()
      updated.add(barKey)
      if (!prefs.edit().putStringSet("barKeys", updated).commit()) {
        updateOverlay("AȘTEAPTĂ", "NU INTRA • evidența semnalelor indisponibilă", "Fără bip")
        return
      }
      recordPaperOnlySignal(now, barKey, rawSignal)
    }

    // SIGNAL LOCK v1.0.23
''',
    "bip guard"
)
# Always reset bar-candidate ownership at lock and TTL expiry.
one(
    "    lockedDir = rawSignal\n",
    "    lockedDir = rawSignal\n    candidateBarKey = null\n",
    "reset bar metadata on success"
)
# Make the 2/2 label accurate: it is two consecutive scan confirmations,
# not two independently completed candles. Keep UI layout unchanged.
one(
    '    playBip()\n',
    '''    // DEMO EXPERIMENT: two consecutive *scans* plus separate candle
    // color and M10 countdown heuristics; no claim of future profit.
    playBip()
''',
    "bip marker"
)
if "ONE-ALERT-PER-M10-BAR v1.0.45" not in s or "STABLE-CANDIDATE FIX v1.0.45" not in s:
    raise SystemExit("v1.0.45 markers absent")
path.write_text(s, encoding="utf-8")
print("v1.0.45 one-alert-per-bar, stable scan candidate, paper journal applied")
