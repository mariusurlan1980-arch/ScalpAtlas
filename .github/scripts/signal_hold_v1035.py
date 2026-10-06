from pathlib import Path

SERVICE = Path(".github/native-overlay/ScalpOverlayService.kt")
s = SERVICE.read_text(encoding="utf-8")

# v1.0.35 — keep a confirmed BUY/SELL visibly latched for 10 seconds.
# This does not alter the Atlas analysis engine, confirmations, score or expiry.
needle = "    private const val REQUIRED_CONFIRMATIONS = 3\n"
repl = needle + "    private const val SIGNAL_HOLD_MS = 10_000L\n"
if "SIGNAL_HOLD_MS" not in s:
    if needle not in s:
        raise SystemExit("required confirmations marker not found")
    s = s.replace(needle, repl, 1)

needle = "  private var lockedDir: String? = null\n  private var lockedUntil = 0L\n"
repl = needle + "  private var signalVisibleUntil = 0L\n"
if "signalVisibleUntil" not in s:
    if needle not in s:
        raise SystemExit("lock state marker not found")
    s = s.replace(needle, repl, 1)

old_reset = """  private fun resetSignalStateForMarketChange() {
    candidateDir = null
    candidateCount = 0
    candidateLastAt = 0L
    lockedDir = null
    lockedUntil = 0L
  }
"""
new_reset = """  private fun resetSignalStateForMarketChange() {
    candidateDir = null
    candidateCount = 0
    candidateLastAt = 0L
    lockedDir = null
    lockedUntil = 0L
    signalVisibleUntil = 0L
  }
"""
if old_reset not in s:
    raise SystemExit("market reset marker not found")
s = s.replace(old_reset, new_reset, 1)

old_lock = """    val currentLock = lockedDir
    if (currentLock != null && now < lockedUntil) {
      val seconds = max(0L, (lockedUntil - now) / 1000L)
      updateOverlay(
        "PAUZĂ SEMNAL",
        "Așteaptă următorul semnal • " + formatSeconds(seconds),
        "NU INTRA • BUY/SELL apare numai la CONFIRMAT " +
          REQUIRED_CONFIRMATIONS + "/" + REQUIRED_CONFIRMATIONS + " + BIP"
      )
      return
    }
"""
new_lock = """    val currentLock = lockedDir
    if (currentLock != null && now < lockedUntil) {
      val seconds = max(0L, (lockedUntil - now) / 1000L)
      if (now < signalVisibleUntil) {
        val holdSeconds = max(1L, (signalVisibleUntil - now + 999L) / 1000L)
        updateOverlay(
          currentLock,
          "CONFIRMAT " + REQUIRED_CONFIRMATIONS + "/" + REQUIRED_CONFIRMATIONS +
            " + BIP • " + holdSeconds + "s",
          "SEMNAL FIX • rămâne afișat 10 secunde • fără inversare"
        )
      } else {
        updateOverlay(
          "PAUZĂ SEMNAL",
          "Așteaptă următorul semnal • " + formatSeconds(seconds),
          "NU INTRA • BUY/SELL apare numai la CONFIRMAT " +
            REQUIRED_CONFIRMATIONS + "/" + REQUIRED_CONFIRMATIONS + " + BIP"
        )
      }
      return
    }
"""
if old_lock not in s:
    raise SystemExit("safe signal pause block not found")
s = s.replace(old_lock, new_lock, 1)

old_expired = """    if (currentLock != null && now >= lockedUntil) {
      lockedDir = null
      lockedUntil = 0L
      candidateDir = null
"""
new_expired = """    if (currentLock != null && now >= lockedUntil) {
      lockedDir = null
      lockedUntil = 0L
      signalVisibleUntil = 0L
      candidateDir = null
"""
if old_expired not in s:
    raise SystemExit("expired lock marker not found")
s = s.replace(old_expired, new_expired, 1)

old_start = """    lockedDir = rawSignal
    lockedUntil = now + lockMinutes * 60_000L
    candidateDir = null
"""
new_start = """    lockedDir = rawSignal
    lockedUntil = now + lockMinutes * 60_000L
    signalVisibleUntil = now + SIGNAL_HOLD_MS
    candidateDir = null
"""
if old_start not in s:
    raise SystemExit("lock start marker not found")
s = s.replace(old_start, new_start, 1)

SERVICE.write_text(s, encoding="utf-8")
print("v1.0.35 confirmed BUY/SELL 10-second hold applied")
