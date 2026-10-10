"""Scalp Atlas v1.0.49 — prevent oscillating BUY/SELL candidates.

Any BUY -> SELL (or reverse) observed within the same verified pair, M5/M10
clock bar suppresses BOTH candidate directions and BIP for that entire bar.
This is an abstention / diagnostics safety policy, not trade accuracy proof.
Runs after v1.0.48 diagnostic preview patch.
"""
from pathlib import Path

p=Path(".github/native-overlay/ScalpOverlayService.kt")
s=p.read_text(encoding="utf-8")

def one(old,new,label):
    global s
    n=s.count(old)
    if n!=1: raise SystemExit(f"one-direction guard: {label}: expected once; got {n}")
    s=s.replace(old,new,1)

one(
    "  private var candidateDir: String? = null\n",
    """  private var previewBarKey: String? = null
  private var previewStableReads = 0
  private var previewReadAt = 0L
  private var candidateDir: String? = null
""",
    "candidate stability state"
)

helper='''  // ONE-DIRECTION GUARD v1.0.49
  // A vote is not a trading instruction. If the same M5/M10 candle switches
  // tentative direction, suppress both directions for that bar, including BIP.
  // Pair+timeframe+bar key and conflict status persist across overlay restarts.
  private fun directionConsistencyBlock(now: Long, tentative: String, signal: String): String? {
    val seconds = when (currentTimeframe) {
      "M5" -> 300_000L
      "M10" -> 600_000L
      else -> return null
    }
    val pair = currentPair.trim().uppercase()
    if (pair.isBlank() || pair == "—" || pair == "UNKNOWN") {
      return "Instrument neidentificat • nu confirm direcția"
    }
    val barBegin = (now / seconds) * seconds
    val key = pair + "|" + currentTimeframe + "|" + barBegin
    val prefs = getSharedPreferences("scalp_atlas_direction_guard_v1049", Context.MODE_PRIVATE)
    if (previewBarKey != key) {
      previewBarKey = key
      previewStableReads = 0
      previewReadAt = 0L
      // Keep the store small; do not forget conflicts within the same bar.
      val editor = prefs.edit()
      for (oldKey in prefs.all.keys) {
        val oldStart = oldKey.substringAfterLast('|').toLongOrNull()
        if (oldStart != null && now - oldStart > 4L * 60L * 60L * 1000L) {
          editor.remove(oldKey)
        }
      }
      editor.apply()
    }

    val first = prefs.getString(key, null)
    if (first == "CONFLICT") {
      return "DIRECȚII CONTRADICTORII în aceeași lumânare • FĂRĂ BIP până la următoarea"
    }

    val valid = tentative == "BUY" || tentative == "SELL"
    if (valid) {
      if (first != null && first != tentative) {
        prefs.edit().putString(key, "CONFLICT").commit()
        previewStableReads = 0
        previewReadAt = 0L
        return "INVERSARE BUY/SELL detectată în aceeași lumânare • FĂRĂ BIP"
      }
      if (first == null && !prefs.edit().putString(key, tentative).commit()) {
        return "Nu pot salva direcția inițială • FĂRĂ BIP"
      }
      // Do not mark BUY or SELL as a candidate from a single noisy scan.
      if (previewReadAt == 0L || now - previewReadAt > 16_000L) {
        previewStableReads = 1
        previewReadAt = now
      } else if (now - previewReadAt >= 4_000L) {
        previewStableReads = (previewStableReads + 1).coerceAtMost(3)
        previewReadAt = now
      }
      if (previewStableReads < 2) {
        return "Verific stabilitatea direcției (2 citiri la minimum 4 secunde) • FĂRĂ BIP"
      }
    }

    if (signal == "BUY" || signal == "SELL") {
      if (!valid || signal != tentative || first != null && first != signal) {
        return "Votul recent nu confirmă direcția semnalului • FĂRĂ BIP"
      }
      if (previewStableReads < 2) {
        return "Direcție insuficient stabilă • FĂRĂ BIP"
      }
    }
    return null
  }

'''
one("  private fun handleResult(result: JSONObject) {\n", helper+"  private fun handleResult(result: JSONObject) {\n","function injection")

# Must precede any candidate confirmation and the sound.
one(
    "    val currentLock = lockedDir\n",
    '''    val directionBlock = directionConsistencyBlock(now, previewDir, rawSignal)
    if (directionBlock != null) {
      candidateDir = null
      candidateBarKey = null
      candidateCount = 0
      candidateLastAt = 0L
      updateOverlay(
        "AȘTEAPTĂ",
        "$currentPair • $currentTimeframe • DIRECȚIE NECONFIRMATĂ • NU INTRA",
        directionBlock
      )
      return
    }

    val currentLock = lockedDir
''',
    "pre-beep consistency gate"
)
if "ONE-DIRECTION GUARD v1.0.49" not in s or s.count("directionConsistencyBlock(now, previewDir, rawSignal)")!=1:
    raise SystemExit("safety gate not verified")
p.write_text(s,encoding="utf-8")
print("v1.0.49 single-direction per candle / contradiction abstention applied")
