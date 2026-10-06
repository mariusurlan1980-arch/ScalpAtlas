from pathlib import Path

SERVICE = Path(".github/native-overlay/ScalpOverlayService.kt")
s = SERVICE.read_text(encoding="utf-8")

old = '''    val currentLock = lockedDir
    if (currentLock != null && now < lockedUntil) {
      val seconds = max(0L, (lockedUntil - now) / 1000L)
      if (rawSignal == currentLock) {
        updateOverlay(
          "MONITORIZARE",
          "Direcție " + currentLock + " • " + formatSeconds(seconds),
          "NU ESTE SEMNAL NOU • protecția semnalului confirmat este activă"
        )
      } else {
        updateOverlay(
          "MONITORIZARE",
          "Direcție " + currentLock + " • " + formatSeconds(seconds),
          "NU ESTE SEMNAL NOU • semnal opus blocat până la expirarea ferestrei"
        )
      }
      return
    }
'''

new = '''    val currentLock = lockedDir
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
'''

if old not in s:
    raise SystemExit("v1.0.30 monitoring block not found")
s = s.replace(old, new, 1)

# Strengthen market-change behavior: pair/timeframe changes must kill any active lock
# before the new market can display anything that might be mistaken for a signal.
old_change = '''      if (detectedPair != null && detectedPair != currentPair) {
        currentPair = detectedPair
        changed = true
      }

      if (changed) {
        resetSignalStateForMarketChange()
'''
new_change = '''      if (detectedPair != null && detectedPair != currentPair) {
        resetSignalStateForMarketChange()
        currentPair = detectedPair
        changed = true
      }

      if (changed) {
        resetSignalStateForMarketChange()
'''
if old_change not in s:
    raise SystemExit("market change block not found")
s = s.replace(old_change, new_change, 1)

SERVICE.write_text(s, encoding="utf-8")
print("v1.0.31 safe signal UI applied")
