from pathlib import Path

SERVICE = Path(".github/native-overlay/ScalpOverlayService.kt")
s = SERVICE.read_text(encoding="utf-8")

old_lock = '''    val currentLock = lockedDir
    if (currentLock != null && now < lockedUntil) {
      val seconds = max(0L, (lockedUntil - now) / 1000L)
      if (rawSignal == currentLock) {
        updateOverlay(
          currentLock,
          "Scor " + score + "% • Expirare " + if (expiry > 0) expiry.toString() + " min" else "—",
          pattern + " • direcție activă " + formatSeconds(seconds)
        )
      } else {
        updateOverlay(
          "AȘTEAPTĂ",
          currentLock + " rămâne activ • " + formatSeconds(seconds),
          "Semnal opus blocat până la expirarea ferestrei"
        )
      }
      return
    }
'''
new_lock = '''    val currentLock = lockedDir
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
if old_lock not in s:
    raise SystemExit("active lock block not found")
s = s.replace(old_lock, new_lock, 1)

old_fresh = '''        updateOverlay(
          "AȘTEAPTĂ " + candidateDir,
          "Confirmare " + candidateCount + "/" + REQUIRED_CONFIRMATIONS + " • semnalul este reverificat",
          "$currentPair • $currentTimeframe • candidat păstrat"
        )'''
new_fresh = '''        updateOverlay(
          "AȘTEAPTĂ",
          "Candidat " + candidateDir + " • Confirmare " + candidateCount + "/" + REQUIRED_CONFIRMATIONS,
          "Semnalul este reverificat • $currentPair • $currentTimeframe"
        )'''
if old_fresh not in s:
    raise SystemExit("fresh candidate block not found")
s = s.replace(old_fresh, new_fresh, 1)

old_candidate = '''      updateOverlay(
        "AȘTEAPTĂ " + rawSignal,
        "Confirmare " + candidateCount + "/" + REQUIRED_CONFIRMATIONS + " • Scor " + score + "%",
        pattern + " • " + currentPair + " • " + currentTimeframe
      )'''
new_candidate = '''      updateOverlay(
        "AȘTEAPTĂ",
        "Candidat " + rawSignal + " • Confirmare " + candidateCount + "/" + REQUIRED_CONFIRMATIONS,
        "Scor " + score + "% • " + pattern + " • " + currentPair + " • " + currentTimeframe
      )'''
if old_candidate not in s:
    raise SystemExit("candidate confirmation block not found")
s = s.replace(old_candidate, new_candidate, 1)

old_confirmed = '''    updateOverlay(
      rawSignal,
      "Scor " + score + "% • Expirare " + if (expiry > 0) expiry.toString() + " min" else "—",
      pattern + " • $currentPair • $currentTimeframe • direcție estimată " + if (directionMax > 0) directionMax.toString() + " min" else currentTimeframe
    )'''
new_confirmed = '''    updateOverlay(
      rawSignal,
      "CONFIRMAT " + REQUIRED_CONFIRMATIONS + "/" + REQUIRED_CONFIRMATIONS + " • Scor " + score + "%",
      "BIP • Expirare " + if (expiry > 0) expiry.toString() + " min" else "—" +
        " • " + pattern + " • $currentPair • $currentTimeframe"
    )'''
if old_confirmed not in s:
    raise SystemExit("confirmed signal block not found")
s = s.replace(old_confirmed, new_confirmed, 1)

SERVICE.write_text(s, encoding="utf-8")
print("v1.0.30 monitoring labels applied")
